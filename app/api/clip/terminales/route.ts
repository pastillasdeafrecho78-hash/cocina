import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { z } from 'zod'

const postSchema = z.object({
  serialNumber: z.string().min(1),
  nombre: z.string().optional(),
  isDefault: z.boolean().optional(),
})

export const dynamic = 'force-dynamic'

function isMissingIsDefaultColumnError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2022'
  )
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || (!tienePermiso(user, 'configuracion') && !tienePermiso(user, 'caja') && !tienePermiso(user, 'comandas'))) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }
    let list = await prisma.clipTerminal.findMany({
      where: { restauranteId: user.restauranteId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
    // Backward compatibility while a pending migration exists in production.
    // If isDefault column is missing, return terminals without breaking config/cobro flow.
    if (!list) {
      list = []
    }
    return NextResponse.json({ success: true, data: list })
  } catch (e) {
    if (isMissingIsDefaultColumnError(e)) {
      const user = await getSessionUser()
      if (!user) {
        return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
      }
      const list = await prisma.clipTerminal.findMany({
        where: { restauranteId: user.restauranteId },
        orderBy: [{ createdAt: 'desc' }],
      })
      return NextResponse.json({
        success: true,
        data: list.map((terminal) => ({ ...terminal, isDefault: false })),
      })
    }
    console.error(e)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || !tienePermiso(user, 'configuracion')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }
    const body = postSchema.parse(await request.json())
    let row
    try {
      const activeCount = await prisma.clipTerminal.count({
        where: { restauranteId: user.restauranteId, activo: true },
      })
      const shouldBeDefault = body.isDefault === true || activeCount === 0
      if (shouldBeDefault) {
        await prisma.clipTerminal.updateMany({
          where: { restauranteId: user.restauranteId },
          data: { isDefault: false },
        })
      }
      row = await prisma.clipTerminal.upsert({
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
          isDefault: shouldBeDefault,
        },
        update: {
          nombre: body.nombre?.trim() || null,
          activo: true,
          isDefault: shouldBeDefault,
        },
      })
    } catch (error) {
      if (!isMissingIsDefaultColumnError(error)) throw error
      row = await prisma.clipTerminal.upsert({
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
      return NextResponse.json({
        success: true,
        data: { ...row, isDefault: false },
        warning: 'Terminal registrada. Falta aplicar migración de default en producción.',
      })
    }
    return NextResponse.json({ success: true, data: row })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
    }
    console.error(e)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

const patchSchema = z.object({
  terminalId: z.string().min(1),
})

export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || !tienePermiso(user, 'configuracion')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }
    const body = patchSchema.parse(await request.json())
    const terminal = await prisma.clipTerminal.findFirst({
      where: { id: body.terminalId, restauranteId: user.restauranteId, activo: true },
    })
    if (!terminal) {
      return NextResponse.json({ success: false, error: 'Terminal no encontrada o inactiva' }, { status: 404 })
    }
    await prisma.$transaction([
      prisma.clipTerminal.updateMany({
        where: { restauranteId: user.restauranteId },
        data: { isDefault: false },
      }),
      prisma.clipTerminal.update({
        where: { id: body.terminalId },
        data: { isDefault: true },
      }),
    ])
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
    }
    if (isMissingIsDefaultColumnError(e)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Falta aplicar migración de terminal predeterminada. Reintenta después del deploy.',
        },
        { status: 409 }
      )
    }
    console.error(e)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}
