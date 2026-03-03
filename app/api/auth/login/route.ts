import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, generateToken } from '@/lib/auth'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    // Buscar usuario
    const user = await prisma.usuario.findUnique({
      where: { email },
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

    // Actualizar último acceso
    await prisma.usuario.update({
      where: { id: user.id },
      data: { ultimoAcceso: new Date() },
    })

    // Generar token
    const token = await generateToken({
      userId: user.id,
      email: user.email,
      rol: user.rol,
    })

    // Registrar auditoría
    await prisma.auditoria.create({
      data: {
        usuarioId: user.id,
        accion: 'LOGIN',
        entidad: 'Usuario',
        entidadId: user.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          apellido: user.apellido,
          rol: user.rol,
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

    console.error('Error en login:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}








