import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

export function isMissingColumnError(error: unknown, _columnHint = 'isDefault') {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2022'
}

export type ClipTerminalRow = {
  id: string
  restauranteId: string
  serialNumber: string
  nombre: string | null
  activo: boolean
  createdAt: Date
  updatedAt: Date
  isDefault: boolean
}

export async function listClipTerminals(
  prisma: PrismaClient,
  restauranteId: string
): Promise<ClipTerminalRow[]> {
  try {
    const list = await prisma.clipTerminal.findMany({
      where: { restauranteId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
    return list.map((t) => ({ ...t, isDefault: Boolean((t as { isDefault?: boolean }).isDefault) }))
  } catch (e) {
    if (!isMissingColumnError(e, 'isDefault')) throw e
    const rows = await prisma.$queryRaw<
      Omit<ClipTerminalRow, 'isDefault'>[]
    >(Prisma.sql`
      SELECT id, "restauranteId", "serialNumber", nombre, activo, "createdAt", "updatedAt"
      FROM "ClipTerminal"
      WHERE "restauranteId" = ${restauranteId}
      ORDER BY "createdAt" DESC
    `)
    return rows.map((r) => ({ ...r, isDefault: false }))
  }
}

export async function upsertClipTerminal(
  prisma: PrismaClient,
  input: { restauranteId: string; serialNumber: string; nombre: string | null }
): Promise<ClipTerminalRow> {
  const { restauranteId, serialNumber, nombre } = input
  try {
    const activeCount = await prisma.clipTerminal.count({
      where: { restauranteId, activo: true },
    })
    const shouldBeDefault = activeCount === 0
    if (shouldBeDefault) {
      await prisma.clipTerminal.updateMany({
        where: { restauranteId },
        data: { isDefault: false },
      })
    }
    const row = await prisma.clipTerminal.upsert({
      where: {
        restauranteId_serialNumber: { restauranteId, serialNumber },
      },
      create: {
        restauranteId,
        serialNumber,
        nombre,
        activo: true,
        isDefault: shouldBeDefault,
      },
      update: { nombre, activo: true, isDefault: shouldBeDefault },
    })
    return { ...row, isDefault: Boolean((row as { isDefault?: boolean }).isDefault) }
  } catch (e) {
    if (!isMissingColumnError(e, 'isDefault')) throw e
    const id = randomUUID().replace(/-/g, '').slice(0, 25)
    const rows = await prisma.$queryRaw<Omit<ClipTerminalRow, 'isDefault'>[]>(Prisma.sql`
      INSERT INTO "ClipTerminal" (id, "restauranteId", "serialNumber", nombre, activo, "createdAt", "updatedAt")
      VALUES (${id}, ${restauranteId}, ${serialNumber}, ${nombre}, true, NOW(), NOW())
      ON CONFLICT ("restauranteId", "serialNumber")
      DO UPDATE SET
        nombre = COALESCE(EXCLUDED.nombre, "ClipTerminal".nombre),
        activo = true,
        "updatedAt" = NOW()
      RETURNING id, "restauranteId", "serialNumber", nombre, activo, "createdAt", "updatedAt"
    `)
    const r = rows[0]
    if (!r) throw new Error('No se pudo registrar la terminal')
    return { ...r, isDefault: false }
  }
}

/** Desactiva terminal; SQL directo para no depender de la columna isDefault en SELECT/RETURNING. */
export async function deactivateClipTerminal(
  prisma: PrismaClient,
  id: string,
  restauranteId: string
): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "ClipTerminal"
    SET activo = false, "updatedAt" = NOW()
    WHERE id = ${id} AND "restauranteId" = ${restauranteId}
  `)
}
