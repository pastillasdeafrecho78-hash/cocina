import type { DestinoItem, TipoCategoria } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getDestinoFromCategoria } from '@/lib/comanda-helpers'

type PrismaLike = {
  kdsSeccion: {
    upsert: (args: unknown) => Promise<{ id: string; tipoLegacy: string | null }>
  }
}

export type KdsDefaultSections = {
  cocina: { id: string; tipoLegacy: 'COCINA' }
  barra: { id: string; tipoLegacy: 'BARRA' }
}

function deterministicKdsId(restauranteId: string, slug: 'cocina' | 'barra') {
  return `kds_${restauranteId}_${slug}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 120)
}

export async function ensureDefaultKdsSections(
  restauranteId: string,
  db: PrismaLike = prisma as unknown as PrismaLike
): Promise<KdsDefaultSections> {
  const [cocina, barra] = await Promise.all([
    db.kdsSeccion.upsert({
      where: { restauranteId_slug: { restauranteId, slug: 'cocina' } },
      create: {
        id: deterministicKdsId(restauranteId, 'cocina'),
        restauranteId,
        nombre: 'Cocina',
        slug: 'cocina',
        tipoLegacy: 'COCINA',
        color: '#15803d',
        orden: 10,
      },
      update: {},
      select: { id: true, tipoLegacy: true },
    }),
    db.kdsSeccion.upsert({
      where: { restauranteId_slug: { restauranteId, slug: 'barra' } },
      create: {
        id: deterministicKdsId(restauranteId, 'barra'),
        restauranteId,
        nombre: 'Barra',
        slug: 'barra',
        tipoLegacy: 'BARRA',
        color: '#1d4ed8',
        orden: 20,
      },
      update: {},
      select: { id: true, tipoLegacy: true },
    }),
  ])

  return {
    cocina: { id: cocina.id, tipoLegacy: 'COCINA' },
    barra: { id: barra.id, tipoLegacy: 'BARRA' },
  }
}

export async function resolveDefaultKdsSeccionId(
  restauranteId: string,
  tipoCategoria: TipoCategoria,
  db: PrismaLike = prisma as unknown as PrismaLike
): Promise<string> {
  const sections = await ensureDefaultKdsSections(restauranteId, db)
  return tipoCategoria === 'BEBIDA' ? sections.barra.id : sections.cocina.id
}

export function resolveLegacyDestino(input: {
  tipoCategoria: TipoCategoria
  kdsSeccion?: { tipoLegacy: string | null } | null
}): DestinoItem {
  if (input.kdsSeccion?.tipoLegacy === 'COCINA' || input.kdsSeccion?.tipoLegacy === 'BARRA') {
    return input.kdsSeccion.tipoLegacy
  }
  return getDestinoFromCategoria(input.tipoCategoria)
}

export function normalizeKdsSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}
