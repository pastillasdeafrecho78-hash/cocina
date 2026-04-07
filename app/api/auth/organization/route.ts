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
  if (!tienePermiso(user, 'settings.manage')) {
    return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
  }

  try {
    const input = createSchema.parse(await request.json())
    const actorRolId = user.effectiveRolId ?? user.rolId
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
          rolId: actorRolId,
          activo: true,
          esOwner: true,
        },
        update: { activo: true, esOwner: true, rolId: actorRolId },
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
  if (!tienePermiso(user, 'settings.manage')) {
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

const deleteSchema = z.object({
  organizacionId: z.string().min(1),
  confirmNombre: z.string().min(1),
  acknowledge: z.literal(true),
})

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
  }
  if (!tienePermiso(user, 'settings.manage')) {
    return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
  }

  try {
    const input = deleteSchema.parse(await request.json())
    const org = await prisma.organizacion.findFirst({
      where: {
        id: input.organizacionId,
        miembros: {
          some: {
            usuarioId: user.id,
            activo: true,
          },
        },
      },
      select: {
        id: true,
        nombre: true,
        activo: true,
        restaurantes: {
          where: { activo: true },
          select: { id: true },
        },
      },
    })
    if (!org) {
      return NextResponse.json({ success: false, error: 'Organización no encontrada' }, { status: 404 })
    }
    if (!org.activo) {
      return NextResponse.json({ success: false, error: 'La organización ya está cerrada' }, { status: 400 })
    }
    if (org.nombre.trim() !== input.confirmNombre.trim()) {
      return NextResponse.json(
        { success: false, error: 'El nombre de confirmación no coincide' },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.organizacion.update({
        where: { id: org.id },
        data: { activo: false },
      })

      await tx.restaurante.updateMany({
        where: { organizacionId: org.id, activo: true },
        data: { activo: false },
      })

      await tx.organizacionMiembro.updateMany({
        where: { organizacionId: org.id },
        data: { activo: false },
      })

      await tx.usuario.updateMany({
        where: {
          activeOrganizacionId: org.id,
        },
        data: {
          activeOrganizacionId: null,
          activeRestauranteId: null,
        },
      })

      const primaryBranchId = org.restaurantes[0]?.id
      if (primaryBranchId) {
        await tx.auditoria.create({
          data: {
            restauranteId: primaryBranchId,
            usuarioId: user.id,
            accion: 'CERRAR_ORGANIZACION',
            entidad: 'Organizacion',
            entidadId: org.id,
            detalles: {
              closedBranches: org.restaurantes.length,
              historicalDataRetained: true,
            },
          },
        })
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        organizacionId: org.id,
        closed: true,
        message:
          'Organización cerrada correctamente. Algunos datos históricos pueden conservarse por integridad del sistema y analítica.',
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('DELETE /api/auth/organization', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo cerrar la organización' },
      { status: 500 }
    )
  }
}
