type Entry = { count: number; resetAt: number }

const store = new Map<string, Entry>()
const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 30

export function rateLimitAuth(key: string): { ok: boolean; retryAfterMs?: number } {
  const now = Date.now()
  const e = store.get(key)
  if (!e || now > e.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { ok: true }
  }
  if (e.count >= MAX_ATTEMPTS) {
    return { ok: false, retryAfterMs: e.resetAt - now }
  }
  e.count += 1
  return { ok: true }
}
