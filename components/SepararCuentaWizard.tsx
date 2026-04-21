'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/auth-fetch'
import toast from 'react-hot-toast'
import {
  computePagoLineasAndMonto,
  mergeAllocationsByItem,
  paidQuantitiesFromPagos,
  type AllocationLine,
} from '@/lib/split-cuenta'

type ItemRow = {
  id: string
  cantidad: number
  subtotal: number
  precioUnitario: number
  producto: { nombre: string }
  estado: string
}

type PagoLite = {
  estado: string
  monto: number
  lineas?: { comandaItemId: string; cantidad: number }[]
}

export type ComandaSplitWizardInput = {
  id: string
  total: number
  propina: number
  descuento: number
  items: ItemRow[]
  pagos?: PagoLite[]
}

type ClipTerminal = {
  id: string
  serialNumber: string
  nombre: string | null
  activo: boolean
  isDefault?: boolean
}

type Fase = 'armar' | 'cobrar'

function sumQtyInGroup(group: AllocationLine[], itemId: string): number {
  return group.filter((l) => l.comandaItemId === itemId).reduce((s, l) => s + l.cantidad, 0)
}

function sumQtyAcrossGroups(groups: AllocationLine[][], itemId: string, excludeGroupIndex?: number): number {
  let s = 0
  groups.forEach((g, idx) => {
    if (idx === excludeGroupIndex) return
    s += sumQtyInGroup(g, itemId)
  })
  return s
}

function mergeGroupLines(group: AllocationLine[]): AllocationLine[] {
  return mergeAllocationsByItem(group)
}

export default function SepararCuentaWizard({
  open,
  onClose,
  comanda,
  onComandaUpdated,
}: {
  open: boolean
  onClose: () => void
  comanda: ComandaSplitWizardInput
  onComandaUpdated: () => void | Promise<void>
}) {
  const [fase, setFase] = useState<Fase>('armar')
  const [grupos, setGrupos] = useState<AllocationLine[][]>([[]])
  const [activeIdx, setActiveIdx] = useState(0)
  const [gruposCobro, setGruposCobro] = useState<AllocationLine[][]>([])
  const [payIdx, setPayIdx] = useState(0)

  const [montoRecibido, setMontoRecibido] = useState('')
  const [cobrandoEfectivo, setCobrandoEfectivo] = useState(false)
  const [cerrandoOffline, setCerrandoOffline] = useState(false)
  const [terminalesClip, setTerminalesClip] = useState<ClipTerminal[]>([])
  const [serialClip, setSerialClip] = useState('')
  const [propinaClip, setPropinaClip] = useState('')
  const [cobrandoClip, setCobrandoClip] = useState(false)
  const [esperaClip, setEsperaClip] = useState<{ pagoId: string; pinpadId: string } | null>(null)

  const paidQty = useMemo(
    () => paidQuantitiesFromPagos(comanda.pagos ?? []),
    [comanda.pagos],
  )

  const reset = useCallback(() => {
    setFase('armar')
    setGrupos([[]])
    setActiveIdx(0)
    setGruposCobro([])
    setPayIdx(0)
    setMontoRecibido('')
    setPropinaClip('')
    setSerialClip('')
    setEsperaClip(null)
  }, [])

  useEffect(() => {
    if (!open) return
    reset()
  }, [open, comanda.id, reset])

  useEffect(() => {
    if (!open || fase !== 'cobrar') return
    void (async () => {
      const res = await apiFetch('/api/clip/terminales')
      const data = await res.json()
      if (!data.success) return
      const active = (data.data as ClipTerminal[]).filter((t) => t.activo)
      setTerminalesClip(active)
      if (active.length === 1) setSerialClip(active[0].serialNumber)
      else {
        const d = active.find((t) => t.isDefault)
        setSerialClip(d?.serialNumber ?? '')
      }
    })()
  }, [open, fase])

  useEffect(() => {
    if (!esperaClip) return
    const t = setInterval(async () => {
      const res = await apiFetch(
        `/api/clip/estado?pagoId=${encodeURIComponent(esperaClip.pagoId)}&pinpadRequestId=${encodeURIComponent(esperaClip.pinpadId)}`,
      )
      const data = await res.json()
      if (data.success && data.data?.status === 'COMPLETADO') {
        toast.success('Pago con Clip completado')
        setEsperaClip(null)
        setPropinaClip('')
        await onComandaUpdated()
        if (payIdx + 1 >= gruposCobro.length) {
          onClose()
        } else {
          setPayIdx((i) => i + 1)
          setMontoRecibido('')
        }
      }
    }, 3500)
    return () => clearInterval(t)
  }, [esperaClip, payIdx, gruposCobro.length, onComandaUpdated, onClose])

  const setQtyInActiveGroup = (itemId: string, qty: number) => {
    setGrupos((prev) => {
      const next = prev.map((g) => [...g])
      const others = sumQtyAcrossGroups(next, itemId, activeIdx)
      const item = comanda.items.find((i) => i.id === itemId)
      if (!item) return prev
      const paid = paidQty[itemId] ?? 0
      const max = Math.max(0, item.cantidad - paid - others)
      const q = Math.max(0, Math.min(qty, max))
      const g = [...(next[activeIdx] ?? [])].filter((l) => l.comandaItemId !== itemId)
      if (q > 0) g.push({ comandaItemId: itemId, cantidad: q })
      next[activeIdx] = mergeGroupLines(g)
      return next
    })
  }

  const qtyInActive = (itemId: string) => sumQtyInGroup(grupos[activeIdx] ?? [], itemId)

  const agregarGrupo = () => {
    setGrupos((prev) => [...prev, []])
    setActiveIdx((prev) => prev + 1)
  }

  const finalizarGrupos = () => {
    const nonEmpty = grupos.map((g) => mergeGroupLines(g)).filter((g) => g.length > 0)
    if (nonEmpty.length === 0) {
      toast.error('Selecciona cantidades en al menos un grupo')
      return
    }
    const mergedByItem: Record<string, number> = {}
    for (const g of nonEmpty) {
      for (const l of g) {
        mergedByItem[l.comandaItemId] = (mergedByItem[l.comandaItemId] ?? 0) + l.cantidad
      }
    }
    const remainder: AllocationLine[] = []
    for (const it of comanda.items) {
      const assigned = mergedByItem[it.id] ?? 0
      const need = it.cantidad - (paidQty[it.id] ?? 0) - assigned
      if (need > 0) remainder.push({ comandaItemId: it.id, cantidad: need })
    }
    let finalGroups = nonEmpty
    if (remainder.length > 0) {
      finalGroups = [...nonEmpty, remainder]
    }
    setGruposCobro(finalGroups)
    setPayIdx(0)
    setFase('cobrar')
    setMontoRecibido('')
  }

  const grupoActualCobro = gruposCobro[payIdx]
  const totalGrupoActual = grupoActualCobro
    ? computePagoLineasAndMonto(comanda, comanda.items, grupoActualCobro).monto
    : 0

  const montoRecibidoNum = parseFloat(montoRecibido.replace(/,/g, '.')) || 0

  const cobrarEfectivoGrupo = async () => {
    if (!grupoActualCobro?.length) return
    if (montoRecibidoNum < totalGrupoActual) {
      toast.error('El monto recibido debe cubrir el total del grupo')
      return
    }
    setCobrandoEfectivo(true)
    try {
      const res = await apiFetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comandaId: comanda.id,
          metodo: 'efectivo',
          allocations: grupoActualCobro,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error ?? 'Error al registrar pago')
        return
      }
      toast.success('Pago registrado')
      await onComandaUpdated()
      if (payIdx + 1 >= gruposCobro.length) {
        onClose()
      } else {
        setPayIdx((i) => i + 1)
        setMontoRecibido('')
      }
    } catch {
      toast.error('Error al registrar pago')
    } finally {
      setCobrandoEfectivo(false)
    }
  }

  const cobrarTerminalOfflineGrupo = async () => {
    if (!grupoActualCobro?.length) return
    setCerrandoOffline(true)
    try {
      const res = await apiFetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comandaId: comanda.id,
          metodo: 'efectivo',
          allocations: grupoActualCobro,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error ?? 'No se pudo registrar el cobro')
        return
      }
      toast.success('Cobro en terminal offline registrado')
      await onComandaUpdated()
      if (payIdx + 1 >= gruposCobro.length) {
        onClose()
      } else {
        setPayIdx((i) => i + 1)
        setMontoRecibido('')
      }
    } catch {
      toast.error('Error al registrar cobro')
    } finally {
      setCerrandoOffline(false)
    }
  }

  const enviarClipGrupo = async () => {
    if (!grupoActualCobro?.length) return
    if (!serialClip.trim()) {
      toast.error('Selecciona una terminal')
      return
    }
    setCobrandoClip(true)
    try {
      const tip = propinaClip ? parseFloat(propinaClip.replace(',', '.')) : 0
      const res = await apiFetch('/api/clip/crear-intencion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comandaId: comanda.id,
          serialNumber: serialClip.trim(),
          tipAmount: Number.isFinite(tip) && tip > 0 ? tip : undefined,
          allocations: grupoActualCobro,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error ?? 'No se pudo enviar el cobro a Clip')
        return
      }
      const pin = data.data?.pinpadRequestId as string | null
      if (!pin) {
        toast.success('Cobro enviado. Espera confirmación desde la terminal.')
        return
      }
      setEsperaClip({ pagoId: data.data.pagoId as string, pinpadId: pin })
      toast.success('Cobro enviado a Clip. Esperando confirmación…')
    } catch {
      toast.error('Error al enviar cobro con Clip')
    } finally {
      setCobrandoClip(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-stone-900">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100">Separar cuenta</h2>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
              {fase === 'armar'
                ? 'Arma cada grupo y luego cobra uno por uno.'
                : `Cobro del grupo ${payIdx + 1} de ${gruposCobro.length}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-300 px-3 py-1 text-sm text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            Cerrar
          </button>
        </div>

        {fase === 'armar' && (
          <>
            <div className="mb-4 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 dark:border-amber-600 dark:bg-amber-950/40">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                Grupo {activeIdx + 1}
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Ajusta las unidades por producto para este grupo. Solo verás lo que aún no está pagado o asignado a
                otros grupos.
              </p>
            </div>

            <div className="mb-4 space-y-3">
              {comanda.items.map((item) => {
                const others = sumQtyAcrossGroups(grupos, item.id, activeIdx)
                const paid = paidQty[item.id] ?? 0
                const max = Math.max(0, item.cantidad - paid - others)
                const q = qtyInActive(item.id)
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 p-3 dark:border-stone-700"
                  >
                    <div>
                      <div className="font-medium text-stone-900 dark:text-stone-100">{item.producto.nombre}</div>
                      <div className="text-xs text-stone-500">
                        Máx. en este grupo: {max} · En comanda: {item.cantidad}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-stone-300 px-2 py-1 text-lg dark:border-stone-600"
                        onClick={() => setQtyInActiveGroup(item.id, q - 1)}
                        disabled={q <= 0}
                      >
                        −
                      </button>
                      <span className="min-w-[2rem] text-center font-semibold">{q}</span>
                      <button
                        type="button"
                        className="rounded-lg border border-stone-300 px-2 py-1 text-lg dark:border-stone-600"
                        onClick={() => setQtyInActiveGroup(item.id, q + 1)}
                        disabled={q >= max}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={agregarGrupo} className="app-btn-secondary rounded-xl px-4 py-2">
                Agregar nuevo grupo
              </button>
              <button type="button" onClick={finalizarGrupos} className="app-btn-primary rounded-xl px-4 py-2">
                Finalizar grupos
              </button>
            </div>
          </>
        )}

        {fase === 'cobrar' && grupoActualCobro && (
          <div className="space-y-4">
            <p className="text-lg text-stone-800 dark:text-stone-100">
              Total grupo: <strong>${totalGrupoActual.toFixed(2)}</strong>
            </p>

            <div className="rounded-xl border border-stone-200 p-4 dark:border-stone-700">
              <p className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-300">Efectivo</p>
              <label className="mb-1 block text-xs text-stone-600">Monto recibido</label>
              <input
                type="text"
                inputMode="decimal"
                value={montoRecibido}
                onChange={(e) => setMontoRecibido(e.target.value)}
                className="app-input app-field mb-2 max-w-xs"
              />
              <button
                type="button"
                disabled={cobrandoEfectivo || montoRecibidoNum < totalGrupoActual}
                onClick={() => void cobrarEfectivoGrupo()}
                className="app-btn-primary mr-2 rounded-xl px-4 py-2 disabled:opacity-50"
              >
                {cobrandoEfectivo ? 'Registrando…' : 'Cobrar en efectivo'}
              </button>
            </div>

            <div className="rounded-xl border border-stone-200 p-4 dark:border-stone-700">
              <p className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-300">Tarjeta (Clip)</p>
              <select
                value={serialClip}
                onChange={(e) => setSerialClip(e.target.value)}
                className="app-input app-field mb-2 w-full max-w-md"
              >
                <option value="">Terminal</option>
                {terminalesClip.map((t) => (
                  <option key={t.id} value={t.serialNumber}>
                    {t.nombre ? `${t.nombre} · ${t.serialNumber}` : t.serialNumber}
                  </option>
                ))}
              </select>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Propina extra terminal (opcional)"
                value={propinaClip}
                onChange={(e) => setPropinaClip(e.target.value)}
                className="app-input app-field mb-2 w-full max-w-md"
              />
              {esperaClip && (
                <p className="mb-2 text-sm text-amber-800">Esperando confirmación de la terminal…</p>
              )}
              <button
                type="button"
                disabled={cobrandoClip || !!esperaClip || !serialClip}
                onClick={() => void enviarClipGrupo()}
                className="app-btn-primary rounded-xl px-4 py-2 disabled:opacity-50"
              >
                {cobrandoClip ? 'Enviando…' : 'Enviar a terminal'}
              </button>
            </div>

            <div className="rounded-xl border border-stone-200 p-4 dark:border-stone-700">
              <p className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-300">Terminal offline</p>
              <button
                type="button"
                disabled={cerrandoOffline}
                onClick={() => void cobrarTerminalOfflineGrupo()}
                className="app-btn-secondary rounded-xl px-4 py-2 disabled:opacity-50"
              >
                {cerrandoOffline ? 'Registrando…' : 'Registrar cobro terminal offline'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
