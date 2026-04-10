/**
 * Crea (si faltan) el usuario técnico `pedidos-externos.{restauranteId}@servimos.internal`
 * en cada sucursal, para que EXTERNAL_API / canal público no usen el admin del seed.
 *
 * Uso: npm run ensure:external-order-actors
 */
import { prisma } from '../lib/prisma'
import { resolveExternalOrderActorUserId } from '../lib/orders/external-order-actor'

async function main() {
  const restaurantes = await prisma.restaurante.findMany({
    select: { id: true, nombre: true, slug: true },
  })
  for (const r of restaurantes) {
    const userId = await resolveExternalOrderActorUserId(prisma, r.id)
    console.log(`[ensure-external-order-actors] ${r.slug ?? r.nombre} -> ${userId}`)
  }
  console.log(`[ensure-external-order-actors] Listo: ${restaurantes.length} sucursal(es).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
