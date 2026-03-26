/**
 * Nombre de la cookie HttpOnly de sesión (JWT). Se establece solo desde Route Handlers.
 */

export const AUTH_COOKIE_NAME = 'auth_token'

/** @deprecated La sesión es HttpOnly; usar POST /api/auth/logout. No-op seguro. */
export function setAuthCookie(_token: string) {
  if (typeof document === 'undefined') return
}

/** Limpia caché local; la cookie HttpOnly la borra POST /api/auth/logout. */
export function clearAuthCookie() {
  if (typeof document === 'undefined') return
}
