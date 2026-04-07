import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { ensurePendingAccessContext } from '@/lib/onboarding'
import { rateLimitAuth } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  nombre: z.string().min(1).max(80),
  apellido: z.string().min(1).max(80),
})

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimitAuth(`register-user:${ip}`)
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: 'Demasiados intentos. Espera un minuto.' },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()
    const data = schema.parse(body)
    const email = data.email.trim().toLowerCase()

    const exists = await prisma.usuario.findFirst({
      where: { email, activo: true },
      select: { id: true },
    })
    if (exists) {
      return NextResponse.json(
        { success: false, error: 'Ya existe una cuenta con ese email' },
        { status: 409 }
      )
    }

    const passwordHash = await hashPassword(data.password)
    const pending = await ensurePendingAccessContext(prisma)

    const user = await prisma.usuario.create({
      data: {
        email,
        nombre: data.nombre.trim(),
        apellido: data.apellido.trim(),
        password: passwordHash,
        rolId: pending.rolId,
        restauranteId: pending.restauranteId,
        activeRestauranteId: null,
        activeOrganizacionId: null,
      },
      select: {
        id: true,
        email: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        restauranteId: pending.restauranteId,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('register-user:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear cuenta' },
      { status: 500 }
    )
  }
}
