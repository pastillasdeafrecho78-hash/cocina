/**
 * Lógica compartida para separación de cuenta: prorrateo de propina/descuento,
 * validación de cantidades por ítem y cálculo de montos por cobro parcial.
 */

export const SPLIT_CUENTA_EPS = 0.02

export type AllocationLine = { comandaItemId: string; cantidad: number }

export type ComandaCobroInput = {
  total: number
  propina: number | null
  descuento: number | null
}

export type ComandaItemCobroInput = {
  id: string
  cantidad: number
  subtotal: number
}

export type PagoResumenInput = {
  estado: string
  monto: number
  lineas?: { comandaItemId: string; cantidad: number }[]
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/** Total a cobrar de la comanda (misma fórmula que /api/pagos). */
export function totalComandaCobrar(comanda: ComandaCobroInput): number {
  const tipPct = comanda.propina || 0
  const disc = comanda.descuento || 0
  return roundMoney(Math.max(0, comanda.total * (1 + tipPct / 100) - disc))
}

export function itemsSubtotalSum(items: { subtotal: number }[]): number {
  return roundMoney(items.reduce((a, i) => a + i.subtotal, 0))
}

export function mergeAllocationsByItem(allocation: AllocationLine[]): AllocationLine[] {
  const m = new Map<string, number>()
  for (const a of allocation) {
    if (a.cantidad <= 0) continue
    m.set(a.comandaItemId, (m.get(a.comandaItemId) ?? 0) + a.cantidad)
  }
  return [...m.entries()].map(([comandaItemId, cantidad]) => ({ comandaItemId, cantidad }))
}

export function paidQuantitiesFromPagos(pagos: PagoResumenInput[]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const p of pagos) {
    if (p.estado !== 'COMPLETADO') continue
    for (const l of p.lineas ?? []) {
      acc[l.comandaItemId] = (acc[l.comandaItemId] ?? 0) + l.cantidad
    }
  }
  return acc
}

export function sumPagosCompletadosMonto(pagos: { estado: string; monto: number }[]): number {
  return roundMoney(pagos.filter((p) => p.estado === 'COMPLETADO').reduce((a, p) => a + p.monto, 0))
}

export function validateAllocations(
  items: { id: string; cantidad: number }[],
  allocation: AllocationLine[],
  paidQty: Record<string, number>,
): { ok: true } | { ok: false; error: string } {
  const merged = mergeAllocationsByItem(allocation)
  const itemMap = new Map(items.map((i) => [i.id, i]))
  for (const line of merged) {
    const it = itemMap.get(line.comandaItemId)
    if (!it) return { ok: false, error: 'Ítem no pertenece a la comanda' }
    const used = paidQty[line.comandaItemId] ?? 0
    if (used + line.cantidad > it.cantidad) {
      return { ok: false, error: 'Las cantidades exceden lo disponible del ítem' }
    }
  }
  return { ok: true }
}

export function buildFullAllocationFromItems(items: { id: string; cantidad: number }[]): AllocationLine[] {
  return items.map((i) => ({ comandaItemId: i.id, cantidad: i.cantidad }))
}

/** Cantidades aún no cubiertas por PagoLinea de pagos completados (cobro “lo que falta” sin mandar allocations). */
export function buildRemainingAllocationFromItems(
  items: { id: string; cantidad: number }[],
  paidQty: Record<string, number>,
): AllocationLine[] {
  const out: AllocationLine[] = []
  for (const it of items) {
    const rest = Math.max(0, it.cantidad - (paidQty[it.id] ?? 0))
    if (rest > 0) out.push({ comandaItemId: it.id, cantidad: rest })
  }
  return out
}

/**
 * Calcula importe por línea y monto total del cobro (incluye parte proporcional de propina y descuento de la comanda).
 */
export function computePagoLineasAndMonto(
  comanda: ComandaCobroInput,
  items: ComandaItemCobroInput[],
  allocation: AllocationLine[],
): { monto: number; lineas: { comandaItemId: string; cantidad: number; importe: number }[] } {
  const merged = mergeAllocationsByItem(allocation)
  const itemMap = new Map(items.map((i) => [i.id, i]))

  const baseRows: { comandaItemId: string; cantidad: number; base: number }[] = []
  for (const a of merged) {
    const it = itemMap.get(a.comandaItemId)
    if (!it || it.cantidad <= 0) continue
    const base = (a.cantidad / it.cantidad) * it.subtotal
    baseRows.push({ comandaItemId: a.comandaItemId, cantidad: a.cantidad, base: roundMoney(base) })
  }

  const B = roundMoney(baseRows.reduce((s, x) => s + x.base, 0))
  if (B <= 0) {
    return { monto: 0, lineas: [] }
  }

  const S = itemsSubtotalSum(items)
  const tipTotal = roundMoney(comanda.total * ((comanda.propina || 0) / 100))
  const discTotal = roundMoney(comanda.descuento || 0)
  const groupTip = S > 0 ? roundMoney((B / S) * tipTotal) : 0
  const groupDisc = S > 0 ? roundMoney((B / S) * discTotal) : 0
  const groupTotal = roundMoney(B + groupTip - groupDisc)

  const lineas = baseRows.map((row) => {
    const share = row.base / B
    const importe = roundMoney(share * groupTotal)
    return { comandaItemId: row.comandaItemId, cantidad: row.cantidad, importe }
  })

  const drift = roundMoney(groupTotal - lineas.reduce((s, l) => s + l.importe, 0))
  if (Math.abs(drift) >= 0.001 && lineas.length > 0) {
    const last = lineas[lineas.length - 1]
    last.importe = roundMoney(last.importe + drift)
  }

  const monto = roundMoney(lineas.reduce((s, l) => s + l.importe, 0))
  return { monto, lineas }
}

export function isFullyPaidAfterPayment(paidSum: number, newPaymentMonto: number, totalDue: number): boolean {
  return paidSum + newPaymentMonto >= totalDue - SPLIT_CUENTA_EPS
}

export function wouldExceedTotal(paidSum: number, newPaymentMonto: number, totalDue: number): boolean {
  return paidSum + newPaymentMonto > totalDue + SPLIT_CUENTA_EPS
}

/** Suma de cantidades en líneas de pagos completados cubre cada ítem de la comanda. */
export function itemsTotalmenteAsignadosPorLineas(
  items: { id: string; cantidad: number }[],
  pagosCompletados: PagoResumenInput[],
): boolean {
  if (items.length === 0) return false
  const q = paidQuantitiesFromPagos(pagosCompletados)
  return items.every((it) => (q[it.id] ?? 0) >= it.cantidad)
}

export function pagosTienenDetallePorLinea(pagosCompletados: PagoResumenInput[]): boolean {
  return pagosCompletados.some((p) => (p.lineas?.length ?? 0) > 0)
}

/**
 * Cerrar comanda y liberar mesa: total monetario al día, o todas las unidades cubiertas en PagoLinea
 * con el total casi cubierto (evita quedar colgado por centavos al separar cuenta).
 */
export function debeSaldarComandaYLiberarMesa(
  items: { id: string; cantidad: number }[],
  pagosCompletados: PagoResumenInput[],
  totalDue: number,
): boolean {
  const paidSum = sumPagosCompletadosMonto(pagosCompletados)
  if (isFullyPaidAfterPayment(0, paidSum, totalDue)) return true
  if (!pagosTienenDetallePorLinea(pagosCompletados)) return false
  if (!itemsTotalmenteAsignadosPorLineas(items, pagosCompletados)) return false
  return paidSum >= totalDue - 0.15
}
