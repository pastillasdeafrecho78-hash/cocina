import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'

const createRolSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  codigo: z.string().optional().nullable(),
  descripcion: z.string().optional().nullable(),
  permisos: z.array(z.string()).min(1, 'Debe incluir al menos un permiso'),
})

/**
 * GET /api/roles
 * Lista todos los roles. Solo usuarios con permiso usuarios_roles.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'staff.manage')
    const tenant = requireActiveTenant(user)

    const branchRoleRows = await prisma.sucursalMiembro.findMany({
      where: { restauranteId: tenant.restauranteId, activo: true, rolId: { not: null } },
      select: { rolId: true },
    })
    const orgRoleRows = tenant.organizacionId
      ? await prisma.organizacionMiembro.findMany({
          where: { organizacionId: tenant.organizacionId, activo: true, rolId: { not: null } },
          select: { rolId: true },
        })
      : []
    const userRoleRows = await prisma.usuario.findMany({
      where: { restauranteId: tenant.restauranteId, activo: true },
      select: { rolId: true },
    })

    const roleIds = Array.from(
      new Set(
        [user.rolId, ...branchRoleRows, ...orgRoleRows, ...userRoleRows]
          .map((r) => (typeof r === 'string' ? r : r.rolId))
          .filter((id): id is string => Boolean(id))
      )
    )

    const roles = await prisma.rol.findMany({
      where: { id: { in: roleIds } },
      include: {
        _count: {
          select: { usuarios: true },
        },
      },
      orderBy: { nombre: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: roles.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        codigo: r.codigo,
        descripcion: r.descripcion,
        permisos: r.permisos as string[],
        numUsuarios: r._count.usuarios,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/roles:')
  }
}

/**
 * POST /api/roles
 * Crea un nuevo rol. Solo usuarios con permiso usuarios_roles.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'staff.manage')
    const tenant = requireActiveTenant(user)

    const body = await request.json()
    const data = createRolSchema.parse(body)

    if (data.codigo) {
      const existente = await prisma.rol.findUnique({
        where: { codigo: data.codigo },
      })
      if (existente) {
        raise(400, 'Ya existe un rol con ese código')
      }
    }

    const rol = await prisma.rol.create({
      data: {
        nombre: data.nombre,
        codigo: data.codigo || null,
        descripcion: data.descripcion || null,
        permisos: data.permisos,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: rol.id,
          nombre: rol.nombre,
          codigo: rol.codigo,
          descripcion: rol.descripcion,
          permisos: rol.permisos as string[],
        },
      },
      { status: 201 }
    )
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/roles:')
  }
}
