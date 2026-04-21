/**
 * Plantillas de permisos definidas por el admin (localStorage por sucursal).
 * Se guardan en este navegador; para compartir entre equipos habría que persistir en API.
 */

export type RolPlantillaGuardada = {
  id: string
  nombre: string
  permisos: string[]
  createdAt: string
}

const PREFIX = 'servimos_rol_plantillas_v1'

function keyForRestaurante(restauranteId: string) {
  return `${PREFIX}_${restauranteId}`
}

export function cargarPlantillasRol(restauranteId: string): RolPlantillaGuardada[] {
  if (typeof window === 'undefined' || !restauranteId) return []
  try {
    const raw = localStorage.getItem(keyForRestaurante(restauranteId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (p): p is RolPlantillaGuardada =>
        p &&
        typeof p === 'object' &&
        typeof (p as RolPlantillaGuardada).id === 'string' &&
        typeof (p as RolPlantillaGuardada).nombre === 'string' &&
        Array.isArray((p as RolPlantillaGuardada).permisos),
    )
  } catch {
    return []
  }
}

export function guardarPlantillasRol(restauranteId: string, plantillas: RolPlantillaGuardada[]) {
  if (typeof window === 'undefined' || !restauranteId) return
  localStorage.setItem(keyForRestaurante(restauranteId), JSON.stringify(plantillas))
}

export function agregarPlantillaRol(
  restauranteId: string,
  nombre: string,
  permisos: string[],
): RolPlantillaGuardada | null {
  const n = nombre.trim()
  if (!n || permisos.length === 0) return null
  const lista = cargarPlantillasRol(restauranteId)
  const nueva: RolPlantillaGuardada = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `p_${Date.now()}`,
    nombre: n,
    permisos: [...permisos],
    createdAt: new Date().toISOString(),
  }
  lista.push(nueva)
  guardarPlantillasRol(restauranteId, lista)
  return nueva
}

export function eliminarPlantillaRol(restauranteId: string, id: string) {
  const lista = cargarPlantillasRol(restauranteId).filter((p) => p.id !== id)
  guardarPlantillasRol(restauranteId, lista)
}
