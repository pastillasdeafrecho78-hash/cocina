import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createPublicTrackingToken, hashSecretToken } from '@/lib/public-ordering'
import { buildSolicitudTrackerUrl } from '@/lib/public-solicitud-tracker-url'
import { buildSolicitudItems, publicSolicitudSchema } from '@/lib/solicitud-pedidos'
import { evaluarCapacidadPedidoClientePublico } from '@/lib/pedidos-cliente-capacidad-policy'
import { aprobarSolicitudComoComanda } from '@/lib/solicitudes-approval'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = publicSolicitudSchema.parse(body)
    const slug = data.slug.trim().toLowerCase()

    const restaurante = await prisma.restaurante.findFirst({
      where: { slug, activo: true },
      select: {
        id: true,
        nombre: true,
        slug: true,
        configuracion: {
          select: {
            pedidosClienteSolicitudHabilitado: true,
          },
        },
      },
    })
    if (!restaurante) {
      return NextResponse.json({ success: false, error: 'Sucursal no encontrada' }, { status: 404 })
    }

    if (!restaurante.configuracion?.pedidosClienteSolicitudHabilitado) {
      return NextResponse.json(
        {
          success: false,
          code: 'client_orders_disabled',
          error:
            'Los pedidos desde el menú público están desactivados en esta sucursal. Un administrador puede activarlos en Configuración → pedidos cliente.',
        },
        { status: 403 }
      )
    }

    const rid = restaurante.id
    let mesaId: string | undefined
    let origen: 'PUBLIC_LINK_GENERAL' | 'PUBLIC_LINK_MESA' = 'PUBLIC_LINK_GENERAL'

    if (data.mesaCode) {
      const mesaLink = await prisma.mesaPublicLink.findFirst({
        where: {
          restauranteId: rid,
          codeHash: hashSecretToken(data.mesaCode),
          activa: true,
          OR: [{ expiraEn: null }, { expiraEn: { gt: new Date() } }],
          mesa: {
            activa: true,
          },
        },
        select: {
          mesaId: true,
        },
      })
      if (!mesaLink) {
        return NextResponse.json({ success: false, error: 'Código de mesa inválido o expirado' }, { status: 404 })
      }
      mesaId = mesaLink.mesaId
      origen = 'PUBLIC_LINK_MESA'
    }

    if (data.tipoPedido === 'MESA' && !mesaId) {
      return NextResponse.json(
        { success: false, error: 'Para pedido en mesa debes usar un QR o link de mesa válido' },
        { status: 400 }
      )
    }

    const { solicitudItems, totalEstimado } = await buildSolicitudItems(rid, data)
    const decision = await evaluarCapacidadPedidoClientePublico({
      restauranteId: rid,
      wantsQueue: Boolean(data.acceptEnCola),
    })

    if (decision.action === 'REJECT') {
      return NextResponse.json(
        {
          success: false,
          error: decision.saturationMessage,
          code: 'restaurant_saturated',
          data: {
            waitMinutes: decision.waitMinutes,
            canJoinQueue: true,
            requiresQueueConfirmation: true,
          },
        },
        { status: 409 }
      )
    }

    const tracking = createPublicTrackingToken()

    const solicitud = await prisma.solicitudPedido.create({
      data: {
        restauranteId: rid,
        mesaId,
        origen,
        tipoPedido: data.tipoPedido,
        estado: decision.state,
        decisionSource: decision.source,
        decisionReason: decision.reason,
        publicTokenHash: tracking.hash,
        publicTokenIssuedAt: new Date(),
        ...(decision.action === 'QUEUE'
          ? {
              enColaAt: new Date(),
              prioridadColaAt: new Date(),
            }
          : {}),
        nombreCliente: data.cliente.nombre.trim(),
        telefono: data.cliente.telefono?.trim() || null,
        notas: data.cliente.notas?.trim() || null,
        observaciones: data.observaciones?.trim() || null,
        totalEstimado,
        items: {
          create: solicitudItems,
        },
      },
      select: {
        id: true,
        estado: true,
        createdAt: true,
        totalEstimado: true,
      },
    })

    let approvedComanda: { id: string; numeroComanda: string } | null = null
    if (decision.action === 'PENDING_REVIEW' && decision.autoApprove) {
      const systemActor = await prisma.usuario.findFirst({
        where: { restauranteId: rid, activo: true },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      })
      if (systemActor) {
        const comanda = await aprobarSolicitudComoComanda({
          solicitudId: solicitud.id,
          restauranteId: rid,
          actorUserId: systemActor.id,
          modo: 'AUTO_APPROVE',
          reason: 'auto_approve_capacity_available',
        })
        approvedComanda = { id: comanda.id, numeroComanda: comanda.numeroComanda }
      }
    }

    const trackerUrl = buildSolicitudTrackerUrl({
      origin: request.nextUrl.origin,
      solicitudId: solicitud.id,
      rawToken: tracking.raw,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: solicitud.id,
        estado: solicitud.estado,
        totalEstimado: solicitud.totalEstimado,
        decision: decision.reason,
        waitMinutes: decision.action === 'QUEUE' ? decision.waitMinutes : null,
        approvedComanda,
        createdAt: solicitud.createdAt,
        trackerUrl,
        trackingToken: tracking.raw,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    console.error('Error en POST /api/public/solicitudes:', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo crear la solicitud' },
      { status: 500 }
    )
  }
}
