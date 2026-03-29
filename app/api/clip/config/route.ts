import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { encryptSecret } from '@/lib/configuracion-restaurante'
import { z } from 'zod'

const patchSchema = z.object({
  apiKey: z.string().min(1).optional(),
  webhookSecret: z.string().optional(),
  activo: z.boolean().optional(),
})

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || !tienePermiso(user, 'caja')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }
    const row = await prisma.integracionClip.findUnique({
      where: { restauranteId: user.restauranteId },
    })
    const n = await prisma.clipTerminal.count({ where: { restauranteId: user.restauranteId, activo: true } })
    return NextResponse.json({
      success: true,
      data: {
        activo: row?.activo ?? false,
        hasApiKey: Boolean(row?.apiKeyEncrypted),
        hasWebhookSecret: Boolean(row?.webhookSecret),
        terminalesRegistradas: n,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || !tienePermiso(user, 'caja')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }
    const body = patchSchema.parse(await request.json())
    const data: {
      apiKeyEncrypted?: string
      webhookSecret?: string | null
      activo?: boolean
    } = {}
    if (body.apiKey !== undefined) {
      data.apiKeyEncrypted = encryptSecret(body.apiKey)
    }
    if (body.webhookSecret !== undefined) {
      data.webhookSecret = body.webhookSecret ? encryptSecret(body.webhookSecret) : null
    }
    if (body.activo !== undefined) {
      data.activo = body.activo
    }
    await prisma.integracionClip.upsert({
      where: { restauranteId: user.restauranteId },
      create: {
        restauranteId: user.restauranteId,
        apiKeyEncrypted: data.apiKeyEncrypted ?? null,
        webhookSecret: data.webhookSecret ?? null,
        activo: data.activo ?? false,
      },
      update: data,
    })
    await prisma.auditoria.create({
      data: {
        restauranteId: user.restauranteId,
        usuarioId: user.id,
        accion: 'ACTUALIZAR_CLIP_CONFIG',
        entidad: 'IntegracionClip',
        entidadId: user.restauranteId,
      },
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
    }
    console.error(e)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}
