'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import BackButton from '@/components/BackButton'
import toast from 'react-hot-toast'
import StripePaymentForm from '@/components/StripePaymentForm'

interface Comanda {
  id: string
  numeroComanda: string
  estado: string
  total: number
  propina: number
  descuento: number
  fechaCreacion: string
  mesa?: {
    numero: number
  } | null
  cliente?: {
    nombre: string
  } | null
  items: Array<{
    id: string
    cantidad: number
    producto: {
      nombre: string
      categoria: {
        nombre: string
      }
    }
    precioUnitario: number
    subtotal: number
    notas?: string
    estado: string
  }>
}

export default function ComandaDetallePage() {
  const params = useParams()
  const router = useRouter()
  const numeroComanda = params.numeroComanda as string

  const [comanda, setComanda] = useState<Comanda | null>(null)
  const [loading, setLoading] = useState(true)
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'stripe' | null>(null)
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null)
  const [cobrandoEfectivo, setCobrandoEfectivo] = useState(false)

  useEffect(() => {
    fetchComanda()
  }, [numeroComanda])

  const fetchComanda = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/comandas?numeroComanda=${numeroComanda}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (data.success && data.data.length > 0) {
        setComanda(data.data[0])
      } else {
        toast.error('Comanda no encontrada')
        router.push('/dashboard/mesas')
      }
    } catch (error) {
      toast.error('Error al cargar comanda')
    } finally {
      setLoading(false)
    }
  }

  const handleCobrarEfectivo = async () => {
    if (!comanda) return
    setCobrandoEfectivo(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/pagos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comandaId: comanda.id,
          metodo: 'efectivo',
        }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Pago en efectivo registrado')
        setMetodoPago(null)
        fetchComanda()
      } else {
        toast.error(data.error ?? 'Error al registrar pago')
      }
    } catch (error) {
      toast.error('Error al registrar pago')
    } finally {
      setCobrandoEfectivo(false)
    }
  }

  const handleSeleccionarStripe = async () => {
    if (!comanda) return
    setMetodoPago('stripe')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/pagos/stripe/create-payment-intent', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comandaId: comanda.id }),
      })
      const data = await res.json()
      if (data.success && data.data?.clientSecret) {
        setStripeClientSecret(data.data.clientSecret)
      } else {
        toast.error(data.error ?? 'Error al preparar pago')
        setMetodoPago(null)
      }
    } catch (error) {
      toast.error('Error al preparar pago con tarjeta')
      setMetodoPago(null)
    }
  }

  const handleStripeSuccess = () => {
    toast.success('Pago con tarjeta/Apple Pay registrado')
    setMetodoPago(null)
    setStripeClientSecret(null)
    fetchComanda()
  }

  const handleStripeCancel = () => {
    setMetodoPago(null)
    setStripeClientSecret(null)
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Cargando...</div>
      </div>
    )
  }

  if (!comanda) {
    return null
  }

  const totalConPropina = comanda.total * (1 + (comanda.propina || 0) / 100)
  const totalFinal = totalConPropina - (comanda.descuento || 0)

  return (
    <div className="p-8 text-black">
      <div className="mb-6">
        <BackButton className="mb-4" />
        <h1 className="text-3xl font-bold text-gray-900">
          Comanda {comanda.numeroComanda}
        </h1>
        <div className="mt-2 flex gap-4 text-sm text-gray-600">
          <span>
            {comanda.mesa ? `Mesa ${comanda.mesa.numero}` : 'Para llevar'}
          </span>
          <span>Estado: {comanda.estado}</span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Items</h2>
        <div className="space-y-3">
          {comanda.items.map((item) => (
            <div key={item.id} className="flex justify-between items-start border-b pb-3">
              <div className="flex-1">
                <div className="font-semibold">
                  {item.cantidad}x {item.producto.nombre}
                </div>
                <div className="text-sm text-gray-600">
                  {item.producto.categoria.nombre}
                </div>
                {item.notas && (
                  <div className="text-sm text-red-600 mt-1">📝 {item.notas}</div>
                )}
                <div className="text-sm text-gray-500 mt-1">
                  Estado: {item.estado}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">${item.subtotal.toFixed(2)}</div>
                <div className="text-sm text-gray-600">
                  ${item.precioUnitario.toFixed(2)} c/u
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 border-t pt-4 space-y-2">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>${comanda.total.toFixed(2)}</span>
          </div>
          {comanda.propina > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Propina ({comanda.propina}%):</span>
              <span>${(comanda.total * comanda.propina / 100).toFixed(2)}</span>
            </div>
          )}
          {comanda.descuento > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Descuento:</span>
              <span>-${comanda.descuento.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-bold border-t pt-2">
            <span>Total:</span>
            <span>${totalFinal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {comanda.estado !== 'PAGADO' && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Métodos de pago</h2>
          {metodoPago === null && (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setMetodoPago('efectivo')}
                className="flex items-center gap-2 px-5 py-3 border-2 border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 text-gray-800 font-medium"
              >
                <span className="text-2xl">💵</span>
                Efectivo
              </button>
              <button
                type="button"
                onClick={handleSeleccionarStripe}
                className="flex items-center gap-2 px-5 py-3 border-2 border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 text-gray-800 font-medium"
              >
                <span className="text-2xl">💳</span>
                Tarjeta / Apple Pay / Google Pay
              </button>
            </div>
          )}

          {metodoPago === 'efectivo' && (
            <div className="space-y-3">
              <p className="text-gray-600">
                Cobro en efectivo por <strong>${totalFinal.toFixed(2)}</strong>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCobrarEfectivo}
                  disabled={cobrandoEfectivo}
                  className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {cobrandoEfectivo ? 'Registrando…' : 'Cobrar en efectivo'}
                </button>
                <button
                  type="button"
                  onClick={() => setMetodoPago(null)}
                  className="bg-gray-200 text-gray-800 px-6 py-2 rounded-md hover:bg-gray-300"
                >
                  Cambiar método
                </button>
              </div>
            </div>
          )}

          {metodoPago === 'stripe' && stripeClientSecret && (
            <div className="max-w-md">
              <StripePaymentForm
                clientSecret={stripeClientSecret}
                comandaId={comanda.id}
                total={totalFinal}
                onSuccess={handleStripeSuccess}
                onCancel={handleStripeCancel}
              />
            </div>
          )}

          {metodoPago === 'stripe' && !stripeClientSecret && (
            <div className="text-gray-500">Preparando formulario de pago…</div>
          )}
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={() => router.push('/dashboard/mesas')}
          className="bg-gray-200 text-gray-800 px-6 py-2 rounded-md hover:bg-gray-300"
        >
          Volver a Mesas
        </button>
      </div>
    </div>
  )
}








