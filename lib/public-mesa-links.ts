import { randomBytes } from 'crypto'
import { hashSecretToken } from '@/lib/public-ordering'

export function createMesaPublicCode(): { raw: string; hash: string } {
  const raw = `mesa_${randomBytes(8).toString('hex')}`
  return {
    raw,
    hash: hashSecretToken(raw),
  }
}
