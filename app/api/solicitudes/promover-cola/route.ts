import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'
import { aprobarSolicitudComoComanda } from '@/lib/solicitudes-approval'

export async function POST() {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['orders.override', 'comandas'])
    const tenant = requireActiveTenant(user)

    const config = await prisma.configuracionRestaurante.findUnique({
      where: { restauranteId: tenant.restauranteId },
      select: { queueEnabled: true, maxComandasActivas: true },
    })

    if (!config?.queueEnabled) {
      return NextResponse.json({ success: false, error: 'La cola no está habilitada' }, { status: 409 })
    }

    const activeCount = await prisma.comanda.count({
      where: {
        restauranteId: tenant.restauranteId,
        estado: { in: ['PENDIENTE', 'EN_PREPARACION', 'LISTO', 'SERVIDO'] },
      },
    })

    const max = config.maxComandasActivas && config.maxComandasActivas > 0 ? config.maxComandasActivas : 25
    const slots = Math.max(0, max - activeCount)
    if (slots <= 0) {
      return NextResponse.json({ success: true, data: { promoted: 0, pendingQueue: true } })
    }

    const queue = await prisma.solicitudPedido.findMany({
      where: {
        restauranteId: tenant.restauranteId,
        estado: 'EN_COLA',
      },
      orderBy: [{ prioridadColaAt: 'asc' }, { createdAt: 'asc' }],
      take: slots,
      select: { id: true },
    })

    const promoted: Array<{ solicitudId: string; comandaId: string; numeroComanda: string }> = []
    for (const item of queue) {
      const comanda = await aprobarSolicitudComoComanda({
        solicitudId: item.id,
        restauranteId: tenant.restauranteId,
        actorUserId: user.id,
        modo: 'AUTO_QUEUE_PROMOTION',
        reason: 'queue_slot_available',
      })
      promoted.push({
        solicitudId: item.id,
        comandaId: comanda.id,
        numeroComanda: comanda.numeroComanda,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        promoted: promoted.length,
        promociones: promoted,
      },
    })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en POST /api/solicitudes/promover-cola:'
    )
  }
}
