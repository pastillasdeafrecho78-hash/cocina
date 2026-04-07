import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  restauranteId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const data = bodySchema.parse(body)

    const membership = await prisma.sucursalMiembro.findFirst({
      where: {
        usuarioId: user.id,
        restauranteId: data.restauranteId,
        activo: true,
        restaurante: { activo: true },
      },
      include: {
        restaurante: {
          select: { organizacionId: true },
        },
      },
    })

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'No tienes acceso a esta sucursal' },
        { status: 403 }
      )
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error en /api/auth/context:', error)
    return NextResponse.json(
      { success: false, error: 'Error al cambiar de sucursal' },
      { status: 500 }
    )
  }
}
