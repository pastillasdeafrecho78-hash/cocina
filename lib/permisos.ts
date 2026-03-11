/**
 * Sistema de permisos por módulo.
 * Cada módulo corresponde a una tarjeta del dashboard y a un grupo de rutas API.
 */

export const MODULOS = [
  'mesas',
  'comandas',
  'carta',
  'cocina',
  'barra',
  'reportes',
  'caja',
  'configuracion',
  'usuarios_roles',
] as const

export type Modulo = (typeof MODULOS)[number]

export interface RolConPermisos {
  id?: string
  nombre?: string
  permisos?: unknown
}

export interface UserConRol {
  rol?: RolConPermisos | string | null
}

function extractPermisos(user: UserConRol | null | undefined): string[] {
  if (!user?.rol || typeof user.rol === 'string') return []

  const permisos = user.rol.permisos
  if (!permisos || !Array.isArray(permisos)) return []

  return permisos as string[]
}

/**
 * Comprueba si el usuario tiene permiso para el módulo dado.
 * Si permisos incluye "*" o "admin", tiene acceso total.
 */
export function tienePermiso(
  user: UserConRol | null | undefined,
  modulo: string
): boolean {
  const arr = extractPermisos(user)
  if (arr.length === 0) return false
  if (arr.includes('*') || arr.includes('admin')) return true
  return arr.includes(modulo)
}

/**
 * Para usar en APIs: obtiene el usuario y lanza 403 si no tiene permiso.
 * Devuelve el usuario si tiene permiso.
 */
export async function requireModulo(
  getUser: () => Promise<{ rol?: { permisos?: unknown } } | null>,
  modulo: string
): Promise<{ rol?: { permisos?: unknown }; id: string }> {
  const user = await getUser()
  if (!user) {
    throw { status: 403, message: 'No autenticado' }
  }
  if (!tienePermiso(user as UserConRol, modulo)) {
    throw { status: 403, message: 'Sin permisos para este módulo' }
  }
  return user as { rol?: { permisos?: unknown }; id: string }
}
