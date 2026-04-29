export type TipoMovimientoInventarioMvp = 'ENTRADA' | 'AJUSTE_ABSOLUTO'

export type InventarioMovimientoCalculado = {
  tipo: TipoMovimientoInventarioMvp
  cantidad: number
  stockAntes: number
  stockDespues: number
}

export function calcularMovimientoInventario(input: {
  tipo: TipoMovimientoInventarioMvp
  stockActual: number
  cantidad?: number
  stockFinal?: number
}): InventarioMovimientoCalculado {
  if (!Number.isFinite(input.stockActual) || input.stockActual < 0) {
    throw new Error('Stock actual inválido')
  }

  if (input.tipo === 'ENTRADA') {
    const cantidad = input.cantidad ?? 0
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new Error('La cantidad de entrada debe ser mayor a 0')
    }
    return {
      tipo: 'ENTRADA',
      cantidad,
      stockAntes: input.stockActual,
      stockDespues: input.stockActual + cantidad,
    }
  }

  const stockFinal = input.stockFinal ?? 0
  if (!Number.isFinite(stockFinal) || stockFinal < 0) {
    throw new Error('El stock final debe ser mayor o igual a 0')
  }
  return {
    tipo: 'AJUSTE_ABSOLUTO',
    cantidad: stockFinal - input.stockActual,
    stockAntes: input.stockActual,
    stockDespues: stockFinal,
  }
}

export function evaluarAlertasInventario(input: {
  stockActual: number
  stockMinimo: number
  fechaCaducidad?: Date | string | null
  now?: Date
}) {
  const now = input.now ?? new Date()
  const bajoStock = input.stockActual <= input.stockMinimo
  const fecha = input.fechaCaducidad ? new Date(input.fechaCaducidad) : null
  const diasParaCaducar = fecha
    ? Math.ceil((fecha.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null

  return {
    bajoStock,
    caducado: diasParaCaducar !== null && diasParaCaducar < 0,
    caducaPronto: diasParaCaducar !== null && diasParaCaducar >= 0 && diasParaCaducar <= 7,
    diasParaCaducar,
  }
}
