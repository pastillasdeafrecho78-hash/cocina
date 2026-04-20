import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireAnyCapability,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

const bodySchema = z.object({
  motivo: z.string().trim().max(240).optional(),
})

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['comandas', 'orders.override'])
    const tenant = requireActiveTenant(user)
    const body = await _request.json().catch(() => ({}))
    const parsed = bodySchema.parse(body)

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
    if (!['PENDIENTE', 'EN_COLA'].includes(solicitud.estado)) {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden rechazar solicitudes pendientes o en cola' },
        { status: 409 }
      )
    }

    const updated = await prisma.solicitudPedido.update({
      where: { id: solicitud.id },
      data: {
        estado: 'RECHAZADA',
        rechazadaAt: new Date(),
        reviewedById: user.id,
        decisionSource: 'MANUAL_REJECT',
        decisionReason: parsed.motivo || 'manual_reject',
      },
      select: { id: true, estado: true, rechazadaAt: true },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en POST /api/solicitudes/[id]/rechazar:'
    )
  }
}
