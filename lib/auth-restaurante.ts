export { getSessionUser, type SessionUser } from './auth-server'

/**
 * Alias explícito para APIs: usuario autenticado con contexto de restaurante (tenant).
 */
export const requireRestauranteUsuario = async () => {
  const { getSessionUser } = await import('./auth-server')
  return getSessionUser()
}
