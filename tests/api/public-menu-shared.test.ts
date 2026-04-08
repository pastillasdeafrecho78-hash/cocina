import { describe, expect, it, vi } from 'vitest'

const findFirstRestaurante = vi.fn()
const findManyCategorias = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    restaurante: { findFirst: findFirstRestaurante },
    categoria: { findMany: findManyCategorias },
  },
}))

vi.mock('@/lib/menu-context', () => ({
  getMenuContext: vi.fn(async () => ({
    restauranteId: 'r-consumer',
    menuRestauranteId: 'r-source',
    isSharedConsumer: true,
    menuStrategy: 'SHARED',
  })),
}))

describe('GET /api/public/menu/[slug] en SHARED', () => {
  it('consulta categorías usando restaurante fuente', async () => {
    findFirstRestaurante.mockResolvedValue({ id: 'r-consumer', nombre: 'X', slug: 'x' })
    findManyCategorias.mockResolvedValue([])

    const { GET } = await import('@/app/api/public/menu/[slug]/route')
    const res = await GET(new Request('http://localhost/api/public/menu/x'), {
      params: { slug: 'x' },
    })

    expect(res.status).toBe(200)
    expect(findManyCategorias).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          restauranteId: 'r-source',
        }),
      })
    )
  })
})
