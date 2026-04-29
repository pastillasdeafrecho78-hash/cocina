import { describe, expect, it } from 'vitest'
import {
  montoDisponibleParaReembolso,
  totalReembolsado,
  validarMontoReembolso,
} from '@/lib/reembolsos/validacion'

describe('reembolsos', () => {
  it('calculates refunded and available amounts', () => {
    expect(totalReembolsado([{ monto: 20 }, { monto: 15.5 }])).toBe(35.5)
    expect(
      montoDisponibleParaReembolso({
        pagoMonto: 100,
        reembolsos: [{ monto: 20 }, { monto: 15.5 }],
      })
    ).toBe(64.5)
  })

  it('rejects refunds above available paid amount', () => {
    expect(
      validarMontoReembolso({
        pagoMonto: 100,
        reembolsos: [{ monto: 80 }],
        montoSolicitado: 25,
      })
    ).toMatchObject({ ok: false })
  })

  it('allows partial refunds', () => {
    expect(
      validarMontoReembolso({
        pagoMonto: 100,
        reembolsos: [{ monto: 20 }],
        montoSolicitado: 30,
      })
    ).toMatchObject({ ok: true, disponible: 80 })
  })
})
