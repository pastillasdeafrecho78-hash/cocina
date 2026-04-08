import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
  requireRoleScopedToTenant,
} from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'

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
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'staff.manage')
    const tenant = requireActiveTenant(user)
    await requireRoleScopedToTenant(params.id, {
      restauranteId: tenant.restauranteId,
      organizacionId: tenant.organizacionId,
      actorRoleId: user.rolId,
    })

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
        raise(400, 'Ya existe un rol con ese código')
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
    return toErrorResponse(error, 'Error interno del servidor', 'Error en PATCH /api/roles/[id]:')
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
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'staff.manage')
    const tenant = requireActiveTenant(user)
    await requireRoleScopedToTenant(params.id, {
      restauranteId: tenant.restauranteId,
      organizacionId: tenant.organizacionId,
      actorRoleId: user.rolId,
    })

    const rol = await prisma.rol.findUnique({
      where: { id: params.id },
      include: { _count: { select: { usuarios: true } } },
    })

    if (!rol) {
      raise(404, 'Rol no encontrado')
    }

    if (rol._count.usuarios > 0) {
      raise(
        400,
        `No se puede eliminar: el rol tiene ${rol._count.usuarios} usuario(s) asignado(s). Reasigna los usuarios antes de eliminar.`
      )
    }

    await prisma.rol.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en DELETE /api/roles/[id]:')
  }
}
