import { prisma } from '@/lib/prisma'

type RestauranteMenuRow = {
  id: string
  menuStrategy: 'EMPTY' | 'CLONE' | 'SHARED'
  menuSourceRestauranteId: string | null
}

export async function getMenuContext(restauranteId: string) {
  const restaurante = await prisma.restaurante.findUnique({
    where: { id: restauranteId },
    select: {
      id: true,
      menuStrategy: true,
      menuSourceRestauranteId: true,
    },
  })

  if (!restaurante) return null
  const row = restaurante as RestauranteMenuRow
  const menuRestauranteId =
    row.menuStrategy === 'SHARED' && row.menuSourceRestauranteId
      ? row.menuSourceRestauranteId
      : row.id

  return {
    restauranteId: row.id,
    menuRestauranteId,
    isSharedConsumer: row.menuStrategy === 'SHARED' && row.menuSourceRestauranteId !== null,
    menuStrategy: row.menuStrategy,
  }
}
