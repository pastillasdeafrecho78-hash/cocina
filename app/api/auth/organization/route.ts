import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { tienePermiso } from '@/lib/permisos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createSchema = z.object({
  nombre: z.string().min(2).max(120),
})

const patchSchema = z.object({
  organizacionId: z.string().min(1),
  nombre: z.string().min(2).max(120),
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
    const input = createSchema.parse(await request.json())
    const created = await prisma.$transaction(async (tx) => {
      const org = await tx.organizacion.create({
        data: {
          nombre: input.nombre.trim(),
          activo: true,
        },
        select: { id: true, nombre: true },
      })

      await tx.organizacionMiembro.upsert({
        where: {
          usuarioId_organizacionId: {
            usuarioId: user.id,
            organizacionId: org.id,
          },
        },
        create: {
          usuarioId: user.id,
          organizacionId: org.id,
          activo: true,
          esOwner: true,
        },
        update: { activo: true, esOwner: true },
      })

      await tx.usuario.update({
        where: { id: user.id },
        data: { activeOrganizacionId: org.id },
      })

      return org
    })

    return NextResponse.json({ success: true, data: created })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('POST /api/auth/organization', error)
    return NextResponse.json({ success: false, error: 'No se pudo crear organización' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
  }
  if (!tienePermiso(user, 'configuracion')) {
    return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
  }

  try {
    const input = patchSchema.parse(await request.json())
    const membership = await prisma.organizacionMiembro.findFirst({
      where: {
        usuarioId: user.id,
        organizacionId: input.organizacionId,
        activo: true,
      },
      select: { id: true, esOwner: true },
    })
    if (!membership) {
      return NextResponse.json({ success: false, error: 'No tienes acceso a esta organización' }, { status: 403 })
    }

    const updated = await prisma.organizacion.update({
      where: { id: input.organizacionId },
      data: { nombre: input.nombre.trim() },
      select: { id: true, nombre: true },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('PATCH /api/auth/organization', error)
    return NextResponse.json({ success: false, error: 'No se pudo actualizar organización' }, { status: 500 })
  }
}
