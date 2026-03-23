import * as crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { decryptSecret } from '@/lib/configuracion-restaurante'

export async function getClipApiKey(restauranteId: string): Promise<string | null> {
  const row = await prisma.integracionClip.findUnique({
    where: { restauranteId },
  })
  if (!row?.activo || !row.apiKeyEncrypted) return null
  try {
    return decryptSecret(row.apiKeyEncrypted)
  } catch {
    return null
  }
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
