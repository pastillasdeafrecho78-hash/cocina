'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import BackButton from '@/components/BackButton'

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
  const [filter, setFilter] = useState<'all' | 'pendiente' | 'preparacion' | 'listo'>('all')
  const [confirmando, setConfirmando] = useState<{ itemId: string; nuevoEstado: string; label: string } | null>(null)

  const fetchItems = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/comandas/cocina', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

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
    const interval = setInterval(fetchItems, 5000) // Refresh cada 5 segundos
    return () => clearInterval(interval)
  }, [])

  const abrirConfirmacion = (itemId: string, nuevoEstado: string, label: string) => {
    setConfirmando({ itemId, nuevoEstado, label })
  }

  const cerrarConfirmacion = () => setConfirmando(null)

  const handleUpdateEstado = async () => {
    if (!confirmando) return
    const { itemId, nuevoEstado } = confirmando
    setConfirmando(null)
    try {
      const token = localStorage.getItem('token')
      const item = items.find((i) => i.id === itemId)
      if (!item) return

      const comandaResponse = await fetch(`/api/comandas?numeroComanda=${encodeURIComponent(item.comanda.numeroComanda)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const comandaData = await comandaResponse.json()
      const comandaId = comandaData.data?.[0]?.id

      if (!comandaId) {
        toast.error('No se encontró la comanda')
        return
      }

      const response = await fetch(`/api/comandas/${comandaId}/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ estado: nuevoEstado }),
      })

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
    if (filter === 'pendiente') return item.estado === 'PENDIENTE'
    if (filter === 'preparacion') return item.estado === 'EN_PREPARACION'
    if (filter === 'listo') return item.estado === 'LISTO'
    return true
  })

  const ESTADO_LABELS: Record<string, string> = {
    PENDIENTE: 'Por preparar',
    EN_PREPARACION: 'Preparando',
    LISTO: 'Listo para entregar',
    ENTREGADO: 'Entregado',
  }

  const getTiempoEspera = (fechaCreacion: string) => {
    return formatDistanceToNow(new Date(fechaCreacion), {
      addSuffix: false,
      locale: es,
    })
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
            onClick={() => setFilter('preparacion')}
            className={filter === 'preparacion' ? 'app-btn-primary' : 'app-btn-secondary'}
          >
            Preparando
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
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className={`
              app-card p-6
              ${item.estado === 'PENDIENTE' ? 'border-l-4 border-l-rose-500' : ''}
              ${item.estado === 'EN_PREPARACION' ? 'border-l-4 border-l-amber-500' : ''}
              ${item.estado === 'LISTO' ? 'border-l-4 border-l-emerald-500' : ''}
            `}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold text-stone-900">
                  {item.comanda.mesa
                    ? `Mesa ${item.comanda.mesa.numero}`
                    : item.comanda.cliente?.nombre || 'Para llevar'}
                </h3>
                <p className="text-sm text-stone-500">
                  {item.comanda.numeroComanda}
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-stone-500">
                  {getTiempoEspera(item.createdAt)}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-lg font-semibold">
                {item.cantidad}x {item.producto.nombre}
                {item.tamano && (
                  <span className="font-normal text-stone-600"> — {item.tamano.nombre}</span>
                )}
              </div>
              <div className="text-sm text-stone-600">
                {item.producto.categoria.nombre}
              </div>
              {item.notas && (
                <div className="mt-1 text-sm text-rose-600">
                  📝 {item.notas}
                </div>
              )}
              {item.modificadores.length > 0 && (
                <div className="mt-1 text-sm text-stone-500">
                  {item.modificadores.map((m) => m.modificador.nombre).join(', ')}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {item.estado === 'PENDIENTE' && (
                <button
                  onClick={() => abrirConfirmacion(item.id, 'EN_PREPARACION', 'Preparando')}
                  className="app-btn-secondary flex-1 border-amber-300 bg-amber-50 text-amber-900"
                >
                  Preparando
                </button>
              )}
              {item.estado === 'EN_PREPARACION' && (
                <button
                  onClick={() => abrirConfirmacion(item.id, 'LISTO', 'Listo para entregar')}
                  className="app-btn-primary flex-1 bg-emerald-700 hover:bg-emerald-800"
                >
                  Listo para entregar
                </button>
              )}
              {item.estado === 'LISTO' && (
                <button
                  onClick={() => abrirConfirmacion(item.id, 'ENTREGADO', 'Entregado')}
                  className="app-btn-primary flex-1 bg-sky-600 hover:bg-sky-700"
                >
                  Entregado
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="app-card text-center text-stone-500">
          No hay items pendientes
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
