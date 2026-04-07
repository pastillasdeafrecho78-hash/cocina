import { prisma } from '@/lib/prisma'

async function main() {
  const now = new Date()
  const cutoffCodes = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const purgedCodes = await prisma.codigoVinculacionSucursal.deleteMany({
    where: {
      OR: [
        { usadaEn: { not: null } },
        { expiraEn: { lt: cutoffCodes } },
      ],
      createdAt: { lt: cutoffCodes },
    },
  })

  // Limpieza segura de scrap de carta:
  // categorias inactivas sin productos ni relaciones, creadas hace >30 días.
  const orphanCategories = await prisma.categoria.findMany({
    where: {
      activa: false,
      updatedAt: { lt: cutoffCodes },
      productos: { none: {} },
      modificadores: { none: {} },
    },
    select: { id: true },
  })
  const orphanCategoryIds = orphanCategories.map((c) => c.id)
  const purgedCategories = orphanCategoryIds.length
    ? await prisma.categoria.deleteMany({
        where: { id: { in: orphanCategoryIds } },
      })
    : { count: 0 }

  console.log(
    JSON.stringify(
      {
        ok: true,
        purgedAccessCodes: purgedCodes.count,
        purgedOrphanCategories: purgedCategories.count,
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error('housekeeping-operativo failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
