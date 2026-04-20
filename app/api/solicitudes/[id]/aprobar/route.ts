import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireAnyCapability,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'
import { aprobarSolicitudComoComanda } from '@/lib/solicitudes-approval'

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['comandas', 'orders.override'])
    const tenant = requireActiveTenant(user)

    const solicitud = await prisma.solicitudPedido.findFirst({
      where: {
        id: params.id,
        restauranteId: tenant.restauranteId,
      },
      include: {
        items: {
          include: {
            modificadores: true,
            producto: {
              select: {
                listoPorDefault: true,
              },
            },
          },
        },
      },
    })

    if (!solicitud) {
      return NextResponse.json({ success: false, error: 'Solicitud no encontrada' }, { status: 404 })
    }
    if (!['PENDIENTE', 'EN_COLA'].includes(solicitud.estado)) {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden aprobar solicitudes pendientes o en cola' },
        { status: 409 }
      )
    }
    const result = await aprobarSolicitudComoComanda({
      solicitudId: solicitud.id,
      restauranteId: tenant.restauranteId,
      actorUserId: user.id,
      modo: 'MANUAL_APPROVE',
      reason: 'manual_dashboard_review',
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en POST /api/solicitudes/[id]/aprobar:'
    )
  }
}
