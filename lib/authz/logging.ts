type Meta = Record<string, unknown>

function redactValue(key: string, value: unknown): unknown {
  const lowered = key.toLowerCase()
  if (
    lowered.includes('token') ||
    lowered.includes('secret') ||
    lowered.includes('password') ||
    lowered.includes('apikey') ||
    lowered.includes('api_key')
  ) {
    return '[REDACTED]'
  }
  return value
}

function redactMeta(meta?: Meta): Meta | undefined {
  if (!meta) return undefined
  return Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, redactValue(k, v)]))
}

export function logAuthzEvent(event: string, meta?: Meta) {
  const payload = {
    event,
    ...(redactMeta(meta) ? { meta: redactMeta(meta) } : {}),
  }
  console.info('[authz]', JSON.stringify(payload))
}

export function logLegacyFallback(meta: Meta) {
  logAuthzEvent('legacy_role_fallback', meta)
}
