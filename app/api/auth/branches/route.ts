import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { tienePermiso } from '@/lib/permisos'
import { allocateUniqueRestaurantSlug } from '@/lib/slug'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({
  nombre: z.string().min(2).max(120),
  organizacionId: z.string().min(1).optional(),
})

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
  }
  if (!tienePermiso(user, 'configuracion')) {
    return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
  }

  try {
    const body = schema.parse(await request.json())
    const orgId = body.organizacionId ?? user.activeOrganizacionId ?? undefined
    const slug = await allocateUniqueRestaurantSlug(
      async (candidate) =>
        prisma.restaurante.findFirst({ where: { slug: candidate }, select: { slug: true } }),
      body.nombre
    )

    const created = await prisma.$transaction(async (tx) => {
      const restaurante = await tx.restaurante.create({
        data: {
          nombre: body.nombre.trim(),
          slug,
          organizacionId: orgId ?? null,
          activo: true,
        },
        select: { id: true, nombre: true, slug: true, organizacionId: true },
      })

      await tx.sucursalMiembro.upsert({
        where: {
          usuarioId_restauranteId: {
            usuarioId: user.id,
            restauranteId: restaurante.id,
          },
        },
        create: {
          usuarioId: user.id,
          restauranteId: restaurante.id,
          esPrincipal: false,
          activo: true,
        },
        update: { activo: true },
      })

      if (restaurante.organizacionId) {
        await tx.organizacionMiembro.upsert({
          where: {
            usuarioId_organizacionId: {
              usuarioId: user.id,
              organizacionId: restaurante.organizacionId,
            },
          },
          create: {
            usuarioId: user.id,
            organizacionId: restaurante.organizacionId,
            activo: true,
          },
          update: { activo: true },
        })
      }

      return restaurante
    })

    return NextResponse.json({ success: true, data: created })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('POST /api/auth/branches', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo crear la sucursal' },
      { status: 500 }
    )
  }
}
