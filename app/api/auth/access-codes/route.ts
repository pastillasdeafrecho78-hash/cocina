import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { tienePermiso } from '@/lib/permisos'
import { createAccessCode, hashAccessCode } from '@/lib/access-code'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createSchema = z.object({
  expiraEnMinutos: z.number().int().min(5).max(60 * 24 * 7).default(60),
  rolId: z.string().min(1).optional(),
  organizacionId: z.string().min(1).optional(),
})

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
  }
  if (!tienePermiso(user, 'usuarios_roles')) {
    return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
  }
  if (!user.activeRestauranteId) {
    return NextResponse.json(
      { success: false, error: 'No hay sucursal activa para listar códigos' },
      { status: 400 }
    )
  }

  const now = new Date()
  const rows = await prisma.codigoVinculacionSucursal.findMany({
    where: { restauranteId: user.activeRestauranteId },
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
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
  }
  if (!tienePermiso(user, 'usuarios_roles')) {
    return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
  }
  if (!user.activeRestauranteId) {
    return NextResponse.json(
      { success: false, error: 'No hay sucursal activa para generar código' },
      { status: 400 }
    )
  }

  try {
    const input = createSchema.parse(await request.json())
    const code = createAccessCode(8)
    const expiraEn = new Date(Date.now() + input.expiraEnMinutos * 60 * 1000)
    const codigoHash = hashAccessCode(code)

    const record = await prisma.codigoVinculacionSucursal.create({
      data: {
        restauranteId: user.activeRestauranteId,
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('POST /api/auth/access-codes', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo generar el código' },
      { status: 500 }
    )
  }
}
