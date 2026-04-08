import { describe, expect, it } from 'vitest'

describe('POST /api/public/integraciones/pedidos/orders contract guards', () => {
  it('devuelve invalid_headers cuando faltan headers requeridos', async () => {
    const { POST } = await import('@/app/api/public/integraciones/pedidos/orders/route')
    const req = new Request('http://localhost/api/public/integraciones/pedidos/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        externalOrderId: 'ext-1',
        items: [{ productoId: 'p1', cantidad: 1 }],
      }),
    })

    const res = await POST(req as any)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.code).toBe('invalid_headers')
  })

  it('devuelve idempotency_payload_mismatch cuando key no coincide con externalOrderId', async () => {
    const { POST } = await import('@/app/api/public/integraciones/pedidos/orders/route')
    const req = new Request('http://localhost/api/public/integraciones/pedidos/orders', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'k',
        'x-restaurante-slug': 'sucursal',
        'x-idempotency-key': 'idem-abc',
      },
      body: JSON.stringify({
        externalOrderId: 'ext-123',
        items: [{ productoId: 'p1', cantidad: 1 }],
      }),
    })

    const res = await POST(req as any)
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.success).toBe(false)
    expect(body.code).toBe('idempotency_payload_mismatch')
  })
})
