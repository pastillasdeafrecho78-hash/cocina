import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { obtenerConfiguracion } from '@/lib/configuracion-restaurante'
import { getPaymentProvider } from '@/lib/payments'

/**
 * POST /api/webhooks/conekta
 * Webhook para recibir notificaciones de Conekta sobre pagos
 */
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-conekta-signature')
    const payload = await request.text()

    let restauranteId: string | null = null
    try {
      const parsed = JSON.parse(payload) as {
        data?: { object?: { metadata?: { restauranteId?: string } } }
      }
      restauranteId = parsed?.data?.object?.metadata?.restauranteId ?? null
    } catch {
      /* ignore */
    }
    if (!restauranteId) {
      console.error('[webhook conekta] Evento sin metadata.restauranteId - rechazado')
      return NextResponse.json(
        {
          error:
            'Webhook rechazado: metadata.restauranteId es requerido. Asegúrate de incluir restauranteId en metadata al crear el pago.',
        },
        { status: 400 }
      )
    }
    const config = restauranteId
      ? await obtenerConfiguracion(restauranteId)
      : null
    if (!config?.webhookSecretConekta && process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'Webhook no configurado' },
        { status: 401 }
      )
    }
    if (process.env.NODE_ENV === 'development' && !config?.webhookSecretConekta) {
      console.warn('Webhook secret no configurado, permitiendo en desarrollo')
    }

    const event = JSON.parse(payload) as { type: string; data?: { object?: { id?: string } } }

    if (event.type === 'charge.paid') {
      const provider = getPaymentProvider('conekta')
      if (provider) {
        await provider.handleWebhook(payload, request.headers.get('x-conekta-signature'))
      }
    } else if (event.type === 'charge.refunded') {
      await procesarPagoReembolsado(event.data?.object)
    } else {
      console.log(`Evento no manejado: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: unknown) {
    console.error('Error en webhook de Conekta:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    )
  }
}

/**
 * Procesa un pago reembolsado (Conekta)
 */
async function procesarPagoReembolsado(charge: { id?: string } | undefined) {
  if (!charge?.id) return
  const pago = await prisma.pago.findFirst({
    where: {
      procesadorId: charge.id,
    }
  })

  if (pago) {
    await prisma.pago.update({
      where: { id: pago.id },
      data: {
        estado: 'CANCELADO',
      }
    })
  }
}
