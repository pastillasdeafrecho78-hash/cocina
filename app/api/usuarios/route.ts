import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
  requireRoleScopedToTenant,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'
import { z } from 'zod'

const createUsuarioSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  apellido: z.string().min(1, 'El apellido es requerido'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  rolId: z.string().min(1, 'El rol es requerido'),
})

/**
 * GET /api/usuarios
 * Lista usuarios. Solo usuarios con permiso usuarios_roles.
 */
export async function GET(_request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'usuarios_roles')
    const tenant = requireActiveTenant(user)

    const usuarios = await prisma.usuario.findMany({
      where: { restauranteId: tenant.restauranteId },
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
        ultimoAcceso: true,
      },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    })

    return NextResponse.json({
      success: true,
      data: usuarios,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/usuarios:')
  }
}

/**
 * POST /api/usuarios
 * Crea un nuevo usuario. Solo usuarios con permiso usuarios_roles.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'usuarios_roles')
    const tenant = requireActiveTenant(user)

    const body = await request.json()
    const data = createUsuarioSchema.parse(body)
    await requireRoleScopedToTenant(data.rolId, {
      restauranteId: tenant.restauranteId,
      organizacionId: tenant.organizacionId,
      actorRoleId: user.effectiveRolId ?? user.rolId,
    })

    const rol = await prisma.rol.findUnique({ where: { id: data.rolId } })
    if (!rol) {
      return NextResponse.json({ success: false, error: 'Rol no encontrado' }, { status: 404 })
    }

    const existente = await prisma.usuario.findUnique({
      where: {
        restauranteId_email: {
          restauranteId: tenant.restauranteId,
          email: data.email.toLowerCase().trim(),
        },
      },
    })
    if (existente) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un usuario con ese email' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(data.password)

    const nuevoUsuario = await prisma.$transaction(async (tx) => {
      const baseRestaurante = await tx.restaurante.findUnique({
        where: { id: tenant.restauranteId },
        select: { organizacionId: true },
      })

      const created = await tx.usuario.create({
        data: {
          restauranteId: tenant.restauranteId,
          activeRestauranteId: tenant.restauranteId,
          activeOrganizacionId: baseRestaurante?.organizacionId ?? null,
          nombre: data.nombre.trim(),
          apellido: data.apellido.trim(),
          email: data.email.toLowerCase().trim(),
          password: hashedPassword,
          rolId: data.rolId,
        },
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
        },
      })

      await tx.sucursalMiembro.upsert({
        where: {
          usuarioId_restauranteId: {
            usuarioId: created.id,
            restauranteId: tenant.restauranteId,
          },
        },
        create: {
          usuarioId: created.id,
          restauranteId: tenant.restauranteId,
          rolId: data.rolId,
          esPrincipal: true,
          activo: true,
        },
        update: {
          activo: true,
          rolId: data.rolId,
        },
      })

      if (baseRestaurante?.organizacionId) {
        await tx.organizacionMiembro.upsert({
          where: {
            usuarioId_organizacionId: {
              usuarioId: created.id,
              organizacionId: baseRestaurante.organizacionId,
            },
          },
          create: {
            usuarioId: created.id,
            organizacionId: baseRestaurante.organizacionId,
            rolId: data.rolId,
            esOwner: false,
            activo: true,
          },
          update: {
            activo: true,
            rolId: data.rolId,
          },
        })
      }

      return created
    })

    return NextResponse.json(
      {
        success: true,
        data: nuevoUsuario,
      },
      { status: 201 }
    )
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/usuarios:')
  }
}
