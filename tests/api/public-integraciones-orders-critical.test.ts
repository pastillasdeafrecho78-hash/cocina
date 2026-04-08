import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const findFirstRestaurante = vi.fn()
const findFirstIntegracionApi = vi.fn()
const findFirstComanda = vi.fn()
const findFirstUsuario = vi.fn()
const findManyProducto = vi.fn()
const findManyModificador = vi.fn()
const transactionMock = vi.fn()

const txClienteCreate = vi.fn()
const txComandaCreate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    restaurante: { findFirst: findFirstRestaurante },
    integracionPedidosApi: { findFirst: findFirstIntegracionApi },
    comanda: { findFirst: findFirstComanda },
    usuario: { findFirst: findFirstUsuario },
    producto: { findMany: findManyProducto },
    modificador: { findMany: findManyModificador },
    $transaction: transactionMock,
  },
}))

vi.mock('@/lib/public-ordering', () => ({
  hashSecretToken: vi.fn((value: string) => {
    if (value === 'valid-key') return 'hash-valid'
    if (value === 'other-branch-key') return 'hash-branch-b'
    return 'hash-invalid'
  }),
}))

vi.mock('@/lib/menu-effective', () => ({
  resolveEffectiveMenu: vi.fn(async () => ({ menuRestauranteId: 'menu-r1' })),
}))

vi.mock('@/lib/comanda-helpers', () => ({
  calcularTotal: vi.fn(() => 120),
  generarNumeroComanda: vi.fn(async () => 'COM-240401-0001'),
  getDestinoFromCategoria: vi.fn(() => 'COCINA'),
}))

const buildValidRequest = (body?: Record<string, unknown>, headers?: HeadersInit) =>
  new Request('http://localhost/api/public/integraciones/pedidos/orders', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': 'valid-key',
      'x-restaurante-slug': 'sucursal-centro',
      'x-idempotency-key': 'ext-123',
      ...(headers || {}),
    },
    body: JSON.stringify(
      body ?? {
        externalOrderId: 'ext-123',
        tipoPedido: 'A_DOMICILIO',
        items: [{ productoId: 'prod-1', cantidad: 1 }],
      }
    ),
  })

describe('POST /api/public/integraciones/pedidos/orders critical cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    findFirstRestaurante.mockResolvedValue({
      id: 'r1',
      slug: 'sucursal-centro',
      activo: true,
      integracionPedidosApi: { apiKeyHash: 'hash-valid', activo: true },
    })
    findFirstIntegracionApi.mockResolvedValue(null)
    findFirstComanda.mockResolvedValue(null)
    findFirstUsuario.mockResolvedValue({ id: 'u1' })
    findManyProducto.mockResolvedValue([
      {
        id: 'prod-1',
        nombre: 'Hamburguesa',
        precio: 120,
        categoria: { tipo: 'COMIDA' },
        tamanos: [],
      },
    ])
    findManyModificador.mockResolvedValue([])

    txClienteCreate.mockResolvedValue({ id: 'c1' })
    txComandaCreate.mockResolvedValue({
      id: 'order-1',
      numeroComanda: 'COM-240401-0001',
      estado: 'PENDIENTE',
      total: 120,
      fechaCreacion: new Date('2026-04-08T03:10:00.000Z'),
    })
    transactionMock.mockImplementation(async (cb: any) =>
      cb({
        cliente: { create: txClienteCreate },
        comanda: { create: txComandaCreate },
      })
    )
  })

  it('happy path crea orden externa', async () => {
    vi.resetModules()
    const { POST } = await import('@/app/api/public/integraciones/pedidos/orders/route')
    const res = await POST(buildValidRequest() as any)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.idempotent).toBe(false)
    expect(body.data.origen).toBe('EXTERNAL_API')
  })

  it('duplicate/idempotent retry devuelve 200 con idempotent=true', async () => {
    findFirstComanda.mockResolvedValue({
      id: 'order-existing',
      numeroComanda: 'COM-240401-0001',
      estado: 'PENDIENTE',
      total: 120,
      fechaCreacion: new Date('2026-04-08T03:10:00.000Z'),
    })

    vi.resetModules()
    const { POST } = await import('@/app/api/public/integraciones/pedidos/orders/route')
    const res = await POST(buildValidRequest() as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.idempotent).toBe(true)
  })

  it('branch_scope_mismatch cuando api key pertenece a otra sucursal', async () => {
    findFirstIntegracionApi.mockResolvedValue({ restauranteId: 'r-other' })

    vi.resetModules()
    const { POST } = await import('@/app/api/public/integraciones/pedidos/orders/route')
    const res = await POST(
      buildValidRequest(undefined, {
        'x-api-key': 'other-branch-key',
      }) as any
    )
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.success).toBe(false)
    expect(body.code).toBe('branch_scope_mismatch')
  })

  it('invalid_item_scope cuando producto no está en catálogo efectivo del tenant', async () => {
    findManyProducto.mockResolvedValue([])

    vi.resetModules()
    const { POST } = await import('@/app/api/public/integraciones/pedidos/orders/route')
    const res = await POST(buildValidRequest() as any)
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.code).toBe('invalid_item_scope')
  })

  it('branch_inactive cuando sucursal está inactiva', async () => {
    findFirstRestaurante.mockResolvedValue({
      id: 'r1',
      slug: 'sucursal-centro',
      activo: false,
      integracionPedidosApi: { apiKeyHash: 'hash-valid', activo: true },
    })

    vi.resetModules()
    const { POST } = await import('@/app/api/public/integraciones/pedidos/orders/route')
    const res = await POST(buildValidRequest() as any)
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.code).toBe('branch_inactive')
  })

  it('idempotency_payload_mismatch cuando header no coincide con externalOrderId', async () => {
    vi.resetModules()
    const { POST } = await import('@/app/api/public/integraciones/pedidos/orders/route')
    const req = buildValidRequest(
      {
        externalOrderId: 'ext-otro',
        tipoPedido: 'A_DOMICILIO',
        items: [{ productoId: 'prod-1', cantidad: 1 }],
      },
      { 'x-idempotency-key': 'ext-123' }
    )
    const res = await POST(req as any)
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.code).toBe('idempotency_payload_mismatch')
  })

  it('race condition (P2002) responde idempotente', async () => {
    transactionMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dupe', {
        code: 'P2002',
        clientVersion: '5.22.0',
      })
    )
    findFirstComanda
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'order-race',
        numeroComanda: 'COM-240401-0002',
        estado: 'PENDIENTE',
        total: 120,
        fechaCreacion: new Date('2026-04-08T03:11:00.000Z'),
      })

    vi.resetModules()
    const { POST } = await import('@/app/api/public/integraciones/pedidos/orders/route')
    const res = await POST(buildValidRequest() as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.idempotent).toBe(true)
  })
})
