'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type MenuProducto = {
  id: string
  nombre: string
  descripcion: string | null
  precio: number
}

type MenuCategoria = {
  id: string
  nombre: string
  productos: MenuProducto[]
}

type MenuResponse = {
  restaurante: { id: string; nombre: string; slug: string | null }
  categorias: MenuCategoria[]
}

export default function PublicMenuPage({ params }: { params: { slug: string } }) {
  const searchParams = useSearchParams()
  const mesaCode = searchParams.get('mesa')?.trim() || ''
  const [loading, setLoading] = useState(true)
  const [menu, setMenu] = useState<MenuResponse | null>(null)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ solicitudId: string } | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [customer, setCustomer] = useState({
    nombre: '',
    telefono: '',
    notas: '',
    tipoPedido: mesaCode ? 'MESA' : 'PARA_LLEVAR',
  })

  useEffect(() => {
    if (mesaCode) {
      setCustomer((prev) => ({ ...prev, tipoPedido: 'MESA' }))
    }
  }, [mesaCode])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError('')
      try {
        const menuUrl = mesaCode
          ? `/api/public/menu/${params.slug}?mesa=${encodeURIComponent(mesaCode)}`
          : `/api/public/menu/${params.slug}`
        const res = await fetch(menuUrl, { cache: 'no-store' })
        const data = (await res.json()) as { success?: boolean; data?: MenuResponse; error?: string }
        if (!res.ok || !data.success || !data.data) {
          throw new Error(data.error ?? 'No se pudo cargar el menú')
        }
        if (!cancelled) {
          setMenu(data.data)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar menú')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [mesaCode, params.slug])

  const selectedItems = useMemo(() => {
    if (!menu) return []
    const products = menu.categorias.flatMap((c) => c.productos)
    return products
      .map((p) => ({ productoId: p.id, cantidad: quantities[p.id] ?? 0, nombre: p.nombre, precio: p.precio }))
      .filter((x) => x.cantidad > 0)
  }, [menu, quantities])

  const total = useMemo(
    () => selectedItems.reduce((acc, item) => acc + item.cantidad * item.precio, 0),
    [selectedItems]
  )

  const submitOrder = async () => {
    if (!menu) return
    if (!customer.nombre.trim()) {
      setError('Escribe tu nombre para continuar')
      return
    }
    if (selectedItems.length === 0) {
      setError('Selecciona al menos un producto')
      return
    }

    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/public/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: params.slug,
          mesaCode: mesaCode || undefined,
          tipoPedido: customer.tipoPedido,
          cliente: {
            nombre: customer.nombre.trim(),
            telefono: customer.telefono.trim() || null,
            notas: customer.notas.trim() || null,
          },
          items: selectedItems.map((item) => ({
            productoId: item.productoId,
            cantidad: item.cantidad,
          })),
        }),
      })
      const data = (await res.json()) as {
        success?: boolean
        data?: { id: string }
        error?: string
      }
      if (!res.ok || !data.success || !data.data) {
        throw new Error(data.error ?? 'No se pudo crear la solicitud')
      }
      setResult({ solicitudId: data.data.id })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la solicitud')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-4xl p-6">Cargando menú...</main>
  }
  if (error && !menu) {
    return <main className="mx-auto max-w-4xl p-6 text-red-600">{error}</main>
  }
  if (!menu) return null

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-3xl font-semibold">{menu.restaurante.nombre}</h1>
      <p className="mt-1 text-sm text-stone-600">
        Pedido directo (se registra como solicitud pendiente)
      </p>
      {mesaCode && (
        <p className="mt-1 text-sm text-emerald-700">Ingreso detectado por QR de mesa.</p>
      )}

      {result ? (
        <div className="mt-6 rounded-lg border border-emerald-400 bg-emerald-50 p-4">
          <p className="font-semibold text-emerald-900">Solicitud recibida correctamente</p>
          <p className="mt-2 text-sm text-emerald-900">
            Folio de solicitud: <strong>{result.solicitudId}</strong>
          </p>
          <p className="mt-1 text-sm text-emerald-900">
            El restaurante la revisará antes de enviarla a cocina/barra.
          </p>
        </div>
      ) : (
        <>
          <section className="mt-6 space-y-6">
            {menu.categorias.map((cat) => (
              <div key={cat.id} className="rounded-xl border border-stone-200 p-4">
                <h2 className="text-xl font-semibold">{cat.nombre}</h2>
                <div className="mt-3 space-y-2">
                  {cat.productos.map((prod) => (
                    <div key={prod.id} className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{prod.nombre}</p>
                        <p className="text-sm text-stone-600">${prod.precio.toFixed(2)}</p>
                      </div>
                      <input
                        type="number"
                        min={0}
                        className="w-20 rounded border border-stone-300 px-2 py-1"
                        value={quantities[prod.id] ?? 0}
                        onChange={(e) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [prod.id]: Math.max(0, Number(e.target.value || 0)),
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="mt-8 rounded-xl border border-stone-200 p-4">
            <h2 className="text-xl font-semibold">Tus datos</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                className="app-input"
                placeholder="Nombre completo"
                value={customer.nombre}
                onChange={(e) => setCustomer((p) => ({ ...p, nombre: e.target.value }))}
              />
              <input
                className="app-input"
                placeholder="Teléfono (opcional)"
                value={customer.telefono}
                onChange={(e) => setCustomer((p) => ({ ...p, telefono: e.target.value }))}
              />
              <input
                className="app-input md:col-span-2"
                placeholder="Notas para el pedido (opcional)"
                value={customer.notas}
                onChange={(e) => setCustomer((p) => ({ ...p, notas: e.target.value }))}
              />
              <select
                className="app-input"
                value={customer.tipoPedido}
                disabled={!!mesaCode}
                onChange={(e) => setCustomer((p) => ({ ...p, tipoPedido: e.target.value }))}
              >
                <option value="PARA_LLEVAR">Para llevar</option>
                <option value="ENVIO">Envío</option>
                <option value="MESA">Mesa</option>
              </select>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="font-medium">Total estimado: ${total.toFixed(2)}</span>
              <button type="button" className="app-btn-primary" disabled={sending} onClick={submitOrder}>
                {sending ? 'Enviando...' : 'Confirmar pedido'}
              </button>
            </div>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </section>
        </>
      )}
    </main>
  )
}
