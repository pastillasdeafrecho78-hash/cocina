import { describe, expect, it, vi } from 'vitest'
import { ApiHttpError } from '@/lib/authz/http'

vi.mock('@/lib/authz/guards', () => ({
  requireAuthenticatedUser: vi.fn(async () => ({
    id: 'u1',
    restauranteId: 'r1',
    activeOrganizacionId: 'o1',
    rolId: 'rol_staff',
  })),
  requireCapability: vi.fn(() => {
    throw new ApiHttpError(403, 'Sin permisos')
  }),
  requireActiveTenant: vi.fn(() => ({ restauranteId: 'r1', organizacionId: 'o1' })),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    sucursalMiembro: { findMany: vi.fn() },
    organizacionMiembro: { findMany: vi.fn() },
    usuario: { findMany: vi.fn() },
    rol: { findMany: vi.fn() },
  },
}))

describe('GET /api/roles protegido por capacidad', () => {
  it('responde 403 cuando no tiene capacidad suficiente', async () => {
    const { GET } = await import('@/app/api/roles/route')
    const req = new Request('http://localhost/api/roles')
    const res = await GET(req as any)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.success).toBe(false)
  })
})
