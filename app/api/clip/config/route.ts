import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { encryptSecret } from '@/lib/configuracion-restaurante'
import { getClipApiKeyStatus } from '@/lib/clip-config'
import { z } from 'zod'

const patchSchema = z.object({
  apiKey: z.string().min(1).optional(),
  clearApiKey: z.boolean().optional(),
  webhookSecret: z.string().optional(),
  activo: z.boolean().optional(),
})

export const dynamic = 'force-dynamic'

function normalizeCredentialInput(raw: string): string {
  let token = String(raw || '').trim()
  const headerMatch = token.match(/^authorization\s*:\s*(.+)$/i)
  if (headerMatch) token = headerMatch[1].trim()
  return token.replace(/^["']+|["']+$/g, '').replace(/\s+/g, ' ').trim()
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || !tienePermiso(user, 'configuracion')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }
    const row = await prisma.integracionClip.findUnique({
      where: { restauranteId: user.restauranteId },
    })
    const keyStatus = await getClipApiKeyStatus(user.restauranteId)
    const n = await prisma.clipTerminal.count({ where: { restauranteId: user.restauranteId, activo: true } })
    return NextResponse.json({
      success: true,
      data: {
        activo: row?.activo ?? false,
        hasApiKey: Boolean(row?.apiKeyEncrypted),
        hasApiKeyDecrypted: keyStatus.ok,
        apiKeyError: keyStatus.ok ? null : keyStatus.reason,
        clipReady: keyStatus.ok && Boolean(row?.activo),
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
    if (!user || !tienePermiso(user, 'configuracion')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }
    const body = patchSchema.parse(await request.json())
    const data: {
      apiKeyEncrypted?: string | null
      webhookSecret?: string | null
      activo?: boolean
    } = {}
    if (body.clearApiKey) {
      data.apiKeyEncrypted = null
      data.activo = false
    } else if (body.apiKey !== undefined) {
      const key = normalizeCredentialInput(body.apiKey)
      if (!key) {
        return NextResponse.json({ success: false, error: 'La API key no puede estar vacía' }, { status: 400 })
      }
      data.apiKeyEncrypted = encryptSecret(key)
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
