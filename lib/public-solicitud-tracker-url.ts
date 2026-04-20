export function buildSolicitudTrackerUrl(input: {
  origin: string
  solicitudId: string
  rawToken: string
}): string {
  const base = input.origin.replace(/\/$/, '')
  return `${base}/seguimiento/${encodeURIComponent(input.solicitudId)}?t=${encodeURIComponent(input.rawToken)}`
}
