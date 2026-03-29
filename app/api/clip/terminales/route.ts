import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { z } from 'zod'

const postSchema = z.object({
  serialNumber: z.string().min(1),
  nombre: z.string().optional(),
})

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || !tienePermiso(user, 'caja')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }
    const list = await prisma.clipTerminal.findMany({
      where: { restauranteId: user.restauranteId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: list })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || !tienePermiso(user, 'caja')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }
    const body = postSchema.parse(await request.json())
    const row = await prisma.clipTerminal.upsert({
      where: {
        restauranteId_serialNumber: {
          restauranteId: user.restauranteId,
          serialNumber: body.serialNumber.trim(),
        },
      },
      create: {
        restauranteId: user.restauranteId,
        serialNumber: body.serialNumber.trim(),
        nombre: body.nombre?.trim() || null,
        activo: true,
      },
      update: {
        nombre: body.nombre?.trim() || null,
        activo: true,
      },
    })
    return NextResponse.json({ success: true, data: row })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
    }
    console.error(e)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}
