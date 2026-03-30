'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/auth-fetch'
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
      const res = await apiFetch('/api/caja/reporte', {
        headers: {},
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
      const res = await apiFetch('/api/caja/corte-x', {
        method: 'POST',
        headers: {},
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
      const res = await apiFetch('/api/caja/corte-z', {
        method: 'POST',
        headers: {},
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
        <div className="mx-auto max-w-7xl">
          <div className="app-card text-center text-stone-600 dark:text-stone-400">Cargando...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-page">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="app-brand-panel p-5 sm:p-6">
          <BackButton className="mb-4" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="app-kicker">Caja</p>
              <h1 className="mt-2 text-3xl font-semibold text-stone-900 dark:text-stone-50 sm:text-4xl">
                Cortes y resumen
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-stone-600 dark:text-stone-300 sm:text-base">
                Corte X informativo y Corte Z como cierre definitivo del periodo. Misma línea visual
                que el resto del panel ServimOS.
              </p>
            </div>
            <div className="app-note max-w-md px-4 py-3 text-sm dark:border-stone-600/50 dark:bg-stone-900/40">
              Usa las pestañas para Clip, fondo de caja o el resumen con cortes y detalle de comandas.
            </div>
          </div>

          <div className="app-brand-divider my-6" />

          <div className="flex flex-wrap gap-1 rounded-2xl border border-stone-200/90 bg-stone-100/70 p-1 dark:border-stone-600/50 dark:bg-stone-900/45">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-50'
                      : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </section>

        {activeTab === 'clip' && <ClipCajaSection />}
        {activeTab === 'fondo' && <FondoCajaSection reporte={reporte} onRefresh={cargarReporte} />}
        {activeTab === 'resumen' && (
        <>
        <div className="app-card">
        <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-50 mb-1">
          Resumen del periodo actual
        </h2>
        {reporte && (
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
            Desde {new Date(reporte.fechaInicio).toLocaleString('es-MX')} hasta{' '}
            {new Date(reporte.fechaFin).toLocaleString('es-MX')}
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="app-card-muted p-4">
            <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400 text-sm mb-1">
              <DocumentTextIcon className="w-5 h-5 shrink-0" />
              Ventas totales
            </div>
            <div className="text-2xl font-bold text-stone-900 dark:text-stone-50">
              ${(reporte?.totalVentas ?? 0).toFixed(2)}
            </div>
          </div>
          <div className="app-card-muted border-l-4 border-l-emerald-500 p-4 dark:border-l-emerald-400">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-sm mb-1">
              <BanknotesIcon className="w-5 h-5 shrink-0" />
              Efectivo
            </div>
            <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-200">
              ${(reporte?.totalEfectivo ?? 0).toFixed(2)}
            </div>
          </div>
          <div className="app-card-muted border-l-4 border-l-sky-500 p-4 dark:border-l-sky-400">
            <div className="flex items-center gap-2 text-sky-800 dark:text-sky-300 text-sm mb-1">
              <CreditCardIcon className="w-5 h-5 shrink-0" />
              Tarjeta
            </div>
            <div className="text-2xl font-bold text-sky-900 dark:text-sky-200">
              ${(reporte?.totalTarjeta ?? 0).toFixed(2)}
            </div>
          </div>
          <div className="app-card-muted p-4">
            <div className="text-stone-600 dark:text-stone-400 text-sm mb-1">Otros / Comandas</div>
            <div className="text-2xl font-bold text-stone-900 dark:text-stone-50">
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
        <div className="app-note p-4 sm:p-5 dark:border-sky-500/25">
          <h3 className="font-semibold text-stone-900 dark:text-stone-50 mb-2">Corte X (informativo)</h3>
          <ul className="text-sm text-stone-600 dark:text-stone-300 space-y-1 list-disc list-inside">
            <li>Reporte temporal, no reinicia la caja</li>
            <li>Se puede hacer varias veces al día</li>
            <li>Para revisar cómo va el turno o supervisión</li>
          </ul>
        </div>
        <div className="app-note p-4 sm:p-5 dark:border-amber-400/30">
          <h3 className="font-semibold text-stone-900 dark:text-stone-50 mb-2">Corte Z (cierre definitivo)</h3>
          <ul className="text-sm text-stone-600 dark:text-stone-300 space-y-1 list-disc list-inside">
            <li>Cierre oficial del turno o día</li>
            <li>Reinicia el periodo (el siguiente reporte empieza desde cero)</li>
            <li>Solo se hace una vez por turno o por día</li>
          </ul>
        </div>
        </div>

        {reporte?.detalles && reporte.detalles.length > 0 && (
        <div className="app-table-shell">
          <h2 className="border-b border-stone-200/80 px-4 py-4 text-lg font-semibold text-stone-900 dark:border-stone-600/60 dark:text-stone-50 sm:px-5">
            Comandas del periodo ({reporte.detalles.length})
          </h2>
          <div className="overflow-x-auto px-2 pb-4 sm:px-4">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-600 dark:border-stone-600 dark:text-stone-400">
                  <th className="py-3 pr-4">Comanda</th>
                  <th className="py-3 pr-4">Mesa</th>
                  <th className="py-3 pr-4">Fecha</th>
                  <th className="py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {reporte.detalles.map((d) => (
                  <tr
                    key={d.numeroComanda}
                    className="border-b border-stone-200/70 last:border-0 dark:border-stone-700/80"
                  >
                    <td className="py-3 pr-4 font-medium text-stone-900 dark:text-stone-100">
                      {d.numeroComanda}
                    </td>
                    <td className="py-3 pr-4 text-stone-700 dark:text-stone-300">
                      {d.mesa != null ? `Mesa ${d.mesa}` : '-'}
                    </td>
                    <td className="py-3 pr-4 text-stone-600 dark:text-stone-400">
                      {new Date(d.fechaCreacion).toLocaleString('es-MX')}
                    </td>
                    <td className="py-3 text-right tabular-nums text-stone-900 dark:text-stone-50">
                      ${d.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reporte && (!reporte.detalles || reporte.detalles.length === 0) && (
        <div className="app-card text-center text-stone-500 dark:text-stone-400">
          No hay comandas pagadas en el periodo actual
        </div>
      )}
        </>
        )}
      </div>
    </div>
  )
}
