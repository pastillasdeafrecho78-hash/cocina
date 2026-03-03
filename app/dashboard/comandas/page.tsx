'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BackButton from '@/components/BackButton'
import toast from 'react-hot-toast'

interface Comanda {
  id: string
  numeroComanda: string
  estado: string
  total: number
  fechaCreacion: string
  mesa?: {
    numero: number
  } | null
  cliente?: {
    nombre: string
  } | null
}

export default function ComandasPage() {
  const router = useRouter()
  const [comandas, setComandas] = useState<Comanda[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<string>('')

  useEffect(() => {
    fetchComandas()
  }, [filtro])

  const fetchComandas = async () => {
    try {
      const token = localStorage.getItem('token')
      const url = filtro
        ? `/api/comandas?estado=${filtro}`
        : '/api/comandas'

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (data.success) {
        setComandas(data.data)
      } else {
        toast.error('Error al cargar comandas')
      }
    } catch (error) {
      toast.error('Error al cargar comandas')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Cargando...</div>
      </div>
    )
  }

  const estados = [
    { value: '', label: 'Todas' },
    { value: 'PENDIENTE', label: 'Pendientes' },
    { value: 'EN_PREPARACION', label: 'En Preparación' },
    { value: 'LISTO', label: 'Listas' },
    { value: 'SERVIDO', label: 'Servidas' },
    { value: 'PAGADO', label: 'Pagadas' },
  ]

  return (
    <div className="p-8 text-black">
      <BackButton className="mb-4" />
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Comandas</h1>
        <div className="flex gap-4">
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md text-black"
          >
            {estados.map((estado) => (
              <option key={estado.value} value={estado.value}>
                {estado.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => router.push('/dashboard/comandas/nueva')}
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
          >
            Nueva Comanda
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Comanda
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mesa/Cliente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {comandas.map((comanda) => (
              <tr key={comanda.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {comanda.numeroComanda}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {comanda.mesa
                    ? `Mesa ${comanda.mesa.numero}`
                    : comanda.cliente?.nombre || 'Para llevar'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      comanda.estado === 'PENDIENTE'
                        ? 'bg-yellow-100 text-yellow-800'
                        : comanda.estado === 'LISTO'
                        ? 'bg-green-100 text-green-800'
                        : comanda.estado === 'PAGADO'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {comanda.estado}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ${comanda.total.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(comanda.fechaCreacion).toLocaleString('es-MX')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() =>
                      router.push(`/dashboard/comandas/${comanda.numeroComanda}`)
                    }
                    className="text-primary-600 hover:text-primary-900"
                  >
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {comandas.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No hay comandas {filtro ? 'con este estado' : ''}
          </div>
        )}
      </div>
    </div>
  )
}








