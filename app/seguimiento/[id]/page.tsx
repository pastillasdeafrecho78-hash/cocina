'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

type SeguimientoData = {
  solicitudId: string
  phase: string
  phaseLabel: string
  updatedAt: string
  estado: string
  queuePosition: number | null
  waitSeconds: number
  etaMinMinutes: number
  etaMaxMinutes: number
  loadFactor: number
  comanda: { id: string; numeroComanda: string; estado: string } | null
  items: Array<{ cantidad: number; estado: string; destino: string; nombre: string }>
}

const PHASE_ORDER = [
  'received',
  'validating',
  'queue',
  'accepted',
  'preparation',
  'ready',
  'cancelled',
] as const

function phaseIndex(phase: string): number {
  const i = PHASE_ORDER.indexOf(phase as (typeof PHASE_ORDER)[number])
  return i === -1 ? 0 : i
}

export default function SeguimientoPedidoPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = String(params?.id ?? '').trim()
  const token = searchParams.get('t')?.trim() ?? ''

  const [data, setData] = useState<SeguimientoData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  const pollUrl = useMemo(() => {
    if (!id || !token) return ''
    const q = new URLSearchParams({ token })
    return `/api/public/solicitudes/${encodeURIComponent(id)}/seguimiento?${q.toString()}`
  }, [id, token])

  const load = useCallback(async () => {
    if (!pollUrl) return
    try {
      const res = await fetch(pollUrl, { cache: 'no-store' })
      const json = (await res.json()) as { success?: boolean; data?: SeguimientoData; error?: string }
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? 'No se pudo cargar el seguimiento')
      }
      setData(json.data)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [pollUrl])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 12000)
    return () => clearInterval(t)
  }, [load])

  const canCancel =
    data &&
    (data.estado === 'PENDIENTE' || data.estado === 'EN_COLA') &&
    data.phase !== 'cancelled'

  const handleCancel = async () => {
    if (!id || !token || !canCancel) return
    if (!window.confirm('¿Cancelar tu solicitud? Esta acción no se puede deshacer.')) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/public/solicitudes/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'No se pudo cancelar')
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cancelar')
    } finally {
      setCancelling(false)
    }
  }

  if (!id || !token) {
    return (
      <div className="app-page">
        <div className="app-card text-center text-red-600">
          Enlace incompleto: falta el identificador o el token de seguimiento.
        </div>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="app-loading-shell">
        <div className="app-card text-center">Cargando seguimiento…</div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="app-page">
        <div className="app-card text-center text-red-600">{error}</div>
      </div>
    )
  }

  if (!data) return null

  const currentIdx = phaseIndex(data.phase)
  const stepperLabels: Record<string, string> = {
    received: 'Recibido',
    validating: 'Validación',
    queue: 'Cola',
    accepted: 'Aceptado',
    preparation: 'Preparación',
    ready: 'Listo',
    cancelled: 'Cancelado',
  }

  return (
    <div className="app-page mx-auto max-w-lg space-y-6">
      <div className="app-card space-y-4">
        <p className="app-kicker">Seguimiento de pedido</p>
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">{data.phaseLabel}</h1>
        <p className="text-sm text-stone-600 dark:text-stone-300">
          Actualizado: {new Date(data.updatedAt).toLocaleString('es-MX')}
        </p>
        {data.queuePosition != null && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
            Posición en cola: <strong>{data.queuePosition}</strong>
            {data.waitSeconds > 0 && (
              <>
                {' '}
                · Espera aprox.: <strong>{Math.ceil(data.waitSeconds / 60)} min</strong>
              </>
            )}
          </p>
        )}
        <p className="text-sm text-stone-700 dark:text-stone-200">
          Tiempo estimado: <strong>{data.etaMinMinutes}–{data.etaMaxMinutes} min</strong>
        </p>
        {data.comanda && (
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Comanda <span className="font-mono font-semibold">#{data.comanda.numeroComanda}</span> ·{' '}
            {data.comanda.estado}
          </p>
        )}
      </div>

      <div className="app-card">
        <p className="mb-3 text-sm font-medium text-stone-700 dark:text-stone-200">Avance</p>
        <ol className="flex flex-wrap gap-2">
          {PHASE_ORDER.filter((p) => p !== 'received').map((p) => {
            const idx = phaseIndex(p)
            const done = idx < currentIdx
            const active = p === data.phase
            return (
              <li
                key={p}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  active
                    ? 'bg-emerald-600 text-white'
                    : done
                      ? 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-100'
                      : 'border border-stone-200 text-stone-500 dark:border-stone-600 dark:text-stone-400'
                }`}
              >
                {stepperLabels[p]}
              </li>
            )
          })}
        </ol>
      </div>

      {data.items.length > 0 && (
        <div className="app-card space-y-2">
          <p className="text-sm font-medium text-stone-800 dark:text-stone-100">Productos</p>
          <ul className="space-y-2 text-sm text-stone-700 dark:text-stone-200">
            {data.items.map((it, i) => (
              <li key={i} className="flex justify-between gap-2 border-b border-stone-100 pb-2 last:border-0 dark:border-stone-800">
                <span>
                  {it.cantidad}× {it.nombre}
                </span>
                <span className="shrink-0 text-stone-500">{it.estado}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canCancel && (
        <div className="flex justify-center">
          <button
            type="button"
            className="app-btn-secondary"
            disabled={cancelling}
            onClick={() => void handleCancel()}
          >
            {cancelling ? 'Cancelando…' : 'Cancelar solicitud'}
          </button>
        </div>
      )}

      {error && data && <p className="text-center text-sm text-amber-700 dark:text-amber-300">{error}</p>}
    </div>
  )
}
