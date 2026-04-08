import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createAccessCode, hashAccessCode } from '@/lib/access-code'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
  requireOrganizationMembership,
  requireRoleScopedToTenant,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createSchema = z.object({
  expiraEnMinutos: z.number().int().min(5).max(60 * 24 * 7).default(60),
  rolId: z.string().min(1).optional(),
  organizacionId: z.string().min(1).optional(),
})

export async function GET() {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'usuarios_roles')
    const tenant = requireActiveTenant(user)

    const now = new Date()
    const rows = await prisma.codigoVinculacionSucursal.findMany({
      where: { restauranteId: tenant.restauranteId },
      include: {
        rol: { select: { id: true, nombre: true } },
        organizacion: { select: { id: true, nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        expiraEn: r.expiraEn,
        usadaEn: r.usadaEn,
        createdAt: r.createdAt,
        rol: r.rol,
        organizacion: r.organizacion,
        estado: r.usadaEn ? 'USADA' : r.expiraEn < now ? 'EXPIRADA' : 'ACTIVA',
      })),
    })
  } catch (error) {
    return toErrorResponse(error, 'No se pudo listar códigos', 'GET /api/auth/access-codes')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'usuarios_roles')
    const tenant = requireActiveTenant(user)
    const input = createSchema.parse(await request.json())
    if (input.rolId) {
      await requireRoleScopedToTenant(input.rolId, {
        restauranteId: tenant.restauranteId,
        organizacionId: tenant.organizacionId,
        actorRoleId: user.rolId,
      })
    }
    if (input.organizacionId) {
      await requireOrganizationMembership(user.id, input.organizacionId)
    }
    const code = createAccessCode(8)
    const expiraEn = new Date(Date.now() + input.expiraEnMinutos * 60 * 1000)
    const codigoHash = hashAccessCode(code)

    const record = await prisma.codigoVinculacionSucursal.create({
      data: {
        restauranteId: tenant.restauranteId,
        codigoHash,
        expiraEn,
        creadoPorId: user.id,
        rolId: input.rolId ?? null,
        organizacionId: input.organizacionId ?? null,
      },
      select: { id: true, expiraEn: true, createdAt: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: record.id,
        codigo: code,
        expiraEn: record.expiraEn,
        createdAt: record.createdAt,
        redeemUrl: `/acceso?code=${code}`,
      },
    })
  } catch (error) {
    return toErrorResponse(error, 'No se pudo generar el código', 'POST /api/auth/access-codes')
  }
}
