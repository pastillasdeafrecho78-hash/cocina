import { describe, expect, it, vi } from 'vitest'
import { ApiHttpError } from '@/lib/authz/http'

vi.mock('@/lib/authz/guards', () => ({
  requireAuthenticatedUser: vi.fn(async () => ({
    id: 'u1',
    restauranteId: 'r1',
    activeOrganizacionId: 'o1',
    rolId: 'rol_staff',
    effectiveRolId: 'rol_staff',
  })),
  requireCapability: vi.fn(() => {
    throw new ApiHttpError(403, 'Sin permisos')
  }),
  requireActiveTenant: vi.fn(() => ({ restauranteId: 'r1', organizacionId: 'o1' })),
  requireRoleScopedToTenant: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    usuario: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    rol: { findUnique: vi.fn() },
    restaurante: { findUnique: vi.fn() },
    sucursalMiembro: { upsert: vi.fn() },
    organizacionMiembro: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}))

describe('GET /api/usuarios protegido por capacidad', () => {
  it('responde 403 cuando no tiene permiso usuarios_roles', async () => {
    const { GET } = await import('@/app/api/usuarios/route')
    const req = new Request('http://localhost/api/usuarios')
    const res = await GET(req as any)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.success).toBe(false)
  })
})
