'use client'

import { useEffect, useMemo, useState } from 'react'
import BackButton from '@/components/BackButton'
import { authFetch } from '@/lib/auth-fetch'
import toast from 'react-hot-toast'

type Solicitud = {
  id: string
  estado: 'PENDIENTE' | 'EN_COLA' | 'APROBADA' | 'RECHAZADA' | 'EXPIRADA'
  tipoPedido: 'MESA' | 'PARA_LLEVAR' | 'ENVIO'
  origen: 'PUBLIC_LINK_GENERAL' | 'PUBLIC_LINK_MESA'
  nombreCliente: string
  telefono: string | null
  notas: string | null
  observaciones: string | null
  totalEstimado: number
  createdAt: string
  mesa: { id: string; numero: number } | null
  approvedComanda: { id: string; numeroComanda: string; estado: string } | null
  items: Array<{
    id: string
    cantidad: number
    subtotal: number
    notas: string | null
    producto: { id: string; nombre: string }
    tamano: { id: string; nombre: string } | null
  }>
}

export default function SolicitudesPage() {
  const [loading, setLoading] = useState(true)
  const [estado, setEstado] = useState<'PENDIENTE' | 'EN_COLA' | 'APROBADA' | 'RECHAZADA' | 'TODAS'>('PENDIENTE')
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [workingId, setWorkingId] = useState<string | null>(null)

  const fetchSolicitudes = async () => {
    try {
      const res = await authFetch(`/api/solicitudes?estado=${estado}`)
      if (res.status === 401) return
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'No se pudieron cargar las solicitudes')
      setSolicitudes(data.data || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error cargando solicitudes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    void fetchSolicitudes()
    const interval = setInterval(() => void fetchSolicitudes(), 7000)
    return () => clearInterval(interval)
  }, [estado])

  const grouped = useMemo(() => {
    return solicitudes.map((sol) => ({
      ...sol,
      totalItems: sol.items.reduce((acc, i) => acc + i.cantidad, 0),
    }))
  }, [solicitudes])

  const handleAction = async (
    solicitudId: string,
    action: 'aprobar' | 'rechazar' | 'forzar' | 'saltar-cola'
  ) => {
    setWorkingId(solicitudId)
    try {
      const res = await authFetch(`/api/solicitudes/${solicitudId}/${action}`, { method: 'POST' })
      if (res.status === 401) return
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'No se pudo completar la acción')
      if (action === 'aprobar') toast.success('Solicitud aprobada')
      else if (action === 'rechazar') toast.success('Solicitud rechazada')
      else if (action === 'forzar') toast.success('Solicitud forzada a comanda')
      else toast.success('Solicitud de cola promovida')
      await fetchSolicitudes()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error procesando solicitud')
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <div className="app-page">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="app-card">
          <BackButton className="mb-4" />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="app-kicker">Pedidos cliente</p>
              <h1 className="mt-2 text-3xl font-semibold text-stone-900">Solicitudes</h1>
              <p className="mt-1 text-stone-600">
                Revisa solicitudes de link/QR y decide si se convierten en comanda real.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-stone-600">Estado</label>
              <select
                className="app-input"
                value={estado}
                onChange={(e) => setEstado(e.target.value as typeof estado)}
              >
                <option value="PENDIENTE">Pendientes</option>
                <option value="EN_COLA">En cola</option>
                <option value="APROBADA">Aprobadas</option>
                <option value="RECHAZADA">Rechazadas</option>
                <option value="TODAS">Todas</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="app-card text-center text-stone-600">Cargando solicitudes...</div>
        ) : grouped.length === 0 ? (
          <div className="app-card text-center text-stone-500">No hay solicitudes en este filtro.</div>
        ) : (
          <div className="space-y-4">
            {grouped.map((sol) => (
              <div key={sol.id} className="app-card space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-stone-900">
                      {sol.nombreCliente} · {sol.tipoPedido.replace('_', ' ')}
                    </h3>
                    <p className="text-sm text-stone-500">
                      {sol.origen === 'PUBLIC_LINK_MESA' ? `QR Mesa ${sol.mesa?.numero ?? '-'}` : 'Link general'} ·{' '}
                      {new Date(sol.createdAt).toLocaleString('es-MX')}
                    </p>
                    <p className="text-sm text-stone-600">
                      {sol.totalItems} items · ${sol.totalEstimado.toFixed(2)}
                    </p>
                    {sol.telefono && <p className="text-sm text-stone-600">Tel: {sol.telefono}</p>}
                    {sol.notas && <p className="text-sm text-stone-600">Notas: {sol.notas}</p>}
                    {sol.observaciones && <p className="text-sm text-stone-600">Obs: {sol.observaciones}</p>}
                    {sol.approvedComanda && (
                      <p className="text-sm text-emerald-700">
                        Convertida en comanda {sol.approvedComanda.numeroComanda}
                      </p>
                    )}
                  </div>
                  <span className="app-badge">{sol.estado}</span>
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {sol.items.map((item) => (
                    <div key={item.id} className="rounded-lg border border-stone-200 p-3">
                      <p className="font-medium text-stone-900">
                        {item.cantidad}x {item.producto.nombre}
                        {item.tamano ? ` (${item.tamano.nombre})` : ''}
                      </p>
                      <p className="text-sm text-stone-600">${item.subtotal.toFixed(2)}</p>
                      {item.notas && <p className="text-sm text-stone-500">{item.notas}</p>}
                    </div>
                  ))}
                </div>

                {sol.estado === 'PENDIENTE' && (
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="app-btn-secondary"
                      disabled={workingId === sol.id}
                      onClick={() => handleAction(sol.id, 'rechazar')}
                    >
                      Rechazar
                    </button>
                    <button
                      type="button"
                      className="app-btn-primary"
                      disabled={workingId === sol.id}
                      onClick={() => handleAction(sol.id, 'aprobar')}
                    >
                      Aprobar y crear comanda
                    </button>
                    <button
                      type="button"
                      className="app-btn-secondary"
                      disabled={workingId === sol.id}
                      onClick={() => handleAction(sol.id, 'forzar')}
                    >
                      Forzar aceptación
                    </button>
                  </div>
                )}

                {sol.estado === 'EN_COLA' && (
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="app-btn-secondary"
                      disabled={workingId === sol.id}
                      onClick={() => handleAction(sol.id, 'rechazar')}
                    >
                      Rechazar
                    </button>
                    <button
                      type="button"
                      className="app-btn-secondary"
                      disabled={workingId === sol.id}
                      onClick={() => handleAction(sol.id, 'saltar-cola')}
                    >
                      Saltar cola
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
