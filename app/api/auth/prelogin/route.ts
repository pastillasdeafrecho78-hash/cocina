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

    // Dos consultas simples (sin JOIN/include): algunos despliegues con PgBouncer fallan
    // con relaciones en una sola query aunque health y count() funcionen.
    const usuarios = await prisma.usuario.findMany({
      where: {
        email: normalizedEmail,
        activo: true,
        password: { not: null },
      },
      select: { restauranteId: true, password: true },
    })

    if (usuarios.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Credenciales incorrectas' },
        { status: 401 }
      )
    }

    const restauranteIds = [...new Set(usuarios.map((u) => u.restauranteId))]
    const restaurantes = await prisma.restaurante.findMany({
      where: { id: { in: restauranteIds }, activo: true },
      select: {
        id: true,
        nombre: true,
        slug: true,
        organizacion: {
          select: { id: true, nombre: true },
        },
      },
    })
    const metaPorRestaurante = new Map(
      restaurantes.map((r) => [
        r.id,
        {
          nombre: r.nombre,
          slug: r.slug,
          organizacionNombre: r.organizacion?.nombre ?? null,
        },
      ])
    )

    const matches: {
      restauranteId: string
      nombre: string
      slug: string | null
      organizacionNombre: string | null
    }[] = []
    for (const u of usuarios) {
      const meta = metaPorRestaurante.get(u.restauranteId)
      if (!meta || !u.password) continue
      const ok = await verifyPassword(password, u.password)
      if (ok) {
        matches.push({
          restauranteId: u.restauranteId,
          nombre: meta.nombre,
          slug: meta.slug,
          organizacionNombre: meta.organizacionNombre,
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
