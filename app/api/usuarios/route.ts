import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken, getTokenFromRequest, hashPassword } from '@/lib/auth'
import { tienePermiso } from '@/lib/permisos'
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
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'usuarios_roles')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const usuarios = await prisma.usuario.findMany({
      where: { restauranteId: user.restauranteId },
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
    console.error('Error en GET /api/usuarios:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/usuarios
 * Crea un nuevo usuario. Solo usuarios con permiso usuarios_roles.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'usuarios_roles')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const data = createUsuarioSchema.parse(body)

    const rol = await prisma.rol.findUnique({ where: { id: data.rolId } })
    if (!rol) {
      return NextResponse.json({ success: false, error: 'Rol no encontrado' }, { status: 404 })
    }

    const existente = await prisma.usuario.findUnique({
      where: {
        restauranteId_email: {
          restauranteId: user.restauranteId,
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

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        restauranteId: user.restauranteId,
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

    return NextResponse.json(
      {
        success: true,
        data: nuevoUsuario,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error en POST /api/usuarios:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
