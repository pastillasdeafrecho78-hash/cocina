/**
 * Efectos secundarios cuando un pago se confirma (comanda PAGADO, mesa LIBRE).
 * Usado por todos los plugins para no duplicar lógica.
 */

import { prisma } from '@/lib/prisma'

export interface OnPaymentConfirmedParams {
  comandaId: string
}

/**
 * Marca la comanda como PAGADA y libera la mesa si aplica.
 * No genera factura (eso lo hace la API que tiene datos del receptor).
 */
export async function onPaymentConfirmed(params: OnPaymentConfirmedParams): Promise<void> {
  const { comandaId } = params

  await prisma.comanda.update({
    where: { id: comandaId },
    data: { estado: 'PAGADO' },
  })

  const comanda = await prisma.comanda.findUnique({
    where: { id: comandaId },
    select: { mesaId: true },
  })

  if (comanda?.mesaId) {
    await prisma.mesa.update({
      where: { id: comanda.mesaId },
      data: { estado: 'LIBRE' },
    })
  }
}
