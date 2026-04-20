import type { Prisma } from '@prisma/client'

/** Comandas que cuentan para carga operativa (alineado con modo-d-policy). */
export const COMANDA_ESTADOS_ACTIVOS = ['PENDIENTE', 'EN_PREPARACION', 'LISTO', 'SERVIDO'] as const

/** Ítems que ya no suman carga de preparación para cocina/barra. */
export const ITEM_ESTADOS_TERMINALES_PREPARACION = ['LISTO', 'ENTREGADO'] as const

export function comandaItemsPreparationLoadWhere(
  restauranteId: string
): Prisma.ComandaItemWhereInput {
  return {
    comanda: {
      restauranteId,
      estado: { in: [...COMANDA_ESTADOS_ACTIVOS] },
    },
    destino: { in: ['COCINA', 'BARRA'] },
    estado: { notIn: [...ITEM_ESTADOS_TERMINALES_PREPARACION] },
    producto: { listoPorDefault: false },
  }
}
