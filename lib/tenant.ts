/** Scope de consultas por restaurante (tenant) */
export function scopeRestaurante(restauranteId: string) {
  return { restauranteId }
}

export type UserWithTenant = {
  id: string
  restauranteId: string
  email: string
  nombre: string
  apellido: string
  rolId: string
  activo: boolean
  rol?: { id: string; nombre: string; permisos: unknown } | null
}
