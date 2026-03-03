'use client'

import { useEffect, useState } from 'react'
import BackButton from '@/components/BackButton'
import toast from 'react-hot-toast'
import {
  DocumentTextIcon,
  BanknotesIcon,
  CreditCardIcon,
  DocumentDuplicateIcon,
  DocumentCheckIcon,
} from '@heroicons/react/24/outline'

interface ReporteData {
  fechaInicio: string
  fechaFin: string
  totalVentas: number
  totalEfectivo: number
  totalTarjeta: number
  totalOtros: number
  numComandas: number
  detalles?: Array<{
    numeroComanda: string
    total: number
    mesa?: number | null
    fechaCreacion: string
  }>
}

export default function CajaPage() {
  const [reporte, setReporte] = useState<ReporteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [ejecutandoCorteX, setEjecutandoCorteX] = useState(false)
  const [ejecutandoCorteZ, setEjecutandoCorteZ] = useState(false)

  const cargarReporte = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const res = await fetch('/api/caja/reporte', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setReporte({
          ...data.data,
          fechaInicio: data.data.fechaInicio,
          fechaFin: data.data.fechaFin,
        })
      } else {
        toast.error(data.error || 'Error al cargar reporte')
      }
    } catch {
      toast.error('Error al cargar reporte')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarReporte()
  }, [])

  const handleCorteX = async () => {
    setEjecutandoCorteX(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/caja/corte-x', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Corte X generado correctamente')
        setReporte({
          ...data.data.reporte,
          fechaInicio: data.data.reporte.fechaInicio,
          fechaFin: data.data.reporte.fechaFin,
        })
      } else {
        toast.error(data.error || 'Error al generar Corte X')
      }
    } catch {
      toast.error('Error al generar Corte X')
    } finally {
      setEjecutandoCorteX(false)
    }
  }

  const handleCorteZ = async () => {
    if (!confirm('¿Confirmar Corte Z? Se cerrará el turno. El siguiente reporte comenzará desde cero.')) {
      return
    }
    setEjecutandoCorteZ(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/caja/corte-z', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Corte Z ejecutado. Turno cerrado correctamente.')
        setReporte({
          ...data.data.reporte,
          fechaInicio: data.data.reporte.fechaInicio,
          fechaFin: data.data.reporte.fechaFin,
        })
      } else {
        toast.error(data.error || 'Error al ejecutar Corte Z')
      }
    } catch {
      toast.error('Error al ejecutar Corte Z')
    } finally {
      setEjecutandoCorteZ(false)
    }
  }

  if (loading && !reporte) {
    return (
      <div className="p-8 text-black">
        <div className="text-center">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="p-8 text-black">
      <BackButton className="mb-4" />
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Caja</h1>
        <p className="text-gray-600 mt-1">Corte X (informativo) y Corte Z (cierre definitivo)</p>
      </div>

      {/* Resumen actual */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Resumen del periodo actual</h2>
        {reporte && (
          <p className="text-sm text-gray-500 mb-4">
            Desde {new Date(reporte.fechaInicio).toLocaleString('es-MX')} hasta{' '}
            {new Date(reporte.fechaFin).toLocaleString('es-MX')}
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
              <DocumentTextIcon className="w-5 h-5" />
              Ventas totales
            </div>
            <div className="text-2xl font-bold text-gray-900">
              ${(reporte?.totalVentas ?? 0).toFixed(2)}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 text-sm mb-1">
              <BanknotesIcon className="w-5 h-5" />
              Efectivo
            </div>
            <div className="text-2xl font-bold text-green-800">
              ${(reporte?.totalEfectivo ?? 0).toFixed(2)}
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-700 text-sm mb-1">
              <CreditCardIcon className="w-5 h-5" />
              Tarjeta
            </div>
            <div className="text-2xl font-bold text-blue-800">
              ${(reporte?.totalTarjeta ?? 0).toFixed(2)}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-gray-600 text-sm mb-1">Otros / Comandas</div>
            <div className="text-2xl font-bold text-gray-900">
              {(reporte?.numComandas ?? 0)}
            </div>
          </div>
        </div>

        {/* Botones Corte X y Corte Z */}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleCorteX}
            disabled={ejecutandoCorteX}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <DocumentDuplicateIcon className="w-5 h-5" />
            {ejecutandoCorteX ? 'Generando...' : 'Corte X'}
          </button>
          <button
            onClick={handleCorteZ}
            disabled={ejecutandoCorteZ}
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <DocumentCheckIcon className="w-5 h-5" />
            {ejecutandoCorteZ ? 'Cerrando...' : 'Corte Z'}
          </button>
          <button
            onClick={cargarReporte}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 text-sm"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Explicación */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Corte X (informativo)</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Reporte temporal, no reinicia la caja</li>
            <li>• Se puede hacer varias veces al día</li>
            <li>• Para revisar cómo va el turno o supervisión</li>
          </ul>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-900 mb-2">Corte Z (cierre definitivo)</h3>
          <ul className="text-sm text-amber-800 space-y-1">
            <li>• Cierre oficial del turno o día</li>
            <li>• Reinicia el periodo (el siguiente reporte empieza desde cero)</li>
            <li>• Solo se hace una vez por turno o por día</li>
          </ul>
        </div>
      </div>

      {/* Detalle de comandas */}
      {reporte?.detalles && reporte.detalles.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Comandas del periodo ({reporte.detalles.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="py-2 pr-4">Comanda</th>
                  <th className="py-2 pr-4">Mesa</th>
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {reporte.detalles.map((d) => (
                  <tr key={d.numeroComanda} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{d.numeroComanda}</td>
                    <td className="py-2 pr-4">{d.mesa != null ? `Mesa ${d.mesa}` : '-'}</td>
                    <td className="py-2 pr-4">
                      {new Date(d.fechaCreacion).toLocaleString('es-MX')}
                    </td>
                    <td className="py-2 text-right">${d.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reporte && (!reporte.detalles || reporte.detalles.length === 0) && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
          No hay comandas pagadas en el periodo actual
        </div>
      )}
    </div>
  )
}
