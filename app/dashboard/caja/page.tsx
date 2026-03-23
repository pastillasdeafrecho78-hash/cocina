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
  DevicePhoneMobileIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'
import ClipCajaSection from './ClipCajaSection'
import FondoCajaSection from './FondoCajaSection'

type TabId = 'resumen' | 'clip' | 'fondo'

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

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'clip', label: 'Clip (PinPad)', icon: DevicePhoneMobileIcon },
  { id: 'fondo', label: 'Fondo de caja', icon: CurrencyDollarIcon },
  { id: 'resumen', label: 'Resumen', icon: DocumentTextIcon },
]

export default function CajaPage() {
  const [activeTab, setActiveTab] = useState<TabId>('clip')
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
          <div>
            <p className="app-kicker">Caja</p>
            <h1 className="mt-2 text-3xl font-semibold text-stone-900">Cortes y resumen</h1>
            <p className="mt-1 text-stone-600">
              Corte X informativo y Corte Z como cierre definitivo del periodo.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-1 rounded-lg border border-stone-200 bg-stone-50/80 p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {activeTab === 'clip' && <ClipCajaSection />}
        {activeTab === 'fondo' && <FondoCajaSection reporte={reporte} onRefresh={cargarReporte} />}
        {activeTab === 'resumen' && (
        <>
        <div className="app-card">
        <h2 className="text-xl font-semibold text-stone-900 mb-4">Resumen del periodo actual</h2>
        {reporte && (
          <p className="text-sm text-stone-500 mb-4">
            Desde {new Date(reporte.fechaInicio).toLocaleString('es-MX')} hasta{' '}
            {new Date(reporte.fechaFin).toLocaleString('es-MX')}
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="app-card-muted p-4">
            <div className="flex items-center gap-2 text-stone-600 text-sm mb-1">
              <DocumentTextIcon className="w-5 h-5" />
              Ventas totales
            </div>
            <div className="text-2xl font-bold text-stone-900">
              ${(reporte?.totalVentas ?? 0).toFixed(2)}
            </div>
          </div>
          <div className="app-card-muted border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-green-700 text-sm mb-1">
              <BanknotesIcon className="w-5 h-5" />
              Efectivo
            </div>
            <div className="text-2xl font-bold text-green-800">
              ${(reporte?.totalEfectivo ?? 0).toFixed(2)}
            </div>
          </div>
          <div className="app-card-muted border-sky-200 bg-sky-50 p-4">
            <div className="flex items-center gap-2 text-sky-700 text-sm mb-1">
              <CreditCardIcon className="w-5 h-5" />
              Tarjeta
            </div>
            <div className="text-2xl font-bold text-sky-800">
              ${(reporte?.totalTarjeta ?? 0).toFixed(2)}
            </div>
          </div>
          <div className="app-card-muted p-4">
            <div className="text-stone-600 text-sm mb-1">Otros / Comandas</div>
            <div className="text-2xl font-bold text-stone-900">
              {(reporte?.numComandas ?? 0)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleCorteX}
            disabled={ejecutandoCorteX}
            className="app-btn-secondary"
          >
            <DocumentDuplicateIcon className="w-5 h-5" />
            {ejecutandoCorteX ? 'Generando...' : 'Corte X'}
          </button>
          <button
            onClick={handleCorteZ}
            disabled={ejecutandoCorteZ}
            className="app-btn-primary"
          >
            <DocumentCheckIcon className="w-5 h-5" />
            {ejecutandoCorteZ ? 'Cerrando...' : 'Corte Z'}
          </button>
          <button
            onClick={cargarReporte}
            disabled={loading}
            className="app-btn-secondary"
          >
            Actualizar
          </button>
        </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="app-card border-sky-200 bg-sky-50/80">
          <h3 className="font-semibold text-sky-900 mb-2">Corte X (informativo)</h3>
          <ul className="text-sm text-sky-800 space-y-1">
            <li>• Reporte temporal, no reinicia la caja</li>
            <li>• Se puede hacer varias veces al día</li>
            <li>• Para revisar cómo va el turno o supervisión</li>
          </ul>
        </div>
        <div className="app-card border-amber-200 bg-amber-50/80">
          <h3 className="font-semibold text-amber-900 mb-2">Corte Z (cierre definitivo)</h3>
          <ul className="text-sm text-amber-800 space-y-1">
            <li>• Cierre oficial del turno o día</li>
            <li>• Reinicia el periodo (el siguiente reporte empieza desde cero)</li>
            <li>• Solo se hace una vez por turno o por día</li>
          </ul>
        </div>
        </div>

        {reporte?.detalles && reporte.detalles.length > 0 && (
        <div className="app-card">
          <h2 className="text-xl font-semibold text-stone-900 mb-4">
            Comandas del periodo ({reporte.detalles.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-stone-600">
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
        <div className="app-card text-center text-stone-500">
          No hay comandas pagadas en el periodo actual
        </div>
      )}
        </>
        )}
      </div>
    </div>
  )
}
