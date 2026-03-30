/**
 * Intenta sacar de la respuesta de GET /f2f/pinpad/v1/devices/status los valores
 * que Clip usa como serial de terminal (a menudo empiezan por P8; a veces difieren de la etiqueta física).
 */
export function extractClipDeviceSerials(data: unknown): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  function add(raw: string) {
    const t = raw.trim()
    if (t.length < 6) return
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(t)) return
    if (seen.has(t)) return
    seen.add(t)
    out.push(t)
  }

  function walk(node: unknown, key?: string) {
    if (node === null || node === undefined) return
    if (typeof node === 'string') {
      const k = key?.toLowerCase() ?? ''
      const s = node.trim()
      if (/^(P8|N8)[A-Z0-9]{6,}$/i.test(s)) add(s)
      if (
        /serial|pos_serial|reader|terminal|device_id|pinpad/.test(k) &&
        /^[A-Z0-9]{6,}$/i.test(s)
      ) {
        add(s)
      }
      return
    }
    if (Array.isArray(node)) {
      node.forEach((x) => walk(x))
      return
    }
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node as object)) {
        walk(v, k)
      }
    }
  }

  walk(data)
  return out
}
