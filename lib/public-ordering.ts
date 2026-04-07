import { createHash, randomBytes } from 'crypto'

export function hashSecretToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

export function createPublicTrackingToken(): { raw: string; hash: string } {
  const raw = randomBytes(24).toString('base64url')
  return {
    raw,
    hash: hashSecretToken(raw),
  }
}

export function createExternalApiKey(): { raw: string; hash: string } {
  const raw = `cocina_${randomBytes(24).toString('hex')}`
  return {
    raw,
    hash: hashSecretToken(raw),
  }
}
