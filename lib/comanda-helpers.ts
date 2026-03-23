import { prisma } from './prisma'
import { TipoCategoria, DestinoItem } from '@prisma/client'

/**
 * Determina el destino de un item basado en el tipo de categoría
 */
export function getDestinoFromCategoria(
  tipoCategoria: TipoCategoria
): DestinoItem {
  switch (tipoCategoria) {
    case 'BEBIDA':
      return 'BARRA'
    case 'COMIDA':
    case 'POSTRE':
    case 'ENTRADA':
    default:
      return 'COCINA'
  }
}

/**
 * Genera un número de comanda único
 */
export async function generarNumeroComanda(restauranteId: string): Promise<string> {
  const fecha = new Date()
  const año = fecha.getFullYear().toString().slice(-2)
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')

  const inicioDia = new Date(fecha)
  inicioDia.setHours(0, 0, 0, 0)
  const finDia = new Date(fecha)
  finDia.setHours(23, 59, 59, 999)

  const count = await prisma.comanda.count({
    where: {
      restauranteId,
      fechaCreacion: {
        gte: inicioDia,
        lte: finDia,
      },
    },
  })

  const numero = String(count + 1).padStart(4, '0')
  return `COM-${año}${mes}${dia}-${numero}`
}

/**
 * Calcula el total de una comanda
 */
export function calcularTotal(
  items: Array<{
    cantidad: number
    precioUnitario: number
    precioModificadores?: number
  }>,
  propina: number = 0,
  descuento: number = 0
): number {
  const subtotal = items.reduce(
    (sum, item) =>
      sum +
      item.cantidad *
        (item.precioUnitario + (item.precioModificadores || 0)),
    0
  )

  const conPropina = subtotal * (1 + propina / 100)
  return Math.max(0, conPropina - descuento)
}








