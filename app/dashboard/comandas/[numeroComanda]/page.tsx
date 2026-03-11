'use client'

import { useEffect, useState } from 'react'
import { labelComandaEstado, labelItemEstado } from '@/lib/estado-labels'
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
    tamano?: { nombre: string } | null
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
  const [montoRecibido, setMontoRecibido] = useState('')
  const [confirmandoEntrega, setConfirmandoEntrega] = useState(false)

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
    const totalCobro = comanda.total * (1 + (comanda.propina || 0) / 100) - (comanda.descuento || 0)
    const recibido = parseFloat(montoRecibido.replace(/,/g, '.'))
    if (isNaN(recibido) || recibido < totalCobro) {
      toast.error('El monto recibido debe ser mayor o igual al total a cobrar')
      return
    }
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

  const handleConfirmarEntrega = async () => {
    if (!comanda || !hayItemsListos) return
    setConfirmandoEntrega(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/comandas/${comanda.id}/entregar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Entrega confirmada')
        fetchComanda()
      } else {
        toast.error(data.error ?? 'Error al confirmar entrega')
      }
    } catch {
      toast.error('Error al confirmar entrega')
    } finally {
      setConfirmandoEntrega(false)
    }
  }

  if (loading) {
    return (
      <div className="app-loading-shell">
        <div className="app-card text-center">Cargando...</div>
      </div>
    )
  }

  if (!comanda) return null

  const itemsListos = comanda.items.filter((i) => i.estado === 'LISTO')
  const hayItemsListos = itemsListos.length > 0

  const totalConPropina = comanda.total * (1 + (comanda.propina || 0) / 100)
  const totalFinal = totalConPropina - (comanda.descuento || 0)
  const montoRecibidoNum = parseFloat(montoRecibido.replace(/,/g, '.')) || 0
  const cambio = montoRecibidoNum >= totalFinal ? montoRecibidoNum - totalFinal : 0

  return (
    <div className="app-page">
      <div className="mb-6">
        <BackButton className="mb-4" />
        <h1 className="text-3xl font-bold text-gray-900">
          Comanda {comanda.numeroComanda}
        </h1>
        <div className="mt-2 flex gap-4 text-sm text-gray-600">
          <span>
            {comanda.mesa ? `Mesa ${comanda.mesa.numero}` : 'Para llevar'}
          </span>
          <span>Estado: {labelComandaEstado(comanda.estado)}</span>
        </div>
      </div>

      {hayItemsListos && (
        <div className="app-card mb-6 border-sky-200 bg-sky-50/50 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sky-800">
              <strong>{itemsListos.length}</strong> {itemsListos.length === 1 ? 'item listo' : 'items listos'} en cocina/barra. Confirma cuando los entregues a la mesa.
            </p>
            <button
              onClick={handleConfirmarEntrega}
              disabled={confirmandoEntrega}
              className="rounded-lg bg-sky-600 px-5 py-2 font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {confirmandoEntrega ? 'Confirmando…' : 'Confirmar entrega'}
            </button>
          </div>
        </div>
      )}

      <div className="app-card mb-6 p-6">
        <h2 className="text-xl font-bold mb-4">Items</h2>
        <div className="space-y-3">
          {comanda.items.map((item) => (
            <div key={item.id} className="flex justify-between items-start border-b pb-3">
              <div className="flex-1">
                <div className="font-semibold">
                  {item.cantidad}x {item.producto.nombre}
                  {item.tamano && (
                    <span className="font-normal text-gray-600"> — {item.tamano.nombre}</span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  {item.producto.categoria.nombre}
                </div>
                {item.notas && (
                  <div className="text-sm text-red-600 mt-1">📝 {item.notas}</div>
                )}
                <div className="text-sm text-gray-500 mt-1">
                  Estado: {labelItemEstado(item.estado)}
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
        <div className="app-card mb-6 p-6">
          <h2 className="text-xl font-bold mb-4">Métodos de pago</h2>
          {!comanda.items.every(
            (i) => i.estado === 'LISTO' || i.estado === 'ENTREGADO'
          ) ? (
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              No se puede cobrar hasta que todos los productos estén marcados
              como listos en cocina.
            </p>
          ) : metodoPago === null ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setMetodoPago('efectivo')}
                className="flex items-center gap-2 rounded-2xl border-2 border-gray-300 px-5 py-3 font-medium text-gray-800 hover:border-green-500 hover:bg-green-50"
              >
                <span className="text-2xl">💵</span>
                Efectivo
              </button>
              <button
                type="button"
                onClick={handleSeleccionarStripe}
                className="flex items-center gap-2 rounded-2xl border-2 border-gray-300 px-5 py-3 font-medium text-gray-800 hover:border-indigo-500 hover:bg-indigo-50"
              >
                <span className="text-2xl">💳</span>
                Tarjeta / Apple Pay / Google Pay
              </button>
            </div>
          ) : metodoPago === 'efectivo' ? (
            <div className="space-y-4">
              <p className="text-gray-600">
                Total a cobrar: <strong>${totalFinal.toFixed(2)}</strong>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto recibido</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={montoRecibido}
                  onChange={(e) => setMontoRecibido(e.target.value)}
                  placeholder="0.00"
                  className="app-input max-w-xs text-lg focus:border-green-500 focus:ring-green-500/20"
                />
              </div>
              {montoRecibidoNum >= totalFinal && montoRecibidoNum > 0 && (
                <p className="rounded-2xl bg-green-50 px-4 py-2 text-lg font-semibold text-green-700">
                  Cambio a devolver: <strong>${cambio.toFixed(2)}</strong>
                </p>
              )}
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCobrarEfectivo}
                  disabled={cobrandoEfectivo || montoRecibidoNum < totalFinal}
                  className="rounded-2xl bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cobrandoEfectivo ? 'Registrando…' : 'Cobrar en efectivo'}
                </button>
                <button
                  type="button"
                  onClick={() => { setMetodoPago(null); setMontoRecibido('') }}
                  className="app-btn-secondary rounded-2xl px-6 py-2"
                >
                  Cambiar método
                </button>
              </div>
            </div>
          ) : metodoPago === 'stripe' && stripeClientSecret ? (
            <div className="max-w-md">
              <StripePaymentForm
                clientSecret={stripeClientSecret}
                comandaId={comanda.id}
                total={totalFinal}
                onSuccess={handleStripeSuccess}
                onCancel={handleStripeCancel}
              />
            </div>
          ) : metodoPago === 'stripe' ? (
            <div className="text-gray-500">Preparando formulario de pago…</div>
          ) : null}
        </div>
      )}

      <div className="flex gap-4 flex-wrap">
        {comanda.estado !== 'PAGADO' && comanda.estado !== 'CANCELADO' && (
          <button
            onClick={() => router.push(`/dashboard/comandas/nueva?comandaId=${comanda.id}`)}
            className="app-btn-primary rounded-2xl px-6 py-2"
          >
            + Agregar más pedidos
          </button>
        )}
        <button
          onClick={() => router.push('/dashboard/mesas')}
          className="app-btn-secondary rounded-2xl px-6 py-2"
        >
          Volver a Mesas
        </button>
      </div>
    </div>
  )
}








