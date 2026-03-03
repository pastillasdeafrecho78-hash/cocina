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

export default function BarraPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pendiente' | 'preparacion'>('all')

  const fetchItems = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/comandas/barra', {
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
    const interval = setInterval(fetchItems, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleUpdateEstado = async (itemId: string, nuevoEstado: string) => {
    try {
      const token = localStorage.getItem('token')
      const item = items.find((i) => i.id === itemId)
      if (!item) return

      const comandaResponse = await fetch(`/api/comandas?numeroComanda=${encodeURIComponent(item.comanda.numeroComanda)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
    } catch (error) {
      toast.error('Error al actualizar estado')
    }
  }

  const filteredItems = items.filter((item) => {
    if (filter === 'pendiente') return item.estado === 'PENDIENTE'
    if (filter === 'preparacion') return item.estado === 'EN_PREPARACION'
    return true
  })

  const getTiempoEspera = (fechaCreacion: string) => {
    return formatDistanceToNow(new Date(fechaCreacion), {
      addSuffix: false,
      locale: es,
    })
  }

  if (loading) {
    return (
      <div className="p-8 text-black">
        <div className="text-center">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="p-8 text-black">
      <BackButton className="mb-4" />
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Bar Display System</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded ${
              filter === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-200'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('pendiente')}
            className={`px-4 py-2 rounded ${
              filter === 'pendiente' ? 'bg-primary-600 text-white' : 'bg-gray-200'
            }`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setFilter('preparacion')}
            className={`px-4 py-2 rounded ${
              filter === 'preparacion' ? 'bg-primary-600 text-white' : 'bg-gray-200'
            }`}
          >
            En Preparación
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className={`
              bg-white rounded-lg shadow-md p-6
              ${item.estado === 'PENDIENTE' ? 'border-l-4 border-red-500' : ''}
              ${item.estado === 'EN_PREPARACION' ? 'border-l-4 border-yellow-500' : ''}
            `}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold">
                  {item.comanda.mesa
                    ? `Mesa ${item.comanda.mesa.numero}`
                    : item.comanda.cliente?.nombre || 'Para llevar'}
                </h3>
                <p className="text-sm text-gray-500">
                  {item.comanda.numeroComanda}
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">
                  {getTiempoEspera(item.createdAt)}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-lg font-semibold">
                {item.cantidad}x {item.producto.nombre}
              </div>
              <div className="text-sm text-gray-600">
                {item.producto.categoria.nombre}
              </div>
              {item.notas && (
                <div className="text-sm text-red-600 mt-1">
                  📝 {item.notas}
                </div>
              )}
              {item.modificadores.length > 0 && (
                <div className="text-sm text-gray-500 mt-1">
                  {item.modificadores.map((m) => m.modificador.nombre).join(', ')}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {item.estado === 'PENDIENTE' && (
                <button
                  onClick={() => handleUpdateEstado(item.id, 'EN_PREPARACION')}
                  className="flex-1 bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
                >
                  En Preparación
                </button>
              )}
              {item.estado === 'EN_PREPARACION' && (
                <button
                  onClick={() => handleUpdateEstado(item.id, 'LISTO')}
                  className="flex-1 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                >
                  Listo
                </button>
              )}
              {item.estado === 'LISTO' && (
                <div className="flex-1 bg-green-100 text-green-800 px-4 py-2 rounded text-center">
                  ✓ Listo
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No hay items pendientes
        </div>
      )}
    </div>
  )
}
