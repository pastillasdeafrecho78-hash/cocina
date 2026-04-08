import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth-server', () => ({
  getSessionUser: vi.fn(async () => ({
    id: 'u1',
    restauranteId: 'r1',
    rol: { permisos: ['caja'] },
  })),
}))

vi.mock('@/lib/permisos', () => ({
  tienePermiso: vi.fn(() => true),
}))

const helpersMock = vi.hoisted(() => ({
  obtenerComandasPendientesParaCorteZ: vi.fn(async () => [
    {
      id: 'c1',
      numeroComanda: '0001',
      estado: 'EN_PREPARACION',
      mesa: 4,
      fechaCreacion: new Date(),
    },
  ]),
  obtenerInicioPeriodoActual: vi.fn(async () => new Date()),
  calcularReportePeriodo: vi.fn(async () => ({
    fechaInicio: new Date(),
    fechaFin: new Date(),
    totalVentas: 0,
    totalEfectivo: 0,
    totalTarjeta: 0,
    totalOtros: 0,
    numComandas: 0,
    comandas: [],
  })),
}))

vi.mock('@/lib/caja-helpers', () => helpersMock)

vi.mock('@/lib/prisma', () => ({
  prisma: {
    corteZ: { create: vi.fn() },
    auditoria: { create: vi.fn() },
  },
}))

describe('POST /api/caja/corte-z', () => {
  it('bloquea corte Z cuando hay comandas pendientes', async () => {
    const { POST } = await import('@/app/api/caja/corte-z/route')
    const res = await POST(new Request('http://localhost/api/caja/corte-z', { method: 'POST' }) as any)
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.success).toBe(false)
    expect(body.data.pendientesCount).toBe(1)
  })
})
