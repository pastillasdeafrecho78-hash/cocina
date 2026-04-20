import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'
import { aprobarSolicitudComoComanda } from '@/lib/solicitudes-approval'

const bodySchema = z.object({
  motivo: z.string().trim().max(240).optional(),
})

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['orders.override', 'comandas'])
    const tenant = requireActiveTenant(user)
    const body = bodySchema.parse(await request.json().catch(() => ({})))

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
    if (solicitud.estado === 'APROBADA') {
      return NextResponse.json({ success: false, error: 'La solicitud ya fue aprobada' }, { status: 409 })
    }
    if (solicitud.estado === 'RECHAZADA') {
      await prisma.solicitudPedido.update({
        where: { id: solicitud.id },
        data: { estado: 'PENDIENTE', rechazadaAt: null },
      })
    }

    const comanda = await aprobarSolicitudComoComanda({
      solicitudId: solicitud.id,
      restauranteId: tenant.restauranteId,
      actorUserId: user.id,
      modo: 'MANUAL_FORCE',
      reason: body.motivo || 'manual_force',
    })

    return NextResponse.json({ success: true, data: comanda })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en POST /api/solicitudes/[id]/forzar:'
    )
  }
}
