import { describe, expect, it, vi } from 'vitest'
import { ApiHttpError } from '@/lib/authz/http'

vi.mock('@/lib/authz/guards', () => ({
  requireAuthenticatedUser: vi.fn(async () => ({
    id: 'u1',
    restauranteId: 'r1',
    activeOrganizacionId: null,
    rolId: 'rol_staff',
  })),
  requireCapability: vi.fn(() => {
    throw new ApiHttpError(403, 'Sin permisos')
  }),
  requireActiveTenant: vi.fn(() => ({ restauranteId: 'r1', organizacionId: null })),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    mesa: { findFirst: vi.fn(), update: vi.fn() },
    auditoria: { create: vi.fn() },
  },
}))

describe('PATCH /api/mesas/[id] protegido por capacidad', () => {
  it('responde 403 cuando no tiene permiso mesas', async () => {
    const { PATCH } = await import('@/app/api/mesas/[id]/route')
    const req = new Request('http://localhost/api/mesas/m1', {
      method: 'PATCH',
      body: JSON.stringify({ estado: 'LIBRE' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await PATCH(req as any, { params: { id: 'm1' } } as any)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.success).toBe(false)
  })
})
