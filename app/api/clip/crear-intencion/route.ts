import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { getClipApiKey } from '@/lib/clip-config'
import { clipPinpadCreatePayment, extractPinpadRequestId } from '@/lib/clip-payclip'
import { z } from 'zod'

const schema = z.object({
  comandaId: z.string().min(1),
  serialNumber: z.string().min(1),
  tipAmount: z.number().min(0).optional(),
})

export const dynamic = 'force-dynamic'

function montoComanda(comanda: { total: number; propina: number | null; descuento: number | null }) {
  const total = comanda.total || 0
  const propina = ((comanda.propina || 0) / 100) * total
  const descuento = comanda.descuento || 0
  return Math.max(0.01, total + propina - descuento)
}

function publicBaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  if (!u) return 'http://localhost:3000'
  if (u.startsWith('http')) return u.replace(/\/$/, '')
  return `https://${u.replace(/\/$/, '')}`
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || (!tienePermiso(user, 'caja') && !tienePermiso(user, 'comandas'))) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }
    const rid = user.restauranteId
    const body = schema.parse(await request.json())

    const apiKey = await getClipApiKey(rid)
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Clip no configurado o inactivo. Configura la API key en Caja → Clip.' },
        { status: 400 }
      )
    }

    const restaurante = await prisma.restaurante.findUnique({
      where: { id: rid },
      select: { slug: true },
    })
    const slug = restaurante?.slug || 'principal'

    const comanda = await prisma.comanda.findFirst({
      where: { id: body.comandaId, restauranteId: rid },
      include: { items: true },
    })
    if (!comanda) {
      return NextResponse.json({ success: false, error: 'Comanda no encontrada' }, { status: 404 })
    }
    if (comanda.estado === 'PAGADO') {
      return NextResponse.json({ success: false, error: 'La comanda ya está pagada' }, { status: 400 })
    }
    const pendientes = comanda.items.filter(
      (i) => i.estado !== 'LISTO' && i.estado !== 'ENTREGADO'
    )
    if (pendientes.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Todos los productos deben estar listos o entregados antes de cobrar.' },
        { status: 400 }
      )
    }

    const terminales = await prisma.clipTerminal.count({
      where: { restauranteId: rid, activo: true },
    })
    if (terminales > 0) {
      const ok = await prisma.clipTerminal.findFirst({
        where: {
          restauranteId: rid,
          activo: true,
          serialNumber: body.serialNumber,
        },
      })
      if (!ok) {
        return NextResponse.json(
          { success: false, error: 'Número de serie no registrado para este restaurante.' },
          { status: 400 }
        )
      }
    }

    const amount = montoComanda(comanda)
    const tip = body.tipAmount ?? 0

    const pago = await prisma.pago.create({
      data: {
        comandaId: comanda.id,
        monto: amount + tip,
        metodoPago: 'tarjeta_clip',
        procesador: 'clip',
        estado: 'PENDIENTE',
        detalles: {
          serialNumber: body.serialNumber,
          intentCreatedAt: new Date().toISOString(),
        } as object,
      },
    })

    const webhook_url = `${publicBaseUrl()}/api/webhooks/clip/${encodeURIComponent(slug)}`

    try {
      const clipRes = await clipPinpadCreatePayment({
        apiKey,
        amount,
        tip_amount: tip,
        reference: comanda.id,
        serial_number_pos: body.serialNumber,
        webhook_url,
      })
      const pinpadId = extractPinpadRequestId(clipRes)
      if (pinpadId) {
        await prisma.pago.update({
          where: { id: pago.id },
          data: {
            procesadorId: pinpadId,
            detalles: {
              ...(pago.detalles as object),
              clipCreateResponse: clipRes,
            } as object,
          },
        })
      }
      return NextResponse.json({
        success: true,
        data: {
          pagoId: pago.id,
          pinpadRequestId: pinpadId,
          monto: amount + tip,
          webhook_url,
          clip: clipRes,
        },
      })
    } catch (err: any) {
      await prisma.pago.update({
        where: { id: pago.id },
        data: {
          estado: 'FALLIDO',
          detalles: {
            error: err?.message || String(err),
          } as object,
        },
      })
      return NextResponse.json(
        { success: false, error: err?.message || 'Error al crear intención en Clip' },
        { status: 502 }
      )
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
    }
    console.error(e)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}
