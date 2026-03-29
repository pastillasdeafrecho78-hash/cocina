const RESERVED = new Set([
  'api',
  'www',
  'admin',
  'login',
  'register',
  'dashboard',
  'auth',
  'static',
  '_next',
])

export function isValidRestaurantSlug(slug: string): boolean {
  if (slug.length < 2 || slug.length > 64) return false
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return false
  if (RESERVED.has(slug)) return false
  return true
}

/** Base slug a partir del nombre del restaurante (sin garantizar unicidad ni validez reservada). */
export function slugFromRestaurantName(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return s.length >= 2 ? s : 'local'
}

/** Fila mínima al comprobar si un slug ya existe (Prisma puede tipar `slug` como string | null). */
export type RestaurantSlugLookup = { slug: string | null } | null

/**
 * Asigna un slug único y válido: prueba `base` y luego `base-1`, `base-2`, …
 */
export async function allocateUniqueRestaurantSlug(
  findFirstBySlug: (slug: string) => Promise<RestaurantSlugLookup>,
  fromName: string
): Promise<string> {
  let base = slugFromRestaurantName(fromName)
  if (!isValidRestaurantSlug(base)) base = 'mi-restaurante'
  for (let i = 0; i < 500; i++) {
    const candidate = i === 0 ? base : `${base}-${i}`
    if (!isValidRestaurantSlug(candidate)) continue
    const exists = await findFirstBySlug(candidate)
    if (!exists) return candidate
  }
  throw new Error('No se pudo asignar un identificador de restaurante')
}
