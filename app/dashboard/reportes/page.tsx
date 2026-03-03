'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BackButton from '@/components/BackButton'
import toast from 'react-hot-toast'
import { ChartBarIcon } from '@heroicons/react/24/outline'

interface ReporteData {
  ventasHoy: number
  comandasPagadas: number
  ticketPromedio: number
  comandas: Array<{
    id: string
    numeroComanda: string
    total: number
    fechaCreacion: string
    mesa?: { numero: number } | null
    cliente?: { nombre: string } | null
  }>
}

export default function ReportesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [reporte, setReporte] = useState<ReporteData | null>(null)
  const [fechaInicio, setFechaInicio] = useState(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    return hoy.toISOString().split('T')[0]
  })
  const [fechaFin, setFechaFin] = useState(() => {
    const hoy = new Date()
    hoy.setHours(23, 59, 59, 999)
    return hoy.toISOString().split('T')[0]
  })

  useEffect(() => {
    cargarReportes()
  }, [fechaInicio, fechaFin])

  const cargarReportes = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      // Obtener comandas pagadas en el rango de fechas
      const fechaInicioDate = new Date(fechaInicio)
      fechaInicioDate.setHours(0, 0, 0, 0)
      const fechaFinDate = new Date(fechaFin)
      fechaFinDate.setHours(23, 59, 59, 999)
      
      const params = new URLSearchParams({
        estado: 'PAGADO',
        fechaInicio: fechaInicioDate.toISOString(),
        fechaFin: fechaFinDate.toISOString(),
      })
      
      const response = await fetch(
        `/api/comandas?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data = await response.json()

      if (data.success) {
        const comandas = data.data || []
        const ventasHoy = comandas.reduce((sum: number, c: any) => {
          const total = c.total || 0
          const propina = (c.propina || 0) / 100 * total
          const descuento = c.descuento || 0
          return sum + total + propina - descuento
        }, 0)
        const comandasPagadas = comandas.length
        const ticketPromedio = comandasPagadas > 0 ? ventasHoy / comandasPagadas : 0

        setReporte({
          ventasHoy,
          comandasPagadas,
          ticketPromedio,
          comandas: comandas.map((c: any) => ({
            id: c.id,
            numeroComanda: c.numeroComanda,
            total: c.total || 0,
            fechaCreacion: c.fechaCreacion,
            mesa: c.mesa,
            cliente: c.cliente,
          })),
        })
      } else {
        toast.error('Error al cargar reportes')
      }
    } catch (error) {
      console.error('Error cargando reportes:', error)
      toast.error('Error al cargar reportes')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !reporte) {
    return (
      <div className="p-8">
        <div className="text-center">Cargando reportes...</div>
      </div>
    )
  }

  return (
    <div className="p-8 text-black">
      <BackButton className="mb-4" />
      
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
      </div>

      {/* Filtros de fecha */}
      <div className="mb-6 bg-white rounded-lg shadow-md p-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-black"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-black"
            />
          </div>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ventas Totales</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ${reporte?.ventasHoy.toFixed(2) || '0.00'}
              </p>
            </div>
            <ChartBarIcon className="w-12 h-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Comandas Pagadas</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {reporte?.comandasPagadas || 0}
              </p>
            </div>
            <ChartBarIcon className="w-12 h-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ticket Promedio</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ${reporte?.ticketPromedio.toFixed(2) || '0.00'}
              </p>
            </div>
            <ChartBarIcon className="w-12 h-12 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Tabla de comandas */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Comandas Pagadas</h2>
        </div>
        <div className="overflow-x-auto">
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
              {reporte?.comandas.map((comanda) => (
                <tr key={comanda.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {comanda.numeroComanda}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {comanda.mesa
                      ? `Mesa ${comanda.mesa.numero}`
                      : comanda.cliente?.nombre || 'Para llevar'}
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
        </div>

        {(!reporte || reporte.comandas.length === 0) && (
          <div className="text-center py-12 text-gray-500">
            No hay comandas pagadas en el rango de fechas seleccionado
          </div>
        )}
      </div>
    </div>
  )
}
