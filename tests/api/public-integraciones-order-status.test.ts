import { beforeEach, describe, expect, it, vi } from 'vitest'

const findFirstRestaurante = vi.fn()
const findFirstIntegracionApi = vi.fn()
const findFirstComanda = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    restaurante: { findFirst: findFirstRestaurante },
    integracionPedidosApi: { findFirst: findFirstIntegracionApi },
    comanda: { findFirst: findFirstComanda },
  },
}))

vi.mock('@/lib/public-ordering', () => ({
  hashSecretToken: vi.fn((value: string) => {
    if (value === 'valid-key') return 'hash-valid'
    if (value === 'other-branch-key') return 'hash-branch-b'
    return 'hash-invalid'
  }),
}))

describe('GET /api/public/integraciones/pedidos/orders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findFirstRestaurante.mockResolvedValue({
      id: 'r1',
      slug: 'sucursal-centro',
      activo: true,
      integracionPedidosApi: { apiKeyHash: 'hash-valid', activo: true },
    })
    findFirstIntegracionApi.mockResolvedValue(null)
    findFirstComanda.mockResolvedValue({
      id: 'order-1',
      numeroComanda: 'COM-240401-0001',
      estado: 'PENDIENTE',
      total: 120,
      fechaCreacion: new Date('2026-04-08T03:10:00.000Z'),
      fechaCompletado: null,
      fechaCancelacion: null,
    })
  })

  it('devuelve status de orden para tenant correcto', async () => {
    vi.resetModules()
    const { GET } = await import('@/app/api/public/integraciones/pedidos/orders/[id]/route')

    const req = new Request('http://localhost/api/public/integraciones/pedidos/orders/order-1', {
      method: 'GET',
      headers: {
        'x-api-key': 'valid-key',
        'x-restaurante-slug': 'sucursal-centro',
      },
    })
    const res = await GET(req as any, { params: { id: 'order-1' } } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.orderId).toBe('order-1')
  })

  it('retorna branch_scope_mismatch con key de otra sucursal', async () => {
    findFirstIntegracionApi.mockResolvedValue({ restauranteId: 'r-other' })

    vi.resetModules()
    const { GET } = await import('@/app/api/public/integraciones/pedidos/orders/[id]/route')

    const req = new Request('http://localhost/api/public/integraciones/pedidos/orders/order-1', {
      method: 'GET',
      headers: {
        'x-api-key': 'other-branch-key',
        'x-restaurante-slug': 'sucursal-centro',
      },
    })
    const res = await GET(req as any, { params: { id: 'order-1' } } as any)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.code).toBe('branch_scope_mismatch')
  })
})
