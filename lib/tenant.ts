/** Scope de consultas por restaurante (tenant) */
export function scopeRestaurante(restauranteId: string) {
  return { restauranteId }
}

export function resolveTenantContext(input: {
  restauranteId: string
  activeRestauranteId?: string | null
  activeOrganizacionId?: string | null
}) {
  return {
    restauranteId: input.activeRestauranteId ?? input.restauranteId,
    activeRestauranteId: input.activeRestauranteId ?? input.restauranteId,
    activeOrganizacionId: input.activeOrganizacionId ?? null,
  }
}

export type UserWithTenant = {
  id: string
  restauranteId: string
  activeRestauranteId?: string | null
  activeOrganizacionId?: string | null
  email: string
  nombre: string
  apellido: string
  rolId: string
  activo: boolean
  rol?: { id: string; nombre: string; permisos: unknown } | null
}
