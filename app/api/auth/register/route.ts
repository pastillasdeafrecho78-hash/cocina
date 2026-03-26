import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { isValidRestaurantSlug } from '@/lib/slug'
import { rateLimitAuth } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({
  organizacionNombre: z.string().min(2).max(120),
  restauranteNombre: z.string().min(2).max(120),
  slug: z.string().min(2).max(64),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  nombre: z.string().min(1).max(80),
  apellido: z.string().min(1).max(80),
})

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimitAuth(`register:${ip}`)
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: 'Demasiados intentos. Espera un minuto.' },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()
    const data = schema.parse(body)
    const slug = data.slug.trim().toLowerCase()

    if (!isValidRestaurantSlug(slug)) {
      return NextResponse.json(
        { success: false, error: 'Slug no válido o reservado' },
        { status: 400 }
      )
    }

    const exists = await prisma.restaurante.findFirst({ where: { slug } })
    if (exists) {
      return NextResponse.json(
        { success: false, error: 'Ese identificador de restaurante ya está en uso' },
        { status: 409 }
      )
    }

    const rol =
      (await prisma.rol.findFirst({ where: { codigo: 'admin' } })) ??
      (await prisma.rol.findFirst())
    if (!rol) {
      return NextResponse.json(
        { success: false, error: 'Configuración de roles incompleta' },
        { status: 500 }
      )
    }

    const passwordHash = await hashPassword(data.password)

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organizacion.create({
        data: { nombre: data.organizacionNombre.trim() },
      })
      const restaurante = await tx.restaurante.create({
        data: {
          nombre: data.restauranteNombre.trim(),
          slug,
          organizacionId: org.id,
        },
      })
      const usuario = await tx.usuario.create({
        data: {
          email: data.email.trim().toLowerCase(),
          nombre: data.nombre.trim(),
          apellido: data.apellido.trim(),
          password: passwordHash,
          restauranteId: restaurante.id,
          rolId: rol.id,
        },
      })
      await tx.auditoria.create({
        data: {
          restauranteId: restaurante.id,
          usuarioId: usuario.id,
          accion: 'REGISTRO_ORG',
          entidad: 'Organizacion',
          entidadId: org.id,
          detalles: { slug },
        },
      })
      return { org, restaurante, usuario }
    })

    return NextResponse.json({
      success: true,
      data: {
        restauranteId: result.restaurante.id,
        slug: result.restaurante.slug,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('register:', error)
    return NextResponse.json(
      { success: false, error: 'Error al registrar' },
      { status: 500 }
    )
  }
}
