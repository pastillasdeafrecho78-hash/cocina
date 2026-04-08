import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { z } from 'zod'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
  requireUserScopedToTenant,
} from '@/lib/authz/guards'
import { toErrorResponse, raise } from '@/lib/authz/http'

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
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'staff.manage')
    const tenant = requireActiveTenant(user)

    const body = await request.json()
    const data = updateUsuarioSchema.parse(body)

    const existente = await prisma.usuario.findUnique({ where: { id: params.id } })
    if (!existente) {
      raise(404, 'Usuario no encontrado')
    }

    await requireUserScopedToTenant(params.id, tenant.restauranteId)

    if (data.email && data.email.toLowerCase().trim() !== existente.email) {
      const emailOcupado = await prisma.usuario.findUnique({
        where: {
          restauranteId_email: {
            restauranteId: tenant.restauranteId,
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

    const usuario = await prisma.$transaction(async (tx) => {
      const updated = await tx.usuario.update({
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

      if (data.rolId !== undefined) {
        await tx.sucursalMiembro.updateMany({
          where: {
            usuarioId: params.id,
            restauranteId: tenant.restauranteId,
          },
          data: { rolId: data.rolId },
        })
        const base = await tx.restaurante.findUnique({
          where: { id: tenant.restauranteId },
          select: { organizacionId: true },
        })
        if (base?.organizacionId) {
          await tx.organizacionMiembro.updateMany({
            where: {
              usuarioId: params.id,
              organizacionId: base.organizacionId,
            },
            data: { rolId: data.rolId },
          })
        }
      }

      return updated
    })

    return NextResponse.json({
      success: true,
      data: usuario,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en PATCH /api/usuarios/[id]:')
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
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'staff.manage')
    const tenant = requireActiveTenant(user)
    await requireUserScopedToTenant(params.id, tenant.restauranteId)

    await prisma.usuario.update({
      where: { id: params.id },
      data: { activo: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en DELETE /api/usuarios/[id]:'
    )
  }
}
