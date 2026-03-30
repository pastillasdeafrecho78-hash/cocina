import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
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
    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Cuerpo JSON inválido' }, { status: 400 })
    }
    const { email, password } = bodySchema.parse(json)
    const normalizedEmail = email.trim().toLowerCase()

    const { prisma } = await import('@/lib/prisma')
    const { verifyPassword } = await import('@/lib/password')

    // Sin filtro anidado en `where` (mejor compatibilidad con PgBouncer / pooler Supabase).
    const candidates = await prisma.usuario.findMany({
      where: {
        email: normalizedEmail,
        activo: true,
        password: { not: null },
      },
      include: {
        restaurante: { select: { id: true, nombre: true, activo: true } },
      },
    })

    const matches: { restauranteId: string; nombre: string }[] = []
    for (const u of candidates) {
      if (!u.restaurante?.activo || !u.password) continue
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
    const msg = error instanceof Error ? error.message : String(error)
    const name = error instanceof Error ? error.name : 'unknown'
    console.error('prelogin:', name, msg, error)
    return NextResponse.json({ ok: false, error: 'Error al iniciar sesión' }, { status: 500 })
  }
}
