import { SignJWT, jwtVerify, type JWTPayload as JoseJWTPayload } from 'jose'

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || 'default-secret-key-change-in-production'
  return new TextEncoder().encode(secret)
}

export interface JWTPayload extends JoseJWTPayload {
  userId: string
  email: string
  rolId: string
}

export async function generateToken(payload: JWTPayload): Promise<string> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getJwtSecret())

  return token
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload as JWTPayload
  } catch {
    return null
  }
}

export function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization')
  return authHeader?.replace('Bearer ', '') || null
}
