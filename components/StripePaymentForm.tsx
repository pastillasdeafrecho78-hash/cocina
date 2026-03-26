'use client'

import { useMemo, useState } from 'react'
import { apiFetch } from '@/lib/auth-fetch'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useTheme } from '@/components/ThemeProvider'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

function CheckoutForm({
  clientSecret,
  comandaId,
  total,
  onSuccess,
  onCancel,
}: {
  clientSecret: string
  comandaId: string
  total: number
  onSuccess: () => void
  onCancel: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError(null)

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: typeof window !== 'undefined' ? window.location.href : '',
      },
    })

    if (submitError) {
      setError(submitError.message ?? 'Error al procesar el pago')
      setLoading(false)
      return
    }

    const paymentIntentClientSecret = clientSecret
    const { paymentIntent } = await stripe.retrievePaymentIntent(paymentIntentClientSecret)

    if (paymentIntent?.status === 'succeeded') {
      const res = await apiFetch('/api/pagos/stripe/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comandaId,
          paymentIntentId: paymentIntent.id,
        }),
      })
      const data = await res.json()
      if (data.success) {
        onSuccess()
      } else {
        setError(data.error ?? 'Error al registrar el pago')
      }
    } else {
      setError('El pago no se completó. Intenta de nuevo.')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
          paymentMethodOrder: ['card', 'apple_pay', 'google_pay'],
        }}
      />
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="app-btn-secondary rounded-2xl px-4 py-2"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!stripe || !elements || loading}
          className="app-btn-primary rounded-2xl px-4 py-2 disabled:opacity-50"
        >
          {loading ? 'Procesando…' : `Pagar $${total.toFixed(2)}`}
        </button>
      </div>
    </form>
  )
}

export default function StripePaymentForm({
  clientSecret,
  comandaId,
  total,
  onSuccess,
  onCancel,
}: {
  clientSecret: string
  comandaId: string
  total: number
  onSuccess: () => void
  onCancel: () => void
}) {
  const { resolvedTheme } = useTheme()

  if (!stripePromise) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-600">
        Stripe no está configurado. Añade NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY en .env.local
      </div>
    )
  }

  const options = useMemo(
    () => ({
      clientSecret,
      appearance: {
        theme: resolvedTheme === 'dark' ? ('night' as const) : ('stripe' as const),
        variables: {
          colorPrimary: resolvedTheme === 'dark' ? '#f59e0b' : '#4f46e5',
          colorBackground: resolvedTheme === 'dark' ? '#242121' : '#ffffff',
          colorText: resolvedTheme === 'dark' ? '#f5f5f4' : '#292524',
          colorDanger: '#ef4444',
          borderRadius: '16px',
        },
      },
    }),
    [clientSecret, resolvedTheme]
  )

  return (
    <Elements stripe={stripePromise} options={options}>
      <CheckoutForm
        clientSecret={clientSecret}
        comandaId={comandaId}
        total={total}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  )
}
