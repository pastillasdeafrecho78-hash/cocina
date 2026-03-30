'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { DevicePhoneMobileIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { apiFetch } from '@/lib/auth-fetch'

interface ComandaOpt {
  id: string
  numeroComanda: string
  estado: string
  total: number
}

interface TerminalRow {
  id: string
  serialNumber: string
  nombre: string | null
  activo: boolean
}

export default function ClipCajaSection() {
  const [cfg, setCfg] = useState<{ activo: boolean; hasApiKey: boolean; hasWebhookSecret: boolean } | null>(
    null
  )
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [terminales, setTerminales] = useState<TerminalRow[]>([])
  const [newSerial, setNewSerial] = useState('')
  const [newNombre, setNewNombre] = useState('')
  const [comandas, setComandas] = useState<ComandaOpt[]>([])
  const [comandaId, setComandaId] = useState('')
  const [serialCobro, setSerialCobro] = useState('')
  const [tipExtra, setTipExtra] = useState('')
  const [cobrando, setCobrando] = useState(false)
  const [espera, setEspera] = useState<{ pagoId: string; pinpadId: string } | null>(null)
  const [devicesClip, setDevicesClip] = useState<unknown>(null)

  const loadCfg = useCallback(async () => {
    const res = await apiFetch('/api/clip/config')
    const j = await res.json()
    if (j.success) setCfg(j.data)
  }, [])

  const loadTerminales = useCallback(async () => {
    const res = await apiFetch('/api/clip/terminales')
    const j = await res.json()
    if (j.success) setTerminales(j.data.filter((t: TerminalRow) => t.activo))
  }, [])

  const loadComandas = useCallback(async () => {
    const res = await apiFetch('/api/comandas?estado=LISTO')
    const j = await res.json()
    if (!j.success) return
    const list = (j.data as ComandaOpt[]).filter((c) => c.estado !== 'PAGADO' && c.estado !== 'CANCELADO')
    const r2 = await apiFetch('/api/comandas?estado=SERVIDO')
    const j2 = await r2.json()
    const extra = j2.success ? (j2.data as ComandaOpt[]).filter((c) => c.estado !== 'PAGADO') : []
    const map = new Map<string, ComandaOpt>()
    ;[...list, ...extra].forEach((c) => map.set(c.id, c))
    setComandas([...map.values()])
  }, [])

  useEffect(() => {
    loadCfg()
    loadTerminales()
    loadComandas()
  }, [loadCfg, loadTerminales, loadComandas])

  const guardarConfig = async () => {
    try {
      const body: Record<string, unknown> = { activo: true }
      if (apiKeyInput.trim()) body.apiKey = apiKeyInput.trim()
      const res = await apiFetch('/api/clip/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await res.json()
      if (j.success) {
        toast.success('Configuración Clip guardada')
        setApiKeyInput('')
        loadCfg()
      } else toast.error(j.error || 'Error')
    } catch {
      toast.error('Error al guardar')
    }
  }

  const agregarTerminal = async () => {
    if (!newSerial.trim()) {
      toast.error('Ingresa el número de serie del PinPad')
      return
    }
    const res = await apiFetch('/api/clip/terminales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serialNumber: newSerial.trim(), nombre: newNombre.trim() || undefined }),
    })
    const j = await res.json()
    if (j.success) {
      toast.success('Terminal registrada')
      setNewSerial('')
      setNewNombre('')
      loadTerminales()
    } else toast.error(j.error || 'Error')
  }

  const refrescarDispositivosClip = async () => {
    const res = await apiFetch('/api/clip/dispositivos')
    const j = await res.json()
    if (j.success) {
      setDevicesClip(j.data)
      toast.success('Dispositivos actualizados (desde Clip)')
    } else toast.error(j.error || 'Error')
  }

  const iniciarCobro = async () => {
    if (!comandaId || !serialCobro.trim()) {
      toast.error('Selecciona comanda y terminal')
      return
    }
    setCobrando(true)
    try {
      const tip = tipExtra ? parseFloat(tipExtra.replace(',', '.')) : 0
      const res = await apiFetch('/api/clip/crear-intencion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comandaId,
          serialNumber: serialCobro.trim(),
          tipAmount: Number.isFinite(tip) && tip > 0 ? tip : undefined,
        }),
      })
      const j = await res.json()
      if (!j.success) {
        toast.error(j.error || 'Error')
        return
      }
      const pin = j.data.pinpadRequestId as string | null
      if (!pin) {
        toast('Intención creada; si no hay ID, usa "Consultar estado" o espera el webhook', { icon: 'ℹ️' })
        setCobrando(false)
        return
      }
      toast.success('Pago enviado a la terminal. Esperando confirmación…')
      setEspera({ pagoId: j.data.pagoId, pinpadId: pin })
    } catch {
      toast.error('Error de red')
    } finally {
      setCobrando(false)
    }
  }

  useEffect(() => {
    if (!espera) return
    const t = setInterval(async () => {
      const res = await apiFetch(
        `/api/clip/estado?pagoId=${encodeURIComponent(espera.pagoId)}&pinpadRequestId=${encodeURIComponent(espera.pinpadId)}`
      )
      const j = await res.json()
      if (j.success && j.data?.status === 'COMPLETADO') {
        toast.success('Pago completado')
        setEspera(null)
        loadComandas()
      }
    }, 4000)
    return () => clearInterval(t)
  }, [espera, loadComandas])

  return (
    <div className="app-card">
      <div className="flex items-start gap-4">
        <div className="app-icon-shell h-12 w-12 shrink-0">
          <DevicePhoneMobileIcon className="h-6 w-6 text-[rgb(var(--brand))]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-50">Cobro con Clip (PinPad)</h2>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
            Configura tu API key de Clip, registra el número de serie de tu terminal y cobra desde caja.
            El webhook se genera automáticamente en backend con tu URL pública de producción.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="app-card-muted space-y-3 p-4 sm:p-5">
          <h3 className="font-semibold text-stone-900 dark:text-stone-50">Configuración</h3>
          {cfg && (
            <p className="text-xs text-stone-600 dark:text-stone-400">
              API key: {cfg.hasApiKey ? '✓ configurada' : '—'} · Activo: {cfg.activo ? 'sí' : 'no'}
            </p>
          )}
          <input
            type="password"
            placeholder="Token API Clip (se envia como Basic)"
            className="app-input app-field text-sm"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
          />
          <button type="button" className="app-btn-secondary text-sm" onClick={guardarConfig}>
            Guardar credenciales
          </button>
          <div className="border-t border-stone-200/80 pt-4 dark:border-stone-600/50">
            <p className="mb-2 text-xs font-medium text-stone-700 dark:text-stone-300">Terminales registradas</p>
            <ul className="mb-2 space-y-1 text-sm text-stone-700 dark:text-stone-300">
              {terminales.map((t) => (
                <li key={t.id}>
                  <code className="rounded bg-stone-200/80 px-1 text-xs dark:bg-stone-800">{t.serialNumber}</code>
                  {t.nombre ? ` · ${t.nombre}` : ''}
                </li>
              ))}
              {terminales.length === 0 && (
                <li className="text-stone-500 dark:text-stone-400">
                  Ninguna — o deja vacío el registro y Clip validará solo en su cuenta.
                </li>
              )}
            </ul>
            <div className="flex flex-wrap gap-2">
              <input
                className="app-input app-field min-w-[140px] flex-1 py-2 text-sm"
                placeholder="Número de serie PinPad"
                value={newSerial}
                onChange={(e) => setNewSerial(e.target.value)}
              />
              <input
                className="app-input app-field min-w-[100px] flex-1 py-2 text-sm"
                placeholder="Nombre (opcional)"
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
              />
              <button type="button" className="app-btn-secondary text-sm" onClick={agregarTerminal}>
                Registrar
              </button>
            </div>
            <button
              type="button"
              className="mt-2 flex items-center gap-1 text-xs text-[rgb(var(--brand))] hover:underline dark:text-amber-200/90"
              onClick={refrescarDispositivosClip}
            >
              <ArrowPathIcon className="w-4 h-4" />
              Ver dispositivos en cuenta Clip (API)
            </button>
            {devicesClip != null && (
              <pre className="mt-2 max-h-32 overflow-auto rounded bg-stone-900 text-stone-100 p-2 text-[10px]">
                {JSON.stringify(devicesClip, null, 2)}
              </pre>
            )}
          </div>
        </div>

        <div className="app-card-muted space-y-3 p-4 sm:p-5">
          <h3 className="font-semibold text-stone-900 dark:text-stone-50">Cobrar</h3>
          <label className="block text-xs text-stone-600 dark:text-stone-400">Comanda</label>
          <select
            className="app-input app-field w-full py-2.5 text-sm"
            value={comandaId}
            onChange={(e) => setComandaId(e.target.value)}
          >
            <option value="">— Selecciona —</option>
            {comandas.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.numeroComanda} · ${c.total.toFixed(2)} · {c.estado}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="text-xs text-[rgb(var(--brand))] hover:underline dark:text-amber-200/90"
            onClick={loadComandas}
          >
            Actualizar lista
          </button>
          <label className="mt-2 block text-xs text-stone-600 dark:text-stone-400">Terminal (número de serie)</label>
          <select
            className="app-input app-field w-full py-2.5 text-sm"
            value={serialCobro}
            onChange={(e) => setSerialCobro(e.target.value)}
          >
            <option value="">— Elegir registrada o escribir abajo —</option>
            {terminales.map((t) => (
              <option key={t.id} value={t.serialNumber}>
                {t.serialNumber} {t.nombre ? `(${t.nombre})` : ''}
              </option>
            ))}
          </select>
          <input
            className="app-input app-field w-full text-sm"
            placeholder="O pega número de serie manualmente"
            value={serialCobro}
            onChange={(e) => setSerialCobro(e.target.value)}
          />
          <label className="block text-xs text-stone-600 dark:text-stone-400">Propina extra en terminal (MXN, opcional)</label>
          <input
            className="app-input app-field w-full text-sm"
            placeholder="0"
            value={tipExtra}
            onChange={(e) => setTipExtra(e.target.value)}
          />
          {espera && (
            <div className="rounded-2xl border border-amber-300/80 bg-amber-50/95 p-3 text-sm text-amber-950 dark:border-amber-400/40 dark:bg-amber-950/50 dark:text-amber-50">
              Esperando pago en terminal… (también puede cerrar el webhook automáticamente)
              <div className="mt-1 font-mono text-xs opacity-90">pinpad: {espera.pinpadId}</div>
            </div>
          )}
          <button
            type="button"
            className="app-btn-primary w-full"
            disabled={cobrando || !!espera}
            onClick={iniciarCobro}
          >
            {cobrando ? 'Enviando…' : 'Enviar cobro a terminal Clip'}
          </button>
        </div>
      </div>
    </div>
  )
}
