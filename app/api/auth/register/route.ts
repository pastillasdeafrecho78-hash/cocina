import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { allocateUniqueRestaurantSlug, isValidRestaurantSlug } from '@/lib/slug'
import { rateLimitAuth } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({
  organizacionNombre: z.string().min(2).max(120),
  restauranteNombre: z.string().min(2).max(120),
  slug: z.string().max(64).optional(),
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

    const result = await prisma.$transaction(async (tx) => {
      const rawSlug = data.slug?.trim().toLowerCase()
      let slug: string
      if (rawSlug) {
        if (!isValidRestaurantSlug(rawSlug)) {
          throw Object.assign(new Error('SLUG_INVALID'), { code: 'SLUG_INVALID' })
        }
        const exists = await tx.restaurante.findFirst({ where: { slug: rawSlug } })
        if (exists) {
          throw Object.assign(new Error('SLUG_TAKEN'), { code: 'SLUG_TAKEN' })
        }
        slug = rawSlug
      } else {
        slug = await allocateUniqueRestaurantSlug(
          (s) => tx.restaurante.findFirst({ where: { slug: s }, select: { slug: true } }),
          data.restauranteNombre.trim()
        )
      }

      const rol =
        (await tx.rol.findFirst({ where: { codigo: 'admin' } })) ??
        (await tx.rol.findFirst())
      if (!rol) {
        throw Object.assign(new Error('NO_ROL'), { code: 'NO_ROL' })
      }

      const passwordHash = await hashPassword(data.password)

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
          activeRestauranteId: restaurante.id,
          activeOrganizacionId: org.id,
          rolId: rol.id,
        },
      })
      await tx.organizacionMiembro.create({
        data: {
          usuarioId: usuario.id,
          organizacionId: org.id,
          esOwner: true,
          activo: true,
        },
      })
      await tx.sucursalMiembro.create({
        data: {
          usuarioId: usuario.id,
          restauranteId: restaurante.id,
          activo: true,
          esPrincipal: true,
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
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    const code = error && typeof error === 'object' && 'code' in error ? (error as { code: string }).code : ''
    if (code === 'SLUG_INVALID') {
      return NextResponse.json(
        { success: false, error: 'Slug no válido o reservado' },
        { status: 400 }
      )
    }
    if (code === 'SLUG_TAKEN') {
      return NextResponse.json(
        { success: false, error: 'Ese identificador de restaurante ya está en uso' },
        { status: 409 }
      )
    }
    if (code === 'NO_ROL') {
      return NextResponse.json(
        { success: false, error: 'Configuración de roles incompleta' },
        { status: 500 }
      )
    }
    console.error('register:', error)
    return NextResponse.json(
      { success: false, error: 'Error al registrar' },
      { status: 500 }
    )
  }
}
