import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashAccessCode, normalizeAccessCode } from '@/lib/access-code'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({
  code: z.string().min(4).max(64),
})

export async function POST(request: NextRequest) {
  try {
    const { code } = schema.parse(await request.json())
    const hash = hashAccessCode(normalizeAccessCode(code))
    const row = await prisma.codigoVinculacionSucursal.findUnique({
      where: { codigoHash: hash },
      include: {
        restaurante: {
          select: {
            id: true,
            nombre: true,
            organizacion: { select: { id: true, nombre: true } },
          },
        },
        rol: { select: { id: true, nombre: true } },
      },
    })

    if (!row) {
      return NextResponse.json({ success: false, error: 'Código no encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        valido: !row.usadaEn && row.expiraEn > new Date(),
        usadaEn: row.usadaEn,
        expiraEn: row.expiraEn,
        restaurante: row.restaurante,
        rol: row.rol,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('POST /api/auth/access-codes/preview', error)
    return NextResponse.json({ success: false, error: 'Error al validar código' }, { status: 500 })
  }
}
