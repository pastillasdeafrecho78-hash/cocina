'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { CurrencyDollarIcon, BanknotesIcon } from '@heroicons/react/24/outline'
import { apiFetch } from '@/lib/auth-fetch'

interface ReporteData {
  fechaInicio: string
  fechaFin: string
  totalVentas: number
  totalEfectivo: number
  totalTarjeta: number
  totalOtros: number
  numComandas: number
}

interface TurnoData {
  id: string | null
  fechaApertura: string | null
  fechaCierre: string | null
  fondoInicial: number
  fondoCierre: number | null
  efectivoEsperado: number
  abierto: boolean
  alertaEfectivoMinimo: number | null
}

interface FondoCajaSectionProps {
  reporte: ReporteData | null
  onRefresh: () => void
}

export default function FondoCajaSection({ reporte, onRefresh }: FondoCajaSectionProps) {
  const [turno, setTurno] = useState<TurnoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fondoInicial, setFondoInicial] = useState('')
  const [fondoCierre, setFondoCierre] = useState('')
  const [aperturaEnProceso, setAperturaEnProceso] = useState(false)
  const [cierreEnProceso, setCierreEnProceso] = useState(false)
  const [alertaInput, setAlertaInput] = useState('')
  const [guardandoAlerta, setGuardandoAlerta] = useState(false)

  const cargarTurno = useCallback(async () => {
    try {
      const res = await apiFetch('/api/caja/turno')
      const j = await res.json()
      if (j.success) {
        setTurno(j.data)
        const am = j.data?.alertaEfectivoMinimo
        if (am != null) setAlertaInput(String(am))
        else if (am === null) setAlertaInput('')
      }
    } catch {
      toast.error('Error al cargar turno')
    } finally {
      setLoading(false)
    }
  }, [])

  const guardarAlerta = async () => {
    const val = alertaInput.trim()
    const num = val === '' ? null : parseFloat(val.replace(/,/g, '.'))
    if (num !== null && (!Number.isFinite(num) || num < 0)) {
      toast.error('Ingresa un monto válido o deja vacío para desactivar')
      return
    }
    setGuardandoAlerta(true)
    try {
      const res = await apiFetch('/api/configuracion/caja', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alertaEfectivoMinimo: num,
        }),
      })
      const j = await res.json()
      if (j.success) {
        toast.success('Umbral de alerta guardado')
        cargarTurno()
      } else {
        toast.error(j.error || 'Error al guardar')
      }
    } catch {
      toast.error('Error al guardar')
    } finally {
      setGuardandoAlerta(false)
    }
  }

  useEffect(() => {
    cargarTurno()
  }, [cargarTurno])

  const handleApertura = async () => {
    const monto = parseFloat(fondoInicial.replace(/,/g, '.'))
    if (!Number.isFinite(monto) || monto < 0) {
      toast.error('Ingresa un monto válido para el fondo inicial')
      return
    }
    setAperturaEnProceso(true)
    try {
      const res = await apiFetch('/api/caja/turno/apertura', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fondoInicial: monto }),
      })
      const j = await res.json()
      if (j.success) {
        toast.success('Turno abierto correctamente')
        setFondoInicial('')
        cargarTurno()
        onRefresh()
      } else {
        toast.error(j.error || 'Error al abrir turno')
      }
    } catch {
      toast.error('Error al abrir turno')
    } finally {
      setAperturaEnProceso(false)
    }
  }

  const handleCierre = async () => {
    const monto = parseFloat(fondoCierre.replace(/,/g, '.'))
    if (!Number.isFinite(monto) || monto < 0) {
      toast.error('Ingresa el monto contado (arqueo) para cerrar')
      return
    }
    if (!confirm('¿Confirmar cierre de turno? Se registrará el arqueo y se cerrará la caja.')) {
      return
    }
    setCierreEnProceso(true)
    try {
      const res = await apiFetch('/api/caja/turno/cierre', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fondoCierre: monto }),
      })
      const j = await res.json()
      if (j.success) {
        toast.success('Turno cerrado correctamente')
        setFondoCierre('')
        cargarTurno()
        onRefresh()
      } else {
        toast.error(j.error || 'Error al cerrar turno')
      }
    } catch {
      toast.error('Error al cerrar turno')
    } finally {
      setCierreEnProceso(false)
    }
  }

  if (loading) {
    return (
      <div className="app-card py-8 text-center text-stone-600 dark:text-stone-400">
        Cargando información de turno...
      </div>
    )
  }

  const efectivoEsperado = turno?.abierto
    ? (turno?.fondoInicial ?? 0) + (reporte?.totalEfectivo ?? 0)
    : turno?.efectivoEsperado ?? 0
  const alertaEfectivoMinimo = turno?.alertaEfectivoMinimo ?? null
  const hayAlertaEfectivoBajo =
    alertaEfectivoMinimo != null &&
    alertaEfectivoMinimo > 0 &&
    efectivoEsperado > 0 &&
    efectivoEsperado < alertaEfectivoMinimo

  return (
    <div className="space-y-6">
      {hayAlertaEfectivoBajo && (
        <div className="rounded-[28px] border border-amber-300/90 bg-amber-50/95 p-4 dark:border-amber-400/40 dark:bg-amber-950/55">
          <div className="flex items-center gap-2 font-medium text-amber-950 dark:text-amber-50">
            <BanknotesIcon className="h-5 w-5 shrink-0" />
            Efectivo bajo
          </div>
          <p className="mt-1 text-sm text-amber-900 dark:text-amber-100/90">
            Efectivo esperado en caja: ${efectivoEsperado.toFixed(2)}. El umbral configurado es $
            {alertaEfectivoMinimo.toFixed(2)}. Considera reforzar la caja.
          </p>
        </div>
      )}

      <div className="app-card">
        <div className="flex items-start gap-4">
          <div className="app-icon-shell h-12 w-12 shrink-0">
            <CurrencyDollarIcon className="h-6 w-6 text-[rgb(var(--brand))]" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-50">Fondo de caja</h2>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
              Apertura con fondo inicial, operación durante el turno y cierre con arqueo.
            </p>
          </div>
        </div>

        {turno?.abierto ? (
          <div className="mt-6 space-y-4">
            <div className="app-card-muted p-4 sm:p-5">
              <h3 className="mb-2 font-semibold text-stone-900 dark:text-stone-50">Turno abierto</h3>
              <p className="text-sm text-stone-600 dark:text-stone-400">
                Abierto el {turno.fechaApertura ? new Date(turno.fechaApertura).toLocaleString('es-MX') : '—'}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-stone-100 p-3 dark:bg-stone-800/80">
                  <div className="text-xs text-stone-500 dark:text-stone-400">Fondo inicial</div>
                  <div className="text-lg font-bold text-stone-900 dark:text-stone-50">
                    ${(turno.fondoInicial ?? 0).toFixed(2)}
                  </div>
                </div>
                <div className="rounded-2xl bg-stone-100 p-3 dark:bg-stone-800/80">
                  <div className="text-xs text-stone-500 dark:text-stone-400">Ventas en efectivo (periodo)</div>
                  <div className="text-lg font-bold text-stone-900 dark:text-stone-50">
                    ${(reporte?.totalEfectivo ?? 0).toFixed(2)}
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-500/35 bg-emerald-50/90 p-3 dark:border-emerald-500/30 dark:bg-emerald-950/40">
                  <div className="text-xs text-emerald-800 dark:text-emerald-300">Efectivo esperado en caja</div>
                  <div className="text-lg font-bold text-emerald-900 dark:text-emerald-200">
                    ${efectivoEsperado.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <div className="app-note p-4 dark:border-amber-400/35">
              <h3 className="mb-2 font-semibold text-stone-900 dark:text-stone-50">Cerrar turno (arqueo)</h3>
              <p className="mb-3 text-sm text-stone-600 dark:text-stone-300">
                Cuenta el efectivo físico en caja e ingresa el monto para cerrar el turno.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-700 dark:text-stone-300">
                    Monto contado (arqueo)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={fondoCierre}
                    onChange={(e) => setFondoCierre(e.target.value)}
                    className="app-input app-field w-40 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCierre}
                  disabled={cierreEnProceso || !fondoCierre.trim()}
                  className="app-btn-primary"
                >
                  {cierreEnProceso ? 'Cerrando...' : 'Cerrar turno'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="app-card-muted mt-6 p-4 sm:p-5">
            <h3 className="mb-2 font-semibold text-stone-900 dark:text-stone-50">Abrir turno</h3>
            <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
              Registra el efectivo inicial en caja para comenzar el turno.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-700 dark:text-stone-300">
                  Fondo inicial (MXN)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={fondoInicial}
                  onChange={(e) => setFondoInicial(e.target.value)}
                  className="app-input app-field w-40 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleApertura}
                disabled={aperturaEnProceso || !fondoInicial.trim()}
                className="app-btn-primary"
              >
                {aperturaEnProceso ? 'Abriendo...' : 'Abrir turno'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="app-card">
        <h3 className="mb-2 font-semibold text-stone-900 dark:text-stone-50">Umbral de alerta de efectivo</h3>
        <p className="mb-3 text-sm text-stone-600 dark:text-stone-300">
          Se mostrará una alerta cuando el efectivo esperado en caja sea menor a este monto (MXN).
          Deja vacío para desactivar.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700 dark:text-stone-300">
              Monto mínimo (MXN)
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Ej. 500"
              value={alertaInput}
              onChange={(e) => setAlertaInput(e.target.value)}
              className="app-input app-field w-32 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={guardarAlerta}
            disabled={guardandoAlerta}
            className="app-btn-secondary text-sm"
          >
            {guardandoAlerta ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
