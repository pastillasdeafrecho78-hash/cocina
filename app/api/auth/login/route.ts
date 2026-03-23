import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, generateToken } from '@/lib/auth'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  /** Slug del restaurante (ej. principal). Por defecto se usa "principal". */
  slug: z.string().optional(),
})

async function getRolById(rolId: string | null | undefined) {
  if (!rolId) {
    return null
  }

  try {
    return await prisma.rol.findUnique({
      where: { id: rolId },
      select: {
        id: true,
        nombre: true,
        permisos: true,
      },
    })
  } catch (error) {
    console.error('No se pudo cargar el rol durante el login:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, slug } = loginSchema.parse(body)

    const restaurante = await prisma.restaurante.findFirst({
      where: slug
        ? { slug, activo: true }
        : { slug: 'principal', activo: true },
    })
    if (!restaurante) {
      return NextResponse.json(
        { success: false, error: 'Restaurante no encontrado' },
        { status: 404 }
      )
    }

    const user = await prisma.usuario.findUnique({
      where: {
        restauranteId_email: { restauranteId: restaurante.id, email },
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        password: true,
        rolId: true,
        activo: true,
        restauranteId: true,
      },
    })

    if (!user || !user.activo) {
      return NextResponse.json(
        { success: false, error: 'Credenciales inválidas' },
        { status: 401 }
      )
    }

    // Verificar contraseña
    const isValid = await verifyPassword(password, user.password)
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Credenciales inválidas' },
        { status: 401 }
      )
    }

    const rol = await getRolById(user.rolId)

    // Si falla un dato secundario, permitimos el login de todas formas.
    await prisma.usuario
      .update({
        where: { id: user.id },
        data: { ultimoAcceso: new Date() },
      })
      .catch((error) => {
        console.error('No se pudo actualizar ultimoAcceso:', error)
      })

    // Generar token
    const token = await generateToken({
      userId: user.id,
      email: user.email,
      rolId: user.rolId,
      restauranteId: user.restauranteId,
    })

    await prisma.auditoria
      .create({
        data: {
          restauranteId: user.restauranteId,
          usuarioId: user.id,
          accion: 'LOGIN',
          entidad: 'Usuario',
          entidadId: user.id,
        },
      })
      .catch((error) => {
        console.error('No se pudo registrar auditoria de login:', error)
      })

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          apellido: user.apellido,
          restauranteId: user.restauranteId,
          restaurante: {
            id: restaurante.id,
            nombre: restaurante.nombre,
            slug: restaurante.slug,
          },
          rol: rol
            ? {
                id: rol.id,
                nombre: rol.nombre,
                permisos: rol.permisos,
              }
            : null,
        },
        token,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    const err = error instanceof Error ? error : new Error(String(error))
    console.error('Error en login:', err.message, err.cause ?? err.stack)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}








