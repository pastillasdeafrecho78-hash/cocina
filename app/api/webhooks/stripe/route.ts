import { NextRequest, NextResponse } from 'next/server'
import { getPaymentProvider } from '@/lib/payments'

/**
 * POST /api/webhooks/stripe
 * Webhook de Stripe. Delega en la capa de abstracción de pagos.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('stripe-signature')

    const provider = getPaymentProvider('stripe')
    if (!provider) {
      return NextResponse.json(
        { error: 'Stripe provider no registrado' },
        { status: 500 }
      )
    }

    const event = await provider.handleWebhook(rawBody, signature)
    return NextResponse.json({ received: true, event: event ? 'payment_confirmed' : null })
  } catch (err) {
    console.error('Webhook Stripe error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Webhook failed' },
      { status: 500 }
    )
  }
}
