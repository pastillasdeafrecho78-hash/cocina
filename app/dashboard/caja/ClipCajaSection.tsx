'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { DevicePhoneMobileIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

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
  const [webhookSecretInput, setWebhookSecretInput] = useState('')
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

  const token = () => localStorage.getItem('token')

  const loadCfg = useCallback(async () => {
    const res = await fetch('/api/clip/config', { headers: { Authorization: `Bearer ${token()}` } })
    const j = await res.json()
    if (j.success) setCfg(j.data)
  }, [])

  const loadTerminales = useCallback(async () => {
    const res = await fetch('/api/clip/terminales', { headers: { Authorization: `Bearer ${token()}` } })
    const j = await res.json()
    if (j.success) setTerminales(j.data.filter((t: TerminalRow) => t.activo))
  }, [])

  const loadComandas = useCallback(async () => {
    const res = await fetch('/api/comandas?estado=LISTO', { headers: { Authorization: `Bearer ${token()}` } })
    const j = await res.json()
    if (!j.success) return
    const list = (j.data as ComandaOpt[]).filter((c) => c.estado !== 'PAGADO' && c.estado !== 'CANCELADO')
    const r2 = await fetch('/api/comandas?estado=SERVIDO', { headers: { Authorization: `Bearer ${token()}` } })
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
      if (webhookSecretInput.trim()) body.webhookSecret = webhookSecretInput.trim()
      const res = await fetch('/api/clip/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
      })
      const j = await res.json()
      if (j.success) {
        toast.success('Configuración Clip guardada')
        setApiKeyInput('')
        setWebhookSecretInput('')
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
    const res = await fetch('/api/clip/terminales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
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
    const res = await fetch('/api/clip/dispositivos', { headers: { Authorization: `Bearer ${token()}` } })
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
      const res = await fetch('/api/clip/crear-intencion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
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
      const res = await fetch(
        `/api/clip/estado?pagoId=${encodeURIComponent(espera.pagoId)}&pinpadRequestId=${encodeURIComponent(espera.pinpadId)}`,
        { headers: { Authorization: `Bearer ${token()}` } }
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

  const baseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhooks/clip/<slug-restaurante>`
      : ''

  return (
    <div className="app-card border-violet-200 bg-violet-50/40">
      <div className="flex items-center gap-2 mb-2">
        <DevicePhoneMobileIcon className="w-6 h-6 text-violet-700" />
        <h2 className="text-xl font-semibold text-violet-950">Cobro con Clip (PinPad)</h2>
      </div>
      <p className="text-sm text-violet-900/80 mb-4">
        Configura la API key de Clip, registra el número de serie de tu terminal y cobra desde la caja. Webhook:{' '}
        <code className="text-xs bg-white/80 px-1 rounded break-all">{baseUrl}</code>{' '}
        (usa el slug de tu restaurante, ej. <code>principal</code>).
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-violet-200 bg-white/70 p-4">
          <h3 className="font-semibold text-stone-900">Configuración</h3>
          {cfg && (
            <p className="text-xs text-stone-600">
              API key: {cfg.hasApiKey ? '✓ configurada' : '—'} · Webhook secret:{' '}
              {cfg.hasWebhookSecret ? '✓' : 'opcional'} · Activo: {cfg.activo ? 'sí' : 'no'}
            </p>
          )}
          <input
            type="password"
            placeholder="API key Clip (Bearer)"
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
          />
          <input
            type="password"
            placeholder="Secreto webhook (mismo valor en header x-clip-webhook-secret)"
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
            value={webhookSecretInput}
            onChange={(e) => setWebhookSecretInput(e.target.value)}
          />
          <button type="button" className="app-btn-secondary text-sm" onClick={guardarConfig}>
            Guardar credenciales
          </button>
          <div className="pt-2 border-t border-violet-100">
            <p className="text-xs font-medium text-stone-700 mb-2">Terminales registradas</p>
            <ul className="text-sm space-y-1 mb-2">
              {terminales.map((t) => (
                <li key={t.id}>
                  <code>{t.serialNumber}</code>
                  {t.nombre ? ` · ${t.nombre}` : ''}
                </li>
              ))}
              {terminales.length === 0 && (
                <li className="text-stone-500">Ninguna — o deja vacío el registro y Clip validará solo en su cuenta.</li>
              )}
            </ul>
            <div className="flex flex-wrap gap-2">
              <input
                className="flex-1 min-w-[140px] rounded border px-2 py-1 text-sm"
                placeholder="Número de serie PinPad"
                value={newSerial}
                onChange={(e) => setNewSerial(e.target.value)}
              />
              <input
                className="flex-1 min-w-[100px] rounded border px-2 py-1 text-sm"
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
              className="mt-2 flex items-center gap-1 text-xs text-violet-700 hover:underline"
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

        <div className="space-y-3 rounded-lg border border-violet-200 bg-white/70 p-4">
          <h3 className="font-semibold text-stone-900">Cobrar</h3>
          <label className="block text-xs text-stone-600">Comanda</label>
          <select
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
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
          <button type="button" className="text-xs text-violet-600 hover:underline" onClick={loadComandas}>
            Actualizar lista
          </button>
          <label className="block text-xs text-stone-600 mt-2">Terminal (número de serie)</label>
          <select
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
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
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
            placeholder="O pega número de serie manualmente"
            value={serialCobro}
            onChange={(e) => setSerialCobro(e.target.value)}
          />
          <label className="block text-xs text-stone-600">Propina extra en terminal (MXN, opcional)</label>
          <input
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
            placeholder="0"
            value={tipExtra}
            onChange={(e) => setTipExtra(e.target.value)}
          />
          {espera && (
            <div className="rounded bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              Esperando pago en terminal… (también puede cerrar el webhook automáticamente)
              <div className="text-xs mt-1 font-mono">pinpad: {espera.pinpadId}</div>
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
