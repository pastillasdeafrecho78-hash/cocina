import { AUTH_COOKIE_NAME } from './auth-cookies'

const MAX_AGE_SECONDS = 86400 // 24h, alineado con JWT en auth-jwt.ts

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Valor completo del header Set-Cookie para la sesión (JWT HttpOnly).
 */
export function buildAuthSetCookieHeader(token: string): string {
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${MAX_AGE_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (isProduction()) {
    parts.push('Secure')
  }
  return parts.join('; ')
}

/**
 * Limpia la cookie de sesión en el navegador (mismo Path/flags que al crear).
 */
export function buildClearAuthSetCookieHeader(): string {
  const parts = [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (isProduction()) {
    parts.push('Secure')
  }
  return parts.join('; ')
}
