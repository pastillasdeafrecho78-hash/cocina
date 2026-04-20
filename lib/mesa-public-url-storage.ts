const STORAGE_NS = 'servimos.mesaPublicUrl.v1'

export function mesaPublicUrlStorageKey(restauranteId: string, mesaId: string) {
  return `${STORAGE_NS}::${restauranteId}::${mesaId}`
}

export function readMesaPublicUrl(restauranteId: string, mesaId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(mesaPublicUrlStorageKey(restauranteId, mesaId))
    return v && v.startsWith('http') ? v : null
  } catch {
    return null
  }
}

export function writeMesaPublicUrl(restauranteId: string, mesaId: string, url: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(mesaPublicUrlStorageKey(restauranteId, mesaId), url)
  } catch {
    // quota / private mode
  }
}
