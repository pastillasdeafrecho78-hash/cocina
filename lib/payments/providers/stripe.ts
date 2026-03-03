/**
 * Plugin de pagos Stripe. Implementa la interfaz PaymentProvider.
 */

import Stripe from 'stripe'
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

const PROVIDER_ID = 'stripe' as const

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY no configurado')
  return new Stripe(key)
}

function stripeStatusToOurs(status: string): 'pending' | 'requires_action' | 'succeeded' {
  if (status === 'succeeded') return 'succeeded'
  if (status === 'requires_action' || status === 'requires_payment_method') return 'requires_action'
  return 'pending'
}

export const stripeProvider: PaymentProvider = {
  id: PROVIDER_ID,

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const stripe = getStripe()
    const amountCentavos = Math.round(input.monto * 100)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCentavos,
      currency: 'mxn',
      automatic_payment_methods: { enabled: true },
      metadata: {
        comandaId: input.comandaId,
        ...(input.numeroComanda && { numeroComanda: input.numeroComanda }),
        ...input.metadata,
      },
    })

    return {
      paymentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret ?? null,
      status: stripeStatusToOurs(paymentIntent.status),
      amount: input.monto,
    }
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
        estado: existing.estado,
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
        detalles: input.detalles ? (input.detalles as object) : null,
      },
    })

    await onPaymentConfirmed({ comandaId: input.comandaId })

    return {
      pagoId: pago.id,
      estado: pago.estado,
      procesadorId: input.paymentId,
    }
  },

  async handleWebhook(rawBody: string | Buffer, signature: string | null): Promise<PaymentConfirmedEvent | null> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('STRIPE_WEBHOOK_SECRET no configurado')
      } else {
        return null
      }
    }

    let event: Stripe.Event
    try {
      const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')
      event = secret && signature
        ? (getStripe().webhooks.constructEvent(payload, signature, secret) as Stripe.Event)
        : (JSON.parse(payload) as Stripe.Event)
    } catch (err) {
      console.error('Stripe webhook signature/parse error:', err)
      return null
    }

    if (event.type !== 'payment_intent.succeeded') {
      return null
    }

    const pi = event.data.object as Stripe.PaymentIntent
    const comandaId = pi.metadata?.comandaId
    if (!comandaId) {
      console.warn('Stripe payment_intent.succeeded sin comandaId en metadata')
      return null
    }

    const amount = (pi.amount ?? 0) / 100
    await this.confirmPayment({
      paymentId: pi.id,
      comandaId,
      amount,
      metodoPago: 'tarjeta_credito',
      comision: 0,
      detalles: pi as unknown as Record<string, unknown>,
    })

    return {
      provider: PROVIDER_ID,
      paymentId: pi.id,
      comandaId,
      amount,
      metodoPago: 'tarjeta_credito',
      detalles: pi as unknown as Record<string, unknown>,
    }
  },
}
