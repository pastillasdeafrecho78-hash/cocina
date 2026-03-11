import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, generateToken } from '@/lib/auth'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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
    const { email, password } = loginSchema.parse(body)

    // Buscar usuario base; el rol se carga aparte para no bloquear el login.
    const user = await prisma.usuario.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        password: true,
        rolId: true,
        activo: true,
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
    })

    await prisma.auditoria
      .create({
        data: {
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








