'use client'

import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

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
        metadata: { comandaId },
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
      const token = localStorage.getItem('token')
      const res = await fetch('/api/pagos/stripe/confirm', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
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
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!stripe || !elements || loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
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
  if (!stripePromise) {
    return (
      <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded">
        Stripe no está configurado. Añade NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY en .env.local
      </div>
    )
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#4f46e5',
      },
    },
  }

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
