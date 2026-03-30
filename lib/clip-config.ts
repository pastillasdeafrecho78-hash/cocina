import * as crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { decryptSecret } from '@/lib/configuracion-restaurante'

export type ClipApiKeyStatus =
  | { ok: true; apiKey: string }
  | { ok: false; reason: 'INACTIVE' | 'MISSING_KEY' | 'DECRYPT_FAILED' }

export async function getClipApiKeyStatus(restauranteId: string): Promise<ClipApiKeyStatus> {
  const row = await prisma.integracionClip.findUnique({
    where: { restauranteId },
  })
  if (!row?.activo) return { ok: false, reason: 'INACTIVE' }
  if (!row.apiKeyEncrypted) return { ok: false, reason: 'MISSING_KEY' }
  try {
    const apiKey = decryptSecret(row.apiKeyEncrypted).trim()
    if (!apiKey) return { ok: false, reason: 'MISSING_KEY' }
    return { ok: true, apiKey }
  } catch {
    return { ok: false, reason: 'DECRYPT_FAILED' }
  }
}

export async function getClipApiKey(restauranteId: string): Promise<string | null> {
  const status = await getClipApiKeyStatus(restauranteId)
  return status.ok ? status.apiKey : null
}

export async function verifyClipWebhookToken(restauranteId: string, headerToken: string | null): Promise<boolean> {
  const row = await prisma.integracionClip.findUnique({
    where: { restauranteId },
  })
  if (!row?.webhookSecret) return true
  try {
    const expected = decryptSecret(row.webhookSecret)
    if (!expected) return true
    if (!headerToken) return false
    return timingSafeEqual(headerToken, expected)
  } catch {
    return false
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a)
    const bb = Buffer.from(b)
    if (ba.length !== bb.length) return false
    return crypto.timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}
