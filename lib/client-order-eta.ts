/**
 * ETA mostrada al cliente según carga (comandas activas + ítems en preparación).
 * Valores en minutos enteros.
 */
export function computeClientOrderEta(input: {
  clienteEtaMinMinutos: number
  clienteEtaMaxMinutos: number
  activeComandas: number
  maxComandasActivas: number | null
  itemsInPrepLoad: number
  maxItemsPreparacion: number | null
}): { etaMin: number; etaMax: number; loadFactor: number } {
  const minCfg = Math.max(1, input.clienteEtaMinMinutos)
  const maxCfg = Math.max(minCfg, input.clienteEtaMaxMinutos)

  const ratioC =
    input.maxComandasActivas && input.maxComandasActivas > 0
      ? input.activeComandas / input.maxComandasActivas
      : 0
  const ratioI =
    input.maxItemsPreparacion && input.maxItemsPreparacion > 0
      ? input.itemsInPrepLoad / input.maxItemsPreparacion
      : 0

  const loadFactor = Math.min(1.5, Math.max(ratioC, ratioI, 0))
  const stretch = 0.75 + 0.45 * loadFactor

  return {
    etaMin: Math.round(minCfg * stretch),
    etaMax: Math.round(maxCfg * stretch),
    loadFactor,
  }
}
