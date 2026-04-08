import { createHash, randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
  requireRoleScopedToTenant,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

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
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'usuarios_roles')
    const tenant = requireActiveTenant(user)

    const invites = await prisma.invitacion.findMany({
      where: { restauranteId: tenant.restauranteId },
      orderBy: { createdAt: 'desc' },
      include: {
        rol: { select: { id: true, nombre: true, codigo: true } },
      },
      take: 100,
    })

    return NextResponse.json({ success: true, data: invites })
  } catch (error) {
    return toErrorResponse(error, 'Error al listar invitaciones', 'Error en GET /api/auth/invites:')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'usuarios_roles')
    const tenant = requireActiveTenant(user)

    const body = await request.json()
    const data = createSchema.parse(body)
    const email = data.email.trim().toLowerCase()
    const expiraHoras = data.expiraHoras ?? 72

    await requireRoleScopedToTenant(data.rolId, {
      restauranteId: tenant.restauranteId,
      organizacionId: tenant.organizacionId,
      actorRoleId: user.rolId,
    })

    const rol = await prisma.rol.findUnique({ where: { id: data.rolId } })
    if (!rol) {
      return NextResponse.json({ success: false, error: 'Rol no encontrado' }, { status: 404 })
    }

    const existingUser = await prisma.usuario.findUnique({
      where: {
        restauranteId_email: {
          restauranteId: tenant.restauranteId,
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
        restauranteId: tenant.restauranteId,
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
    return toErrorResponse(error, 'Error al crear invitación', 'Error en POST /api/auth/invites:')
  }
}
