import { describe, expect, it } from 'vitest'
import { resolveEffectiveRoleId } from '@/lib/authz/effective-role'

describe('resolveEffectiveRoleId', () => {
  it('usa rol por membresía de la sucursal activa cuando existe', () => {
    const result = resolveEffectiveRoleId(
      'r2',
      [
        { restauranteId: 'r1', rolId: 'rol_mesero' },
        { restauranteId: 'r2', rolId: 'rol_admin' },
      ],
      'rol_legacy'
    )
    expect(result.effectiveRolId).toBe('rol_admin')
    expect(result.usedLegacyFallback).toBe(false)
  })

  it('cambiar sucursal activa cambia rol efectivo', () => {
    const asR1 = resolveEffectiveRoleId(
      'r1',
      [
        { restauranteId: 'r1', rolId: 'rol_mesero' },
        { restauranteId: 'r2', rolId: 'rol_admin' },
      ],
      'rol_legacy'
    )
    const asR2 = resolveEffectiveRoleId(
      'r2',
      [
        { restauranteId: 'r1', rolId: 'rol_mesero' },
        { restauranteId: 'r2', rolId: 'rol_admin' },
      ],
      'rol_legacy'
    )
    expect(asR1.effectiveRolId).toBe('rol_mesero')
    expect(asR2.effectiveRolId).toBe('rol_admin')
  })
})
