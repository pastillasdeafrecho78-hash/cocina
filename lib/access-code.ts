import { createHash, randomBytes } from 'crypto'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function normalizeAccessCode(code: string) {
  return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

export function hashAccessCode(code: string) {
  return createHash('sha256').update(normalizeAccessCode(code)).digest('hex')
}

export function createAccessCode(length = 8) {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return out
}
