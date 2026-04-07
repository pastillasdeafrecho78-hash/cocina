'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type OrderData = {
  numeroComanda: string
  estado: string
  tipoPedido: string
  total: number
  restaurante: { nombre: string }
  items: Array<{
    id: string
    cantidad: number
    estado: string
    subtotal: number
    producto: { nombre: string }
    tamano: { nombre: string } | null
  }>
}

export default function PedidoTrackingPage({ params }: { params: { id: string } }) {
  const search = useSearchParams()
  const token = search.get('token') ?? ''
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<OrderData | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError('')
      try {
        if (!token) throw new Error('Token inválido')
        const res = await fetch(
          `/api/public/orders/${params.id}?token=${encodeURIComponent(token)}`,
          { cache: 'no-store' }
        )
        const json = (await res.json()) as {
          success?: boolean
          data?: OrderData
          error?: string
        }
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error ?? 'No se encontró el pedido')
        }
        if (!cancelled) setData(json.data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al consultar pedido')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [params.id, token])

  if (loading) return <main className="mx-auto max-w-3xl p-6">Consultando pedido...</main>
  if (error) return <main className="mx-auto max-w-3xl p-6 text-red-600">{error}</main>
  if (!data) return null

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-semibold">Pedido {data.numeroComanda}</h1>
      <p className="mt-1 text-sm text-stone-600">{data.restaurante.nombre}</p>
      <div className="mt-4 rounded-lg border border-stone-200 p-4">
        <p className="text-lg">
          Estado actual: <strong>{data.estado}</strong>
        </p>
        <p className="text-sm text-stone-600">Tipo: {data.tipoPedido}</p>
      </div>

      <div className="mt-6 space-y-2 rounded-lg border border-stone-200 p-4">
        {data.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between">
            <span>
              {item.cantidad} x {item.producto.nombre}
              {item.tamano ? ` (${item.tamano.nombre})` : ''}
            </span>
            <span>${item.subtotal.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-right text-xl font-semibold">Total: ${data.total.toFixed(2)}</p>
    </main>
  )
}
