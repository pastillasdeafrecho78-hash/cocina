'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import BackButton from '@/components/BackButton'
import { authFetch } from '@/lib/auth-fetch'
import { colorProgresivoPorMinutos, minutosDesde } from '@/lib/mesa-utils'

interface Item {
  id: string
  cantidad: number
  producto: {
    nombre: string
    categoria: {
      nombre: string
    }
  }
  tamano?: { nombre: string } | null
  notas?: string
  estado: string
  createdAt: string
  fechaPreparacion?: string
  comanda: {
    numeroComanda: string
    mesa?: {
      numero: number
    } | null
    cliente?: {
      nombre: string
    } | null
  }
  modificadores: Array<{
    modificador: {
      nombre: string
    }
  }>
}

export default function CocinaPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pendiente' | 'listo'>('all')
  const [confirmando, setConfirmando] = useState<{ itemId: string; nuevoEstado: string; label: string } | null>(null)
  const [confirmandoGrupo, setConfirmandoGrupo] = useState<{ numeroComanda: string; accion: 'alistar' | 'entregar' } | null>(null)
  const [tiempoAmarilloMinutos, setTiempoAmarilloMinutos] = useState(30)
  const [tiempoRojoMinutos, setTiempoRojoMinutos] = useState(60)

  const fetchItems = async () => {
    try {
      const response = await authFetch('/api/comandas/cocina')
      if (response.status === 401) return

      const data = await response.json()

      if (data.success) {
        setItems(data.data)
      } else {
        toast.error('Error al cargar items')
      }
    } catch (error) {
      toast.error('Error al cargar items')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
    fetchConfiguracionTiempos()
    const interval = setInterval(fetchItems, 5000) // Refresh cada 5 segundos
    return () => clearInterval(interval)
  }, [])

  const fetchConfiguracionTiempos = async () => {
    try {
      const response = await authFetch('/api/configuracion/tiempos')
      if (response.status === 401) return
      const data = await response.json()
      if (data.success && data.data) {
        setTiempoAmarilloMinutos(data.data.tiempoAmarilloMinutos ?? 30)
        setTiempoRojoMinutos(data.data.tiempoRojoMinutos ?? 60)
      }
    } catch {
      // Conserva fallback 30/60 para no romper indicador de color si falla la carga.
    }
  }

  const abrirConfirmacion = (itemId: string, nuevoEstado: string, label: string) => {
    setConfirmando({ itemId, nuevoEstado, label })
  }

  const cerrarConfirmacion = () => setConfirmando(null)

  const handleAccionGrupo = async () => {
    if (!confirmandoGrupo) return
    const { numeroComanda, accion } = confirmandoGrupo
    const itemsGrupo = grupos[numeroComanda]
    if (!itemsGrupo?.length) {
      setConfirmandoGrupo(null)
      return
    }
    const estadoObjetivo = accion === 'alistar' ? 'LISTO' : 'ENTREGADO'
    const itemsAfectados = itemsGrupo.filter((i) =>
      accion === 'alistar'
        ? i.estado !== 'LISTO' && i.estado !== 'ENTREGADO'
        : i.estado === 'LISTO'
    )
    setConfirmandoGrupo(null)
    if (itemsAfectados.length === 0) {
      toast.error(accion === 'alistar' ? 'No hay items por alistar' : 'No hay items listos para entregar')
      return
    }
    try {
      const comandaRes = await authFetch(`/api/comandas?numeroComanda=${encodeURIComponent(numeroComanda)}`)
      if (comandaRes.status === 401) return
      const comandaData = await comandaRes.json()
      const comandaId = comandaData.data?.[0]?.id
      if (!comandaId) {
        toast.error('No se encontró la comanda')
        return
      }
      let ok = 0
      for (const item of itemsAfectados) {
        const res = await authFetch(`/api/comandas/${comandaId}/items/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: estadoObjetivo }),
        })
        const data = await res.json()
        if (data.success) ok++
      }
      if (ok > 0) {
        toast.success(ok === 1 ? '1 item actualizado' : `${ok} items actualizados`)
        fetchItems()
      }
    } catch {
      toast.error('Error al actualizar')
    }
  }

  const handleUpdateEstado = async () => {
    if (!confirmando) return
    const { itemId, nuevoEstado } = confirmando
    setConfirmando(null)
    try {
      const item = items.find((i) => i.id === itemId)
      if (!item) return

      const comandaResponse = await authFetch(`/api/comandas?numeroComanda=${encodeURIComponent(item.comanda.numeroComanda)}`)
      if (comandaResponse.status === 401) return
      const comandaData = await comandaResponse.json()
      const comandaId = comandaData.data?.[0]?.id

      if (!comandaId) {
        toast.error('No se encontró la comanda')
        return
      }

      const response = await authFetch(`/api/comandas/${comandaId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      if (response.status === 401) return

      const data = await response.json()

      if (data.success) {
        toast.success('Estado actualizado')
        fetchItems()
      } else {
        toast.error('Error al actualizar estado')
      }
    } catch {
      toast.error('Error al actualizar estado')
    }
  }

  const filteredItems = items.filter((item) => {
    if (filter === 'pendiente') return item.estado === 'PENDIENTE' || item.estado === 'EN_PREPARACION'
    if (filter === 'listo') return item.estado === 'LISTO'
    return true
  })

  const grupos = filteredItems.reduce<Record<string, Item[]>>((acc, item) => {
    const key = item.comanda.numeroComanda
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})
  const gruposOrdenados = Object.entries(grupos).sort(([keyA, a], [keyB, b]) => {
    const puedeAlistarA = a.some((i) => i.estado !== 'LISTO' && i.estado !== 'ENTREGADO')
    const puedeAlistarB = b.some((i) => i.estado !== 'LISTO' && i.estado !== 'ENTREGADO')
    const soloEntregarA = a.some((i) => i.estado === 'LISTO') && !puedeAlistarA
    const soloEntregarB = b.some((i) => i.estado === 'LISTO') && !puedeAlistarB
    if (soloEntregarA && !soloEntregarB) return 1
    if (!soloEntregarA && soloEntregarB) return -1
    const minA = Math.min(...a.map((i) => new Date(i.createdAt).getTime()))
    const minB = Math.min(...b.map((i) => new Date(i.createdAt).getTime()))
    return minA - minB
  })

  const ESTADO_LABELS: Record<string, string> = {
    PENDIENTE: 'Por preparar',
    EN_PREPARACION: 'Por preparar',
    LISTO: 'Listo para entregar',
    ENTREGADO: 'Entregado',
  }

  const getTiempoEspera = (fechaCreacion: string) => {
    return formatDistanceToNow(new Date(fechaCreacion), {
      addSuffix: false,
      locale: es,
    })
  }

  const getColorTiempo = (fechaCreacion: string) => {
    return colorProgresivoPorMinutos(
      minutosDesde(fechaCreacion),
      tiempoAmarilloMinutos,
      tiempoRojoMinutos
    )
  }

  if (loading) {
    return (
      <div className="app-page">
        <div className="app-card text-center text-stone-600">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="app-page">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="app-card">
          <BackButton className="mb-4" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="app-kicker">Cocina</p>
              <h1 className="mt-2 text-3xl font-semibold text-stone-900">Kitchen Display</h1>
              <p className="mt-1 text-stone-600">Seguimiento visual de preparación en cocina.</p>
            </div>
            <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'app-btn-primary' : 'app-btn-secondary'}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('pendiente')}
            className={filter === 'pendiente' ? 'app-btn-primary' : 'app-btn-secondary'}
          >
            Por preparar
          </button>
          <button
            onClick={() => setFilter('listo')}
            className={filter === 'listo' ? 'app-btn-primary' : 'app-btn-secondary'}
          >
            Listos
          </button>
            </div>
          </div>
        </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {gruposOrdenados.map(([numeroComanda, itemsGrupo]) => {
          const primer = itemsGrupo[0]
          const titulo = primer.comanda.mesa
            ? `Mesa ${primer.comanda.mesa.numero}`
            : primer.comanda.cliente?.nombre || 'Para llevar'
          const tiempoMasAntiguo = itemsGrupo.reduce(
            (min, i) => (new Date(i.createdAt).getTime() < min ? new Date(i.createdAt).getTime() : min),
            Number.MAX_SAFE_INTEGER
          )
          const fechaBase = new Date(tiempoMasAntiguo).toISOString()
          const colorTiempo = getColorTiempo(fechaBase)
          const tienePendiente = itemsGrupo.some((i) => i.estado === 'PENDIENTE')
          const tienePreparacion = itemsGrupo.some((i) => i.estado === 'EN_PREPARACION')
          const bordeClase = tienePendiente
            ? 'border-l-4 border-l-rose-500'
            : tienePreparacion
              ? 'border-l-4 border-l-amber-500'
              : 'border-l-4 border-l-emerald-500'

          return (
            <div key={numeroComanda} className={`app-card p-6 ${bordeClase}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-stone-900">{titulo}</h3>
                  <p className="text-sm text-stone-500">{numeroComanda}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium inline-flex items-center gap-1.5" style={{ color: colorTiempo }}>
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colorTiempo }} />
                    {getTiempoEspera(fechaBase)}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {itemsGrupo.map((item) => (
                  <div key={item.id} className="border-b border-stone-100 pb-4 last:border-0 last:pb-0">
                    <div className="mb-2">
                      <div className="text-base font-semibold">
                        {item.cantidad}x {item.producto.nombre}
                        {item.tamano && (
                          <span className="font-normal text-stone-600"> — {item.tamano.nombre}</span>
                        )}
                      </div>
                      <div className="text-sm text-stone-600">{item.producto.categoria.nombre}</div>
                      {item.notas && (
                        <div className="mt-1 text-sm text-rose-600">📝 {item.notas}</div>
                      )}
                      {item.modificadores.length > 0 && (
                        <div className="mt-1 text-sm text-stone-500">
                          {item.modificadores.map((m) => m.modificador.nombre).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {(item.estado === 'PENDIENTE' || item.estado === 'EN_PREPARACION') && (
                        <button
                          onClick={() => abrirConfirmacion(item.id, 'LISTO', 'Listo para entregar')}
                          className="app-btn-primary flex-1 bg-emerald-700 hover:bg-emerald-800 text-sm py-1.5"
                        >
                          Listo para entregar
                        </button>
                      )}
                      {item.estado === 'LISTO' && (
                        <button
                          onClick={() => abrirConfirmacion(item.id, 'ENTREGADO', 'Entregado')}
                          className="app-btn-primary flex-1 bg-violet-700 hover:bg-violet-800 text-sm py-1.5"
                        >
                          Entregado
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {itemsGrupo.length > 1 && (
                <div className="mt-4 pt-4 border-t border-stone-200 flex flex-col gap-2">
                  {itemsGrupo.some((i) => i.estado !== 'LISTO' && i.estado !== 'ENTREGADO') && (
                    <button
                      onClick={() => setConfirmandoGrupo({ numeroComanda, accion: 'alistar' })}
                      className="w-full rounded-lg bg-amber-600 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
                    >
                      Alistar todos
                    </button>
                  )}
                  {itemsGrupo.some((i) => i.estado === 'LISTO') && (
                    <button
                      onClick={() => setConfirmandoGrupo({ numeroComanda, accion: 'entregar' })}
                      className="w-full rounded-lg bg-violet-700 py-2.5 text-sm font-medium text-white hover:bg-violet-800"
                    >
                      Entregar todos
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {gruposOrdenados.length === 0 && (
        <div className="app-card text-center text-stone-500">
          No hay items pendientes
        </div>
      )}

      {confirmandoGrupo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setConfirmandoGrupo(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="app-card max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-bold text-stone-900">
              {confirmandoGrupo.accion === 'alistar' ? 'Alistar todos' : 'Entregar todos'}
            </h2>
            <p className="mb-6 text-stone-600">
              {confirmandoGrupo.accion === 'alistar'
                ? '¿Marcar todos los items de este grupo como listos para entregar?'
                : '¿Marcar todos los items listos como entregados?'}
            </p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setConfirmandoGrupo(null)} className="app-btn-secondary">
                Cancelar
              </button>
              <button type="button" onClick={handleAccionGrupo} className="app-btn-primary">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmando && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={cerrarConfirmacion}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="app-card max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-bold text-stone-900">Confirmar cambio</h2>
            <p className="mb-6 text-stone-600">
              ¿Cambiar estado a <strong>{confirmando.label}</strong>?
            </p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={cerrarConfirmacion} className="app-btn-secondary">
                Cancelar
              </button>
              <button type="button" onClick={handleUpdateEstado} className="app-btn-primary">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
