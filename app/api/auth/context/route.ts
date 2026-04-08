import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser, requireBranchMembership } from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  organizacionId: z.string().min(1).optional(),
  restauranteId: z.string().min(1).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()

    const body = await request.json()
    const data = bodySchema.parse(body)

    if (!data.organizacionId && !data.restauranteId) {
      raise(400, 'Debes enviar organización o sucursal')
    }

    let membership: { restauranteId: string; restaurante: { organizacionId: string | null } } | null =
      null

    if (data.restauranteId) {
      const validMembership = await requireBranchMembership(user.id, data.restauranteId)
      membership = {
        restauranteId: validMembership.restauranteId,
        restaurante: { organizacionId: validMembership.restaurante.organizacionId },
      }
    } else if (data.organizacionId) {
      membership = await prisma.sucursalMiembro.findFirst({
        where: {
          usuarioId: user.id,
          activo: true,
          restaurante: { activo: true, organizacionId: data.organizacionId },
        },
        include: {
          restaurante: {
            select: { organizacionId: true },
          },
        },
        orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'asc' }],
      })
    }

    if (!membership) {
      raise(403, 'No tienes acceso al contexto solicitado')
    }

    await prisma.usuario.update({
      where: { id: user.id },
      data: {
        activeRestauranteId: membership.restauranteId,
        activeOrganizacionId: membership.restaurante.organizacionId ?? null,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        activeRestauranteId: membership.restauranteId,
        activeOrganizacionId: membership.restaurante.organizacionId ?? null,
      },
    })
  } catch (error) {
    return toErrorResponse(error, 'Error al cambiar de sucursal', 'Error en /api/auth/context:')
  }
}
