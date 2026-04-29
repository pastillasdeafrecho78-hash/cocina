import { describe, expect, it } from 'vitest'
import {
  calcularDuracionPreparacionMs,
  resumirDuracionesPorClave,
  tipoEventoParaEstado,
} from '@/lib/tiempos/eventos'

describe('tiempos eventos', () => {
  it('maps item states to event types', () => {
    expect(tipoEventoParaEstado('EN_PREPARACION')).toBe('EN_PREPARACION')
    expect(tipoEventoParaEstado('LISTO')).toBe('LISTO')
    expect(tipoEventoParaEstado('ENTREGADO')).toBe('ENTREGADO')
  })

  it('calculates preparation duration from preparation to ready', () => {
    expect(
      calcularDuracionPreparacionMs([
        { tipo: 'ENTRADA', occurredAt: '2026-04-29T10:00:00.000Z' },
        { tipo: 'EN_PREPARACION', occurredAt: '2026-04-29T10:02:00.000Z' },
        { tipo: 'LISTO', occurredAt: '2026-04-29T10:09:00.000Z' },
      ])
    ).toBe(7 * 60 * 1000)
  })

  it('does not inflate listoPorDefault items without preparation event', () => {
    expect(
      calcularDuracionPreparacionMs([
        { tipo: 'ENTRADA', occurredAt: '2026-04-29T10:00:00.000Z' },
        { tipo: 'LISTO', occurredAt: '2026-04-29T10:00:00.000Z' },
      ])
    ).toBeNull()
  })

  it('aggregates averages by key', () => {
    expect(
      resumirDuracionesPorClave([
        {
          key: 'cocina',
          eventos: [
            { tipo: 'EN_PREPARACION', occurredAt: '2026-04-29T10:00:00.000Z' },
            { tipo: 'LISTO', occurredAt: '2026-04-29T10:05:00.000Z' },
          ],
        },
      ])
    ).toEqual([{ key: 'cocina', count: 1, promedioMs: 300000, promedioMinutos: 5 }])
  })
})
