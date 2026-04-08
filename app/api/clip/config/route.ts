import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encryptSecret } from '@/lib/configuracion-restaurante'
import { getClipApiKeyStatus } from '@/lib/clip-config'
import { z } from 'zod'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

const patchSchema = z.object({
  /** Credencial completa (Basic/Bearer) o token ya armado — alternativa a clipApiKey+clipSecretKey */
  apiKey: z.string().min(1).optional(),
  /** Desde dashboard Clip: Clave API (UUID) */
  clipApiKey: z.string().optional(),
  /** Desde dashboard Clip: Clave secreta (solo visible al crear; si no la tienes, crea credencial nueva) */
  clipSecretKey: z.string().optional(),
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
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'configuracion')
    const tenant = requireActiveTenant(user)
    const row = await prisma.integracionClip.findUnique({
      where: { restauranteId: tenant.restauranteId },
    })
    const keyStatus = await getClipApiKeyStatus(tenant.restauranteId)
    const n = await prisma.clipTerminal.count({ where: { restauranteId: tenant.restauranteId, activo: true } })
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
  } catch (error) {
    return toErrorResponse(error, 'Error interno', 'Error en GET /api/clip/config:')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'configuracion')
    const tenant = requireActiveTenant(user)
    const body = patchSchema.parse(await request.json())
    const data: {
      apiKeyEncrypted?: string | null
      webhookSecret?: string | null
      activo?: boolean
    } = {}
    if (body.clearApiKey) {
      data.apiKeyEncrypted = null
      data.activo = false
    } else if (body.clipApiKey !== undefined || body.clipSecretKey !== undefined) {
      const api = (body.clipApiKey ?? '').trim()
      const secret = (body.clipSecretKey ?? '').trim()
      if (!api || !secret) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Indica Clave API y Clave secreta del panel de Clip (ambas). Si no ves la secreta, crea una credencial nueva en el dashboard.',
          },
          { status: 400 }
        )
      }
      const basic = Buffer.from(`${api}:${secret}`, 'utf8').toString('base64')
      data.apiKeyEncrypted = encryptSecret(`Basic ${basic}`)
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
      where: { restauranteId: tenant.restauranteId },
      create: {
        restauranteId: tenant.restauranteId,
        apiKeyEncrypted: data.apiKeyEncrypted ?? null,
        webhookSecret: data.webhookSecret ?? null,
        activo: data.activo ?? false,
      },
      update: data,
    })
    await prisma.auditoria.create({
      data: {
        restauranteId: tenant.restauranteId,
        usuarioId: user.id,
        accion: 'ACTUALIZAR_CLIP_CONFIG',
        entidad: 'IntegracionClip',
        entidadId: tenant.restauranteId,
      },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
    }
    return toErrorResponse(error, 'Error interno', 'Error en PATCH /api/clip/config:')
  }
}
