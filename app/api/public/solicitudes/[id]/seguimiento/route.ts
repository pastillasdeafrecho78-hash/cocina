import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashSecretToken } from '@/lib/public-ordering'
import { computeClientOrderEta } from '@/lib/client-order-eta'
import { countComandaItemsInPreparationLoad } from '@/lib/pedidos-cliente-capacidad-policy'
import { computeSolicitudClientePhase, labelForSolicitudPhase } from '@/lib/solicitud-seguimiento-phase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token de seguimiento requerido' },
        { status: 400 }
      )
    }
    const tokenHash = hashSecretToken(token)

    const solicitud = await prisma.solicitudPedido.findFirst({
      where: {
        id: params.id,
        publicTokenHash: tokenHash,
      },
      select: {
        id: true,
        estado: true,
        restauranteId: true,
        approvedComandaId: true,
        prioridadColaAt: true,
        createdAt: true,
        enColaAt: true,
        updatedAt: true,
        approvedComanda: {
          select: {
            id: true,
            numeroComanda: true,
            estado: true,
            items: {
              select: {
                cantidad: true,
                estado: true,
                destino: true,
                producto: { select: { nombre: true, listoPorDefault: true } },
                tamano: { select: { nombre: true } },
              },
            },
          },
        },
        items: {
          select: {
            cantidad: true,
            destino: true,
            producto: { select: { nombre: true, listoPorDefault: true } },
            tamano: { select: { nombre: true } },
          },
        },
      },
    })

    if (!solicitud) {
      return NextResponse.json(
        { success: false, error: 'Solicitud no encontrada o token inválido' },
        { status: 404 }
      )
    }

    const rid = solicitud.restauranteId

    const configRow = await prisma.configuracionRestaurante.findUnique({
      where: { restauranteId: rid },
      select: {
        clienteEtaMinMinutos: true,
        clienteEtaMaxMinutos: true,
        maxComandasActivas: true,
        maxItemsPreparacion: true,
        tiempoEsperaSaturacionMin: true,
      },
    })

    const clienteEtaMinMinutos = configRow?.clienteEtaMinMinutos ?? 45
    const clienteEtaMaxMinutos = configRow?.clienteEtaMaxMinutos ?? 60
    const maxComandasActivas = configRow?.maxComandasActivas ?? 25
    const maxItemsPreparacion =
      configRow?.maxItemsPreparacion != null && configRow.maxItemsPreparacion > 0
        ? configRow.maxItemsPreparacion
        : null
    const tiempoEsperaSaturacionMin = configRow?.tiempoEsperaSaturacionMin ?? 15

    const [activeComandas, itemsInPrepLoad] = await Promise.all([
      prisma.comanda.count({
        where: {
          restauranteId: rid,
          estado: { in: ['PENDIENTE', 'EN_PREPARACION', 'LISTO', 'SERVIDO'] },
        },
      }),
      countComandaItemsInPreparationLoad(rid),
    ])

    const { etaMin, etaMax, loadFactor } = computeClientOrderEta({
      clienteEtaMinMinutos,
      clienteEtaMaxMinutos,
      activeComandas,
      maxComandasActivas,
      itemsInPrepLoad,
      maxItemsPreparacion,
    })

    let queuePosition: number | null = null
    let queueAhead = 0
    if (solicitud.estado === 'EN_COLA' && solicitud.prioridadColaAt) {
      queueAhead = await prisma.solicitudPedido.count({
        where: {
          restauranteId: rid,
          estado: 'EN_COLA',
          OR: [
            { prioridadColaAt: { lt: solicitud.prioridadColaAt } },
            {
              prioridadColaAt: solicitud.prioridadColaAt,
              createdAt: { lt: solicitud.createdAt },
            },
          ],
        },
      })
      queuePosition = queueAhead + 1
    }

    const waitSeconds =
      solicitud.estado === 'EN_COLA'
        ? Math.max(0, queueAhead * tiempoEsperaSaturacionMin * 60)
        : 0

    const itemSnapshots =
      solicitud.approvedComanda?.items.map((it) => ({
        destino: it.destino,
        estado: it.estado,
        listoPorDefault: it.producto.listoPorDefault,
      })) ?? []

    const phase = computeSolicitudClientePhase({
      estadoSolicitud: solicitud.estado,
      approvedComandaId: solicitud.approvedComandaId,
      comandaEstado: solicitud.approvedComanda?.estado ?? null,
      items: itemSnapshots,
    })

    const itemSnapshotPublic = solicitud.approvedComanda
      ? solicitud.approvedComanda.items.map((it) => ({
          cantidad: it.cantidad,
          estado: it.estado,
          destino: it.destino,
          nombre: it.producto.nombre + (it.tamano?.nombre ? ` (${it.tamano.nombre})` : ''),
        }))
      : solicitud.items.map((it) => ({
          cantidad: it.cantidad,
          estado: 'PENDIENTE' as const,
          destino: it.destino,
          nombre: it.producto.nombre + (it.tamano?.nombre ? ` (${it.tamano.nombre})` : ''),
        }))

    return NextResponse.json({
      success: true,
      data: {
        solicitudId: solicitud.id,
        phase,
        phaseLabel: labelForSolicitudPhase(phase),
        updatedAt: solicitud.updatedAt.toISOString(),
        estado: solicitud.estado,
        queuePosition,
        waitSeconds,
        etaMinMinutes: etaMin,
        etaMaxMinutes: etaMax,
        loadFactor,
        comanda: solicitud.approvedComanda
          ? {
              id: solicitud.approvedComanda.id,
              numeroComanda: solicitud.approvedComanda.numeroComanda,
              estado: solicitud.approvedComanda.estado,
            }
          : null,
        items: itemSnapshotPublic,
      },
    })
  } catch (error) {
    console.error('Error en GET /api/public/solicitudes/[id]/seguimiento:', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo consultar el seguimiento' },
      { status: 500 }
    )
  }
}
