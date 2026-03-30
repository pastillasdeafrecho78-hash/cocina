'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { DevicePhoneMobileIcon } from '@heroicons/react/24/outline'
import { apiFetch } from '@/lib/auth-fetch'

interface ComandaOpt {
  id: string
  numeroComanda: string
  estado: string
  total: number
}

export default function ClipCajaSection() {
  const [comandas, setComandas] = useState<ComandaOpt[]>([])
  const [comandaId, setComandaId] = useState('')
  const [serialCobro, setSerialCobro] = useState('')
  const [tipExtra, setTipExtra] = useState('')
  const [cobrando, setCobrando] = useState(false)
  const [espera, setEspera] = useState<{ pagoId: string; pinpadId: string } | null>(null)

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
    loadComandas()
  }, [loadComandas])

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
        toast('Intención creada. Espera la confirmación del pago.', { icon: 'ℹ️' })
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
            Selecciona una comanda e ingresa el número de serie de la terminal para enviar el cobro.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="app-card-muted space-y-3 p-4 sm:p-5 max-w-2xl">
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
          <input
            className="app-input app-field w-full text-sm"
            placeholder="Ingresa el número de serie de la terminal"
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
              Esperando confirmación del pago en la terminal…
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
