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
