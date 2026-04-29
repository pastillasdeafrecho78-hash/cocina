import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { obtenerConfiguracion } from '@/lib/configuracion-restaurante'
import { getPaymentProvider } from '@/lib/payments'

const prismaReembolsos = prisma as any

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

    const event = JSON.parse(payload) as {
      type: string
      data?: { object?: { id?: string; amount?: number; refund?: { amount?: number } } }
    }

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
async function procesarPagoReembolsado(
  charge: { id?: string; amount?: number; refund?: { amount?: number } } | undefined
) {
  if (!charge?.id) return
  const pago = await prismaReembolsos.pago.findFirst({
    where: {
      procesadorId: charge.id,
    },
    include: { reembolsos: true, comanda: { select: { restauranteId: true } } },
  })

  if (pago) {
    const montoProveedor = (charge.refund?.amount ?? charge.amount ?? pago.monto * 100) / 100
    const yaRegistrado = pago.reembolsos.some((r: { procesadorId: string | null }) => r.procesadorId === charge.id)
    if (yaRegistrado) return

    await prismaReembolsos.reembolso.create({
      data: {
        restauranteId: pago.comanda.restauranteId,
        comandaId: pago.comandaId,
        pagoId: pago.id,
        tipo: 'PROVEEDOR_PAGO',
        monto: Math.min(montoProveedor, pago.monto),
        motivo: 'Reembolso confirmado por Conekta',
        procesadorId: charge.id,
      },
    })
  }
}
