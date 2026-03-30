import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { listClipTerminals, upsertClipTerminal, isMissingColumnError } from '@/lib/clip-terminal-compat'
import { z } from 'zod'

const postSchema = z.object({
  serialNumber: z.string().min(1),
  nombre: z.string().optional(),
  isDefault: z.boolean().optional(),
})

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || (!tienePermiso(user, 'configuracion') && !tienePermiso(user, 'caja') && !tienePermiso(user, 'comandas'))) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }
    const list = await listClipTerminals(prisma, user.restauranteId)
    return NextResponse.json({ success: true, data: list })
  } catch (e) {
    console.error(e)
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || !tienePermiso(user, 'configuracion')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }
    const body = postSchema.parse(await request.json())
    const row = await upsertClipTerminal(prisma, {
      restauranteId: user.restauranteId,
      serialNumber: body.serialNumber.trim(),
      nombre: body.nombre?.trim() || null,
    })
    return NextResponse.json({ success: true, data: row })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
    }
    console.error(e)
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
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
      select: { id: true },
    })
    if (!terminal) {
      return NextResponse.json({ success: false, error: 'Terminal no encontrada o inactiva' }, { status: 404 })
    }
    try {
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
    } catch (err) {
      if (isMissingColumnError(err, 'isDefault')) {
        return NextResponse.json(
          {
            success: false,
            error: 'La columna de terminal predeterminada aún no está en la base. Redeploy tras migraciones.',
          },
          { status: 409 }
        )
      }
      throw err
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
    }
    console.error(e)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}
