import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { z } from 'zod'

const updateRolSchema = z.object({
  nombre: z.string().min(1).optional(),
  codigo: z.string().optional().nullable(),
  descripcion: z.string().optional().nullable(),
  permisos: z.array(z.string()).optional(),
})

/**
 * PATCH /api/roles/[id]
 * Edita un rol. Solo usuarios con permiso usuarios_roles.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'usuarios_roles')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const data = updateRolSchema.parse(body)

    if (data.codigo !== undefined && data.codigo !== null) {
      const existente = await prisma.rol.findFirst({
        where: {
          codigo: data.codigo,
          id: { not: params.id },
        },
      })
      if (existente) {
        return NextResponse.json(
          { success: false, error: 'Ya existe un rol con ese código' },
          { status: 400 }
        )
      }
    }

    const rol = await prisma.rol.update({
      where: { id: params.id },
      data: {
        ...(data.nombre !== undefined && { nombre: data.nombre }),
        ...(data.codigo !== undefined && { codigo: data.codigo }),
        ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
        ...(data.permisos !== undefined && { permisos: data.permisos }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: rol.id,
        nombre: rol.nombre,
        codigo: rol.codigo,
        descripcion: rol.descripcion,
        permisos: rol.permisos as string[],
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error en PATCH /api/roles/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/roles/[id]
 * Elimina un rol. Solo si no hay usuarios asignados.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'usuarios_roles')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const rol = await prisma.rol.findUnique({
      where: { id: params.id },
      include: { _count: { select: { usuarios: true } } },
    })

    if (!rol) {
      return NextResponse.json({ success: false, error: 'Rol no encontrado' }, { status: 404 })
    }

    if (rol._count.usuarios > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No se puede eliminar: el rol tiene ${rol._count.usuarios} usuario(s) asignado(s). Reasigna los usuarios antes de eliminar.`,
        },
        { status: 400 }
      )
    }

    await prisma.rol.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error en DELETE /api/roles/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
