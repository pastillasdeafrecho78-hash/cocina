export type MesaLookupClient = {
  mesa: {
    findFirst: (args: {
      where: {
        restauranteId: string
        numero: number
      }
    }) => Promise<{
      id: string
      restauranteId: string
      numero: number
      activa: boolean
    } | null>
  }
}

export function buildMesaNumeroTenantWhere(restauranteId: string, numero: number) {
  return { restauranteId, numero }
}

export async function findMesaByNumeroForTenant(
  db: MesaLookupClient,
  input: { restauranteId: string; numero: number }
) {
  return db.mesa.findFirst({
    where: buildMesaNumeroTenantWhere(input.restauranteId, input.numero),
  })
}

export function mesaNumeroConflictMessage(numero: number) {
  return `Ya existe una mesa ${numero} en esta sucursal`
}
