/**
 * Sistema de permisos híbrido:
 * - Legacy por módulo (mesas, carta, caja, ...)
 * - Granular por capacidad (menu.manage, orders.view, ...)
 */

export const MODULOS_LEGACY = [
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

export const CAPACIDADES = [
  'menu.view',
  'menu.manage',
  'orders.view',
  'orders.manage',
  'orders.override',
  'kitchen.view',
  'kitchen.manage',
  'bar.view',
  'bar.manage',
  'payments.view',
  'payments.manage',
  'reports.view',
  'settings.view',
  'settings.manage',
  'staff.view',
  'staff.manage',
  'reservations.view',
  'reservations.manage',
  /** Mesas: mapa y estado (mínimo mesero restringido) */
  'tables.view',
  /** Mesas: alta / borrado / layout numérico */
  'tables.manage',
  /** Mesas: tiempos de color del tablero */
  'tables.wait_times',
  /** Mesas: reservaciones */
  'tables.reservations',
  /** Mesas: pedido cliente, QR y links públicos */
  'tables.client_channel',
  'benefits.grant',
] as const

export const MODULOS = [...MODULOS_LEGACY, ...CAPACIDADES] as const

export type Modulo = (typeof MODULOS)[number]
export type Capacidad = (typeof CAPACIDADES)[number]

const LEGACY_TO_CAPABILITIES: Record<string, readonly string[]> = {
  carta: ['menu.view', 'menu.manage'],
  comandas: ['orders.view', 'orders.manage', 'orders.override'],
  cocina: ['kitchen.view', 'kitchen.manage'],
  barra: ['bar.view', 'bar.manage'],
  caja: ['payments.view', 'payments.manage'],
  reportes: ['reports.view'],
  configuracion: ['settings.view', 'settings.manage'],
  usuarios_roles: ['staff.view', 'staff.manage'],
  /** Legacy `mesas` conserva acceso amplio a mesas + reservaciones (compatibilidad). */
  mesas: [
    'tables.view',
    'tables.manage',
    'tables.wait_times',
    'tables.reservations',
    'tables.client_channel',
    'reservations.view',
    'reservations.manage',
  ],
}

const CAPABILITY_TO_LEGACY: Record<string, readonly string[]> = {
  'menu.view': ['carta'],
  'menu.manage': ['carta'],
  'orders.view': ['comandas'],
  'orders.manage': ['comandas'],
  'orders.override': ['comandas'],
  'kitchen.view': ['cocina'],
  'kitchen.manage': ['cocina'],
  'bar.view': ['barra'],
  'bar.manage': ['barra'],
  'payments.view': ['caja'],
  'payments.manage': ['caja'],
  'reports.view': ['reportes'],
  'settings.view': ['configuracion'],
  'settings.manage': ['configuracion'],
  'staff.view': ['usuarios_roles'],
  'staff.manage': ['usuarios_roles'],
  'reservations.view': ['mesas'],
  'reservations.manage': ['mesas'],
  'tables.view': ['mesas'],
  'tables.manage': ['mesas'],
  'tables.wait_times': ['mesas'],
  'tables.reservations': ['mesas'],
  'tables.client_channel': ['mesas'],
  'benefits.grant': ['configuracion'],
}

export const PERMISSION_LABELS: Record<string, string> = {
  mesas: 'Mesas',
  comandas: 'Comandas (legacy)',
  carta: 'Carta (legacy)',
  cocina: 'Cocina (legacy)',
  barra: 'Barra (legacy)',
  reportes: 'Reportes (legacy)',
  caja: 'Caja (legacy)',
  configuracion: 'Configuración (legacy)',
  usuarios_roles: 'Usuarios y roles (legacy)',
  'menu.view': 'Ver carta',
  'menu.manage': 'Gestionar carta',
  'orders.view': 'Ver comandas',
  'orders.manage': 'Gestionar comandas',
  'orders.override': 'Aprobar/rechazar/forzar solicitudes',
  'kitchen.view': 'Ver cocina',
  'kitchen.manage': 'Gestionar cocina',
  'bar.view': 'Ver barra',
  'bar.manage': 'Gestionar barra',
  'payments.view': 'Ver pagos/caja',
  'payments.manage': 'Gestionar pagos/caja',
  'reports.view': 'Ver reportes',
  'settings.view': 'Ver configuración',
  'settings.manage': 'Gestionar configuración',
  'staff.view': 'Ver staff y roles',
  'staff.manage': 'Gestionar staff y roles',
  'reservations.view': 'Ver reservaciones',
  'reservations.manage': 'Gestionar reservaciones',
  'tables.view': 'Mesas: ver mapa y estado',
  'tables.manage': 'Mesas: agregar o dar de baja mesas',
  'tables.wait_times': 'Mesas: tiempos de color',
  'tables.reservations': 'Mesas: reservaciones',
  'tables.client_channel': 'Mesas: pedido cliente y QR',
  'benefits.grant': 'Otorgar beneficios especiales',
}

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

function hasRawPermission(
  permisos: string[],
  permission: string
): boolean {
  return permisos.includes(permission)
}

/**
 * Evalúa permiso con compatibilidad legacy<->capabilities.
 */
function hasPermissionWithCompatibility(
  permisos: string[],
  permission: string
): boolean {
  if (hasRawPermission(permisos, permission)) return true
  if (permission === '*' || permission === 'admin') return false
  if (CAPABILITY_TO_LEGACY[permission]?.some((legacy) => hasRawPermission(permisos, legacy))) {
    return true
  }
  if (LEGACY_TO_CAPABILITIES[permission]?.some((cap) => hasRawPermission(permisos, cap))) {
    return true
  }
  return false
}

/**
 * Comprueba si el usuario tiene permiso para el módulo dado.
 * Si permisos incluye "*" o "admin", tiene acceso total.
 */
export function tienePermiso(
  user: UserConRol | null | undefined,
  permission: string
): boolean {
  const arr = extractPermisos(user)
  if (arr.length === 0) return false
  if (arr.includes('*') || arr.includes('admin')) return true
  return hasPermissionWithCompatibility(arr, permission)
}

export function tieneAlgunPermiso(
  user: UserConRol | null | undefined,
  permissions: string[]
): boolean {
  return permissions.some((permission) => tienePermiso(user, permission))
}

/**
 * Para usar en APIs: obtiene el usuario y lanza 403 si no tiene permiso.
 * Devuelve el usuario si tiene permiso.
 */
export async function requireModulo(
  getUser: () => Promise<{ rol?: { permisos?: unknown } } | null>,
  permission: string
): Promise<{ rol?: { permisos?: unknown }; id: string }> {
  const user = await getUser()
  if (!user) {
    throw { status: 403, message: 'No autenticado' }
  }
  if (!tienePermiso(user as UserConRol, permission)) {
    throw { status: 403, message: 'Sin permisos para esta acción' }
  }
  return user as { rol?: { permisos?: unknown }; id: string }
}
