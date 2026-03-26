import { SignJWT, jwtVerify, type JWTPayload as JoseJWTPayload } from 'jose'
import { AUTH_COOKIE_NAME } from './auth-cookies'

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET no está configurado o es inválido. Define JWT_SECRET en variables de entorno (mín. 32 caracteres).'
    )
  }
  return new TextEncoder().encode(secret)
}

export interface JWTPayload extends JoseJWTPayload {
  userId: string
  email: string
  rolId: string
  restauranteId: string
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
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  return token || null
}

function parseCookieHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(';')
  const prefix = `${name}=`
  for (const part of parts) {
    const p = part.trim()
    if (p.startsWith(prefix)) {
      try {
        return decodeURIComponent(p.slice(prefix.length))
      } catch {
        return p.slice(prefix.length)
      }
    }
  }
  return null
}

/**
 * Cookie HttpOnly (prioridad) o Authorization Bearer (compatibilidad).
 */
export function getAuthTokenFromRequest(request: Request): string | null {
  const fromCookie = parseCookieHeader(request.headers.get('cookie'), AUTH_COOKIE_NAME)
  if (fromCookie) return fromCookie
  return getTokenFromRequest(request)
}
