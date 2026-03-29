import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { rateLimitAuth } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
})

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimitAuth(`prelogin:${ip}`)
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'Demasiados intentos. Espera un minuto.' },
      { status: 429 }
    )
  }

  try {
    const json = await request.json()
    const { email, password } = bodySchema.parse(json)
    const normalizedEmail = email.trim().toLowerCase()

    const candidates = await prisma.usuario.findMany({
      where: {
        email: normalizedEmail,
        activo: true,
        password: { not: null },
        restaurante: { activo: true },
      },
      include: {
        restaurante: { select: { id: true, nombre: true } },
      },
    })

    const matches: { restauranteId: string; nombre: string }[] = []
    for (const u of candidates) {
      if (!u.password) continue
      const ok = await verifyPassword(password, u.password)
      if (ok) {
        matches.push({
          restauranteId: u.restauranteId,
          nombre: u.restaurante.nombre,
        })
      }
    }

    if (matches.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Credenciales incorrectas' },
        { status: 401 }
      )
    }

    if (matches.length === 1) {
      return NextResponse.json({
        ok: true,
        mode: 'single',
        restauranteId: matches[0].restauranteId,
      })
    }

    return NextResponse.json({
      ok: true,
      mode: 'choose',
      options: matches,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 })
    }
    console.error('prelogin:', error)
    return NextResponse.json({ ok: false, error: 'Error al iniciar sesión' }, { status: 500 })
  }
}
