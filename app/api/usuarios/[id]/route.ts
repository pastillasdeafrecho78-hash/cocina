import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { hashPassword } from '@/lib/auth'
import { tienePermiso } from '@/lib/permisos'
import { z } from 'zod'

const updateUsuarioSchema = z.object({
  nombre: z.string().min(1).optional(),
  apellido: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional().nullable(),
  rolId: z.string().min(1).optional(),
  activo: z.boolean().optional(),
})

/**
 * PATCH /api/usuarios/[id]
 * Edita un usuario. Solo usuarios con permiso usuarios_roles.
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
    const data = updateUsuarioSchema.parse(body)

    const existente = await prisma.usuario.findUnique({
      where: { id: params.id },
    })
    if (!existente || existente.restauranteId !== user.restauranteId) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (data.email && data.email.toLowerCase().trim() !== existente.email) {
      const emailOcupado = await prisma.usuario.findUnique({
        where: {
          restauranteId_email: {
            restauranteId: user.restauranteId,
            email: data.email.toLowerCase().trim(),
          },
        },
      })
      if (emailOcupado) {
        return NextResponse.json(
          { success: false, error: 'Ya existe un usuario con ese email' },
          { status: 400 }
        )
      }
    }

    if (data.rolId) {
      const rol = await prisma.rol.findUnique({ where: { id: data.rolId } })
      if (!rol) {
        return NextResponse.json({ success: false, error: 'Rol no encontrado' }, { status: 404 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (data.nombre !== undefined) updateData.nombre = data.nombre.trim()
    if (data.apellido !== undefined) updateData.apellido = data.apellido.trim()
    if (data.email !== undefined) updateData.email = data.email.toLowerCase().trim()
    if (data.rolId !== undefined) updateData.rolId = data.rolId
    if (data.activo !== undefined) updateData.activo = data.activo
    if (data.password !== undefined && data.password !== null) {
      updateData.password = await hashPassword(data.password)
    }

    const usuario = await prisma.usuario.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        activo: true,
        rolId: true,
        rol: {
          select: {
            id: true,
            nombre: true,
            codigo: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: usuario,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error en PATCH /api/usuarios/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/usuarios/[id]
 * Desactiva un usuario (no borra físicamente).
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

    const existente = await prisma.usuario.findUnique({
      where: { id: params.id },
    })
    if (!existente) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    await prisma.usuario.update({
      where: { id: params.id },
      data: { activo: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error en DELETE /api/usuarios/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
