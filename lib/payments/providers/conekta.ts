/**
 * Plugin de pagos Conekta. Implementa la interfaz PaymentProvider.
 * El flujo de creación de cobro (tarjeta, OXXO, SPEI) sigue en POST /api/pagos con lib/pagos.
 * Este plugin se usa para handleWebhook (confirmación automática) y confirmPayment (idempotente).
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { PaymentProvider } from '../provider-interface'
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  ConfirmPaymentInput,
  ConfirmPaymentResult,
  PaymentConfirmedEvent,
  MetodoPago,
} from '../types'
import { onPaymentConfirmed } from '../on-payment-confirmed'

const PROVIDER_ID = 'conekta' as const

function normalizeConfirmEstado(
  estado: string
): 'COMPLETADO' | 'PENDIENTE' | 'FALLIDO' {
  if (estado === 'COMPLETADO' || estado === 'PENDIENTE' || estado === 'FALLIDO') {
    return estado
  }

  return 'FALLIDO'
}

function mapMetodoPago(charge: { payment_method?: { type?: string } }): MetodoPago {
  const type = charge.payment_method?.type
  if (type === 'oxxo') return 'oxxo'
  if (type === 'spei' || type === 'bank_transfer') return 'spei'
  return 'tarjeta_credito'
}

export const conektaProvider: PaymentProvider = {
  id: PROVIDER_ID,

  async createPayment(_input: CreatePaymentInput): Promise<CreatePaymentResult> {
    throw new Error(
      'Conekta: usar POST /api/pagos (lib/pagos) para crear cobros. Este plugin se usa para webhooks y confirmación.'
    )
  },

  async confirmPayment(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult> {
    const existing = await prisma.pago.findFirst({
      where: {
        procesador: PROVIDER_ID,
        procesadorId: input.paymentId,
      },
    })

    if (existing) {
      return {
        pagoId: existing.id,
        estado: normalizeConfirmEstado(existing.estado),
        procesadorId: input.paymentId,
      }
    }

    const pago = await prisma.pago.create({
      data: {
        comandaId: input.comandaId,
        monto: input.amount,
        metodoPago: input.metodoPago,
        procesador: PROVIDER_ID,
        procesadorId: input.paymentId,
        estado: 'COMPLETADO',
        comision: input.comision ?? 0,
        referencia: input.referencia ?? null,
        detalles: input.detalles ? (input.detalles as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    })

    await onPaymentConfirmed({ comandaId: input.comandaId })

    return {
      pagoId: pago.id,
      estado: normalizeConfirmEstado(pago.estado),
      procesadorId: input.paymentId,
    }
  },

  async handleWebhook(rawBody: string | Buffer, _signature: string | null): Promise<PaymentConfirmedEvent | null> {
    let event: { type: string; data?: { object?: unknown } }
    try {
      const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')
      event = JSON.parse(payload) as { type: string; data?: { object?: unknown } }
    } catch {
      return null
    }

    if (event.type !== 'charge.paid') {
      return null
    }

    const charge = event.data?.object as { id?: string; amount?: number; payment_method?: { type?: string }; order_id?: string } | undefined
    if (!charge?.id) return null

    const amount = charge.amount != null ? charge.amount / 100 : 0
    const metodoPago = mapMetodoPago(charge)

    // Conekta no siempre manda comandaId en charge; puede venir en order_id o en metadata.
    // Buscamos pago existente por procesadorId (creado al hacer POST /api/pagos) para obtener comandaId.
    const pagoExistente = await prisma.pago.findFirst({
      where: { procesadorId: charge.id },
      include: { comanda: true },
    })

    if (pagoExistente) {
      await prisma.pago.update({
        where: { id: pagoExistente.id },
        data: { estado: 'COMPLETADO' },
      })
      await onPaymentConfirmed({ comandaId: pagoExistente.comandaId })

      return {
        provider: PROVIDER_ID,
        paymentId: charge.id,
        comandaId: pagoExistente.comandaId,
        amount,
        metodoPago,
        detalles: charge as unknown as Record<string, unknown>,
      }
    }

    // Si no hay pago previo (ej. OXXO/SPEI pagado sin haber creado Pago antes), no podemos crear comanda.
    // En ese caso el webhook de Conekta podría traer order_id que mapeemos a comanda; por ahora solo actualizamos si existe.
    console.warn(`Conekta charge.paid ${charge.id}: no se encontró Pago previo para actualizar`)
    return null
  },
}
