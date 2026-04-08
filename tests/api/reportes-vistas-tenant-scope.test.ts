import { describe, expect, it, vi } from 'vitest'

const findFirstMock = vi.fn(async () => null)

vi.mock('@/lib/authz/guards', () => ({
  requireAuthenticatedUser: vi.fn(async () => ({
    id: 'u1',
    restauranteId: 'r1',
    activeOrganizacionId: null,
    rolId: 'rol_staff',
  })),
  requireCapability: vi.fn(() => undefined),
  requireActiveTenant: vi.fn(() => ({ restauranteId: 'r1', organizacionId: null })),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dashboardVista: {
      findFirst: findFirstMock,
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

describe('DELETE /api/reportes/vistas/[id] con scope tenant', () => {
  it('consulta la vista incluyendo restauranteId en el where', async () => {
    const { DELETE } = await import('@/app/api/reportes/vistas/[id]/route')
    const req = new Request('http://localhost/api/reportes/vistas/v1', { method: 'DELETE' })
    const res = await DELETE(req as any, { params: { id: 'v1' } } as any)

    expect(res.status).toBe(404)
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'v1',
          usuarioId: 'u1',
          restauranteId: 'r1',
        }),
      })
    )
  })
})
