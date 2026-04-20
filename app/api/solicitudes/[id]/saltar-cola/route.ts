import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'
import { aprobarSolicitudComoComanda } from '@/lib/solicitudes-approval'

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['orders.override', 'comandas'])
    const tenant = requireActiveTenant(user)

    const solicitud = await prisma.solicitudPedido.findFirst({
      where: {
        id: params.id,
        restauranteId: tenant.restauranteId,
      },
      select: { id: true, estado: true },
    })
    if (!solicitud) {
      return NextResponse.json({ success: false, error: 'Solicitud no encontrada' }, { status: 404 })
    }
    if (solicitud.estado !== 'EN_COLA') {
      return NextResponse.json(
        { success: false, error: 'Solo se puede saltar cola en solicitudes EN_COLA' },
        { status: 409 }
      )
    }

    const comanda = await aprobarSolicitudComoComanda({
      solicitudId: solicitud.id,
      restauranteId: tenant.restauranteId,
      actorUserId: user.id,
      modo: 'MANUAL_FORCE',
      reason: 'manual_skip_queue',
    })

    return NextResponse.json({ success: true, data: comanda })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en POST /api/solicitudes/[id]/saltar-cola:'
    )
  }
}
