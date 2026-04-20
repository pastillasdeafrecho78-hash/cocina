'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import {
  ComandaBuilder,
  type Categoria,
  type ComandaCheckoutItem,
} from '@/components/ComandaBuilder'
import toast from 'react-hot-toast'

type MenuResponse = {
  restaurante: { id: string; nombre: string; slug: string | null }
  mesa: { id: string; numero: number } | null
  categorias: Categoria[]
}

type SolicitudResult = {
  solicitudId: string
  estado?: string
  totalEstimado?: number
  approvedComanda?: { id: string; numeroComanda: string } | null
  trackerUrl?: string
  trackingToken?: string
}

export default function PublicPedidoPage() {
  const routeParams = useParams()
  const searchParams = useSearchParams()
  const slug = String(routeParams?.slug ?? '')
    .trim()
    .toLowerCase()
  const mesaCode = searchParams.get('mesa')?.trim() || ''

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [menu, setMenu] = useState<MenuResponse | null>(null)
  const [result, setResult] = useState<SolicitudResult | null>(null)
  const [acceptEnCola, setAcceptEnCola] = useState(false)

  const [customer, setCustomer] = useState({
    nombre: '',
    telefono: '',
    notas: '',
    tipoPedido: mesaCode ? 'MESA' : 'PARA_LLEVAR',
  } as {
    nombre: string
    telefono: string
    notas: string
    tipoPedido: 'MESA' | 'PARA_LLEVAR' | 'ENVIO'
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
      setLoadError('')
      try {
        const menuUrl = mesaCode
          ? `/api/public/menu/${encodeURIComponent(slug)}?mesa=${encodeURIComponent(mesaCode)}`
          : `/api/public/menu/${encodeURIComponent(slug)}`
        const res = await fetch(menuUrl, { cache: 'no-store' })
        const data = (await res.json()) as { success?: boolean; data?: MenuResponse; error?: string }
        if (!res.ok || !data.success || !data.data) {
          throw new Error(data.error ?? 'No se pudo cargar el menú')
        }
        if (!cancelled) setMenu(data.data)
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Error al cargar menú')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (slug) void run()
    return () => {
      cancelled = true
    }
  }, [mesaCode, slug])

  const onCheckout = useCallback(
    async (payload: {
      items: ComandaCheckoutItem[]
      observaciones: string
      mesaId?: string
      tipoPedido?: 'EN_MESA' | 'PARA_LLEVAR' | 'A_DOMICILIO' | 'WHATSAPP'
      comandaId?: string | null
    }) => {
      if (!customer.nombre.trim()) {
        return { ok: false, error: 'Escribe tu nombre para continuar' }
      }
      if (payload.items.length === 0) {
        return { ok: false, error: 'Agrega al menos un producto' }
      }
      try {
        const res = await fetch('/api/public/solicitudes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            mesaCode: mesaCode || undefined,
            tipoPedido: customer.tipoPedido,
            acceptEnCola,
            cliente: {
              nombre: customer.nombre.trim(),
              telefono: customer.telefono.trim() || null,
              notas: customer.notas.trim() || null,
            },
            items: payload.items.map((item) => ({
              productoId: item.productoId,
              tamanoId: item.tamanoId,
              cantidad: item.cantidad,
              notas: item.notas,
              modificadores: item.modificadores,
            })),
            observaciones: payload.observaciones.trim() || undefined,
          }),
        })
        const data = (await res.json()) as {
          success?: boolean
          code?: string
          data?: {
            id: string
            estado?: string
            totalEstimado?: number
            approvedComanda?: { id: string; numeroComanda: string } | null
            trackerUrl?: string
            trackingToken?: string
          }
          error?: string
        }
        if (res.status === 409 && data.code === 'restaurant_saturated') {
          const base =
            data.error ??
            'El restaurante está al límite de capacidad. Puedes entrar en cola de espera si lo deseas.'
          return {
            ok: false,
            error: `${base} Marca la opción «Acepto entrar en cola…» abajo y vuelve a enviar tu pedido.`,
          }
        }
        if (!res.ok || !data.success || !data.data) {
          const msg =
            data.code === 'client_orders_disabled'
              ? 'En esta sucursal el pedido en línea no está disponible por ahora. Pide en mostrador o vuelve más tarde.'
              : (data.error ?? 'No se pudo crear la solicitud')
          return { ok: false, error: msg }
        }
        setAcceptEnCola(false)
        setResult({
          solicitudId: data.data.id,
          estado: data.data.estado,
          totalEstimado: data.data.totalEstimado,
          approvedComanda: data.data.approvedComanda ?? null,
          trackerUrl: data.data.trackerUrl,
          trackingToken: data.data.trackingToken,
        })
        return {
          ok: true,
          message: 'Solicitud recibida',
        }
      } catch {
        return { ok: false, error: 'No se pudo enviar el pedido' }
      }
    },
    [acceptEnCola, customer.nombre, customer.notas, customer.telefono, customer.tipoPedido, mesaCode, slug]
  )

  if (!slug) {
    return (
      <div className="app-page">
        <div className="app-card text-center text-red-600">Sucursal inválida</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="app-loading-shell">
        <div className="app-card text-center">Cargando menú...</div>
      </div>
    )
  }

  if (loadError || !menu) {
    return (
      <div className="app-page">
        <div className="app-card text-center text-red-600">{loadError || 'No se pudo cargar el menú'}</div>
      </div>
    )
  }

  if (result) {
    return (
      <div className="app-page">
        <div className="app-card border-emerald-200 bg-emerald-50/90 dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="app-kicker text-emerald-800 dark:text-emerald-200">Pedido en línea</p>
          <h1 className="mt-2 text-2xl font-semibold text-emerald-950 dark:text-emerald-50">
            Solicitud recibida
          </h1>
          <p className="mt-2 text-sm text-emerald-900 dark:text-emerald-100">
            Folio: <span className="font-mono font-semibold">{result.solicitudId}</span>
            {result.estado ? (
              <>
                {' '}
                · Estado: <strong>{result.estado}</strong>
              </>
            ) : null}
          </p>
          {typeof result.totalEstimado === 'number' && (
            <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-100">
              Total estimado: <strong>${result.totalEstimado.toFixed(2)}</strong>
            </p>
          )}
          {result.approvedComanda && (
            <p className="mt-2 text-sm text-emerald-900 dark:text-emerald-100">
              Tu pedido entró como comanda <strong>#{result.approvedComanda.numeroComanda}</strong>.
            </p>
          )}
          <p className="mt-3 text-sm text-emerald-800 dark:text-emerald-200">
            El restaurante la revisará según su configuración (cola / aprobación automática).
          </p>
          {result.trackerUrl && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-white/80 p-3 dark:border-emerald-800 dark:bg-stone-950/50">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                Seguimiento en vivo
              </p>
              <p className="mt-1 break-all font-mono text-xs text-emerald-900 dark:text-emerald-100">
                {result.trackerUrl}
              </p>
              <button
                type="button"
                className="app-btn-secondary mt-2"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(result.trackerUrl!)
                    toast.success('Enlace copiado')
                  } catch {
                    toast.error('No se pudo copiar')
                  }
                }}
              >
                Copiar enlace de seguimiento
              </button>
              <p className="mt-2 text-xs text-emerald-800/90 dark:text-emerald-200/90">
                Guarda este enlace: no volverá a mostrarse el token de acceso.
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  const subtitle = mesaCode
    ? `Pedido en línea · QR / link de mesa`
    : `Pedido en línea · menú general`

  return (
    <ComandaBuilder
      categorias={menu.categorias}
      mesas={[]}
      showStaffTipoMesaControls={false}
      kicker={menu.restaurante.nombre}
      title="Nueva Comanda"
      subtitle={subtitle}
      observacionesLabel="Notas para el restaurante"
      observacionesPlaceholder="Alergias, tiempo de espera, indicaciones generales…"
      footerBeforeSubmit={
        <div className="mb-4 space-y-3 rounded-xl border border-stone-200 bg-stone-50/80 p-3 dark:border-stone-700 dark:bg-stone-900/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Tus datos</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                className="app-input app-field w-full"
                placeholder="Nombre para el folio"
                value={customer.nombre}
                onChange={(e) => setCustomer((p) => ({ ...p, nombre: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
                Teléfono (opcional)
              </label>
              <input
                className="app-input app-field w-full"
                placeholder="WhatsApp / contacto"
                value={customer.telefono}
                onChange={(e) => setCustomer((p) => ({ ...p, telefono: e.target.value }))}
              />
            </div>
            {!mesaCode ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
                  Tipo de pedido
                </label>
                <select
                  className="app-input app-field w-full"
                  value={customer.tipoPedido === 'MESA' ? 'PARA_LLEVAR' : customer.tipoPedido}
                  onChange={(e) =>
                    setCustomer((p) => ({
                      ...p,
                      tipoPedido: e.target.value as 'PARA_LLEVAR' | 'ENVIO',
                    }))
                  }
                >
                  <option value="PARA_LLEVAR">Para llevar</option>
                  <option value="ENVIO">Envío</option>
                </select>
              </div>
            ) : null}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
                Notas para tu pedido (opcional)
              </label>
              <input
                className="app-input app-field w-full"
                placeholder="Ej. sin picante, bien cocido…"
                value={customer.notas}
                onChange={(e) => setCustomer((p) => ({ ...p, notas: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex cursor-pointer items-start gap-2 text-sm text-stone-700 dark:text-stone-300">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={acceptEnCola}
                  onChange={(e) => setAcceptEnCola(e.target.checked)}
                />
                <span>
                  Si el restaurante está saturado, <strong>acepto entrar en cola de espera</strong> en lugar de que se
                  rechace el pedido.
                </span>
              </label>
            </div>
          </div>
        </div>
      }
      onCheckout={onCheckout}
    />
  )
}
