import { createHash, randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createSchema = z.object({
  email: z.string().email(),
  rolId: z.string().min(1),
  expiraHoras: z.number().int().min(1).max(24 * 30).optional(),
})

function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'usuarios_roles')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const invites = await prisma.invitacion.findMany({
      where: { restauranteId: user.restauranteId },
      orderBy: { createdAt: 'desc' },
      include: {
        rol: { select: { id: true, nombre: true, codigo: true } },
      },
      take: 100,
    })

    return NextResponse.json({ success: true, data: invites })
  } catch (error) {
    console.error('Error en GET /api/auth/invites:', error)
    return NextResponse.json(
      { success: false, error: 'Error al listar invitaciones' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'usuarios_roles')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const data = createSchema.parse(body)
    const email = data.email.trim().toLowerCase()
    const expiraHoras = data.expiraHoras ?? 72

    const rol = await prisma.rol.findUnique({ where: { id: data.rolId } })
    if (!rol) {
      return NextResponse.json({ success: false, error: 'Rol no encontrado' }, { status: 404 })
    }

    const existingUser = await prisma.usuario.findUnique({
      where: {
        restauranteId_email: {
          restauranteId: user.restauranteId,
          email,
        },
      },
    })
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un usuario con este email' },
        { status: 409 }
      )
    }

    const rawToken = randomBytes(24).toString('base64url')
    const tokenHash = hashToken(rawToken)
    const expiraEn = new Date(Date.now() + expiraHoras * 60 * 60 * 1000)

    const invite = await prisma.invitacion.create({
      data: {
        restauranteId: user.restauranteId,
        email,
        rolId: data.rolId,
        tokenHash,
        expiraEn,
        creadoPorId: user.id,
      },
      select: {
        id: true,
        email: true,
        expiraEn: true,
        createdAt: true,
      },
    })

    const origin = request.nextUrl.origin
    const inviteUrl = `${origin}/accept-invite?token=${rawToken}`

    return NextResponse.json({
      success: true,
      data: {
        ...invite,
        inviteUrl,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error en POST /api/auth/invites:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear invitación' },
      { status: 500 }
    )
  }
}
