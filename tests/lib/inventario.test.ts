import { describe, expect, it } from 'vitest'
import {
  calcularMovimientoInventario,
  evaluarAlertasInventario,
} from '@/lib/inventario/movimientos'

describe('inventario helpers', () => {
  it('calculates purchase/entry movements', () => {
    expect(
      calcularMovimientoInventario({
        tipo: 'ENTRADA',
        stockActual: 5,
        cantidad: 3,
      })
    ).toEqual({
      tipo: 'ENTRADA',
      cantidad: 3,
      stockAntes: 5,
      stockDespues: 8,
    })
  })

  it('calculates absolute stock adjustments', () => {
    expect(
      calcularMovimientoInventario({
        tipo: 'AJUSTE_ABSOLUTO',
        stockActual: 8,
        stockFinal: 2,
      })
    ).toEqual({
      tipo: 'AJUSTE_ABSOLUTO',
      cantidad: -6,
      stockAntes: 8,
      stockDespues: 2,
    })
  })

  it('detects low stock and expiry alerts', () => {
    expect(
      evaluarAlertasInventario({
        stockActual: 2,
        stockMinimo: 3,
        fechaCaducidad: '2026-05-03T00:00:00.000Z',
        now: new Date('2026-04-28T00:00:00.000Z'),
      })
    ).toMatchObject({
      bajoStock: true,
      caducaPronto: true,
      caducado: false,
      diasParaCaducar: 5,
    })
  })
})
