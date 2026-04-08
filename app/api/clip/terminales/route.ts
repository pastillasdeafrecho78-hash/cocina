import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { listClipTerminals, upsertClipTerminal, isMissingColumnError } from '@/lib/clip-terminal-compat'
import { z } from 'zod'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

const postSchema = z.object({
  serialNumber: z.string().min(1),
  nombre: z.string().optional(),
  isDefault: z.boolean().optional(),
})

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['configuracion', 'caja', 'comandas'])
    const tenant = requireActiveTenant(user)
    const list = await listClipTerminals(prisma, tenant.restauranteId)
    return NextResponse.json({ success: true, data: list })
  } catch (error) {
    return toErrorResponse(error, 'Error interno', 'Error en GET /api/clip/terminales:')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'configuracion')
    const tenant = requireActiveTenant(user)
    const body = postSchema.parse(await request.json())
    const row = await upsertClipTerminal(prisma, {
      restauranteId: tenant.restauranteId,
      serialNumber: body.serialNumber.trim(),
      nombre: body.nombre?.trim() || null,
    })
    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
    }
    return toErrorResponse(error, 'Error interno', 'Error en POST /api/clip/terminales:')
  }
}

const patchSchema = z.object({
  terminalId: z.string().min(1),
})

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'configuracion')
    const tenant = requireActiveTenant(user)
    const body = patchSchema.parse(await request.json())
    const terminal = await prisma.clipTerminal.findFirst({
      where: { id: body.terminalId, restauranteId: tenant.restauranteId, activo: true },
      select: { id: true },
    })
    if (!terminal) {
      return NextResponse.json({ success: false, error: 'Terminal no encontrada o inactiva' }, { status: 404 })
    }
    try {
      await prisma.$transaction([
        prisma.clipTerminal.updateMany({
          where: { restauranteId: tenant.restauranteId },
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
    }
    return toErrorResponse(error, 'Error interno', 'Error en PATCH /api/clip/terminales:')
  }
}
