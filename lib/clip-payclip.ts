/**
 * Cliente HTTP para API PinPad de Payclip/Clip.
 * Documentación: https://developer.clip.mx/docs/api-de-pinpad
 */

const BASE = process.env.CLIP_API_BASE || 'https://api.payclip.io'

export class ClipProviderError extends Error {
  status: number
  responseBody: string
  constructor(message: string, status: number, responseBody: string) {
    super(message)
    this.name = 'ClipProviderError'
    this.status = status
    this.responseBody = responseBody
  }
}

function clipAuthHeaderValue(apiKey: string, mode?: 'basic' | 'bearer'): string {
  const token = normalizeClipCredential(apiKey)
  if (/^(Basic|Bearer)\s+/i.test(token)) return token
  if (mode === 'bearer') return `Bearer ${token}`
  // Clip PinPad documenta Basic para autenticación.
  return `Basic ${token}`
}

function normalizeClipCredential(raw: string): string {
  let token = String(raw || '').trim()
  // Soporta pegar "Authorization: Basic xxx"
  const headerMatch = token.match(/^authorization\s*:\s*(.+)$/i)
  if (headerMatch) token = headerMatch[1].trim()
  // Quita comillas envolventes y saltos de línea
  token = token.replace(/^["']+|["']+$/g, '').replace(/\s+/g, ' ').trim()
  return token
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: clipAuthHeaderValue(apiKey),
  }
}

async function parseResponse(res: Response): Promise<{ text: string; json: any }> {
  const text = await res.text()
  let json: any
  try {
    json = JSON.parse(text)
  } catch {
    json = { _raw: text }
  }
  return { text, json }
}

export async function clipPinpadCreatePayment(opts: {
  apiKey: string
  amount: number
  tip_amount?: number
  reference: string
  serial_number_pos: string
  webhook_url: string
}): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/f2f/pinpad/v1/payment`, {
    method: 'POST',
    headers: authHeaders(opts.apiKey),
    body: JSON.stringify({
      amount: Number(opts.amount.toFixed(2)),
      tip_amount: Number((opts.tip_amount ?? 0).toFixed(2)),
      reference: opts.reference,
      serial_number_pos: opts.serial_number_pos,
      webhook_url: opts.webhook_url,
    }),
  })
  const text = await res.text()
  let json: Record<string, unknown>
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    json = { _raw: text }
  }
  if (!res.ok) {
    const msg =
      (json.message as string) ||
      (json.error as string) ||
      (json.detail as string) ||
      text ||
      `Clip ${res.status}`
    throw new Error(msg)
  }
  return json
}

export async function clipDevicesStatus(apiKey: string): Promise<unknown> {
  const token = normalizeClipCredential(apiKey)
  const attempts: HeadersInit[] = /^(Basic|Bearer)\s+/i.test(token)
    ? [{ Accept: 'application/json', Authorization: token }]
    : [
        { Accept: 'application/json', Authorization: clipAuthHeaderValue(token, 'basic') },
        { Accept: 'application/json', Authorization: clipAuthHeaderValue(token, 'bearer') },
        { Accept: 'application/json', 'x-api-key': token },
      ]

  let lastStatus = 502
  let lastBody = ''
  for (const headers of attempts) {
    const res = await fetch(`${BASE}/f2f/pinpad/v1/devices/status`, { headers })
    const parsed = await parseResponse(res)
    if (res.ok) return parsed.json
    lastStatus = res.status
    lastBody = parsed.text
  }

  let providerMsg = lastBody
  try {
    const parsed = JSON.parse(lastBody)
    providerMsg =
      parsed?.message ||
      parsed?.error ||
      parsed?.detail ||
      lastBody
  } catch {}

  throw new ClipProviderError(providerMsg || 'Error consultando dispositivos en Clip', lastStatus, lastBody)
}

export async function clipPaymentDetail(
  apiKey: string,
  pinpadRequestId: string
): Promise<Record<string, unknown>> {
  const url = `${BASE}/f2f/pinpad/v1/payment?pinpadRequestId=${encodeURIComponent(pinpadRequestId)}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: clipAuthHeaderValue(apiKey),
    },
  })
  const text = await res.text()
  let json: Record<string, unknown>
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    json = { _raw: text }
  }
  if (!res.ok) {
    throw new Error(text || `Clip ${res.status}`)
  }
  return json
}

export function extractPinpadRequestId(body: Record<string, unknown>): string | null {
  const v =
    body.pinpad_request_id ??
    body.pinpadRequestId ??
    body.payment_id ??
    body.id
  return v != null ? String(v) : null
}
