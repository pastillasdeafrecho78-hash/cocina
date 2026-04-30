import { describe, expect, it, vi } from 'vitest'
import {
  buildMesaNumeroTenantWhere,
  findMesaByNumeroForTenant,
  mesaNumeroConflictMessage,
} from '@/lib/mesas/tenant'

describe('mesas tenant helpers', () => {
  it('construye unicidad por sucursal activa, no global', () => {
    expect(buildMesaNumeroTenantWhere('restaurante-a', 1)).toEqual({
      restauranteId: 'restaurante-a',
      numero: 1,
    })
  })

  it('busca duplicado siempre con restauranteId y numero', async () => {
    const findFirst = vi.fn(async () => null)
    await findMesaByNumeroForTenant(
      { mesa: { findFirst } },
      { restauranteId: 'restaurante-b', numero: 7 }
    )

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        restauranteId: 'restaurante-b',
        numero: 7,
      },
    })
  })

  it('explica el conflicto dentro de la sucursal', () => {
    expect(mesaNumeroConflictMessage(3)).toContain('mesa 3')
    expect(mesaNumeroConflictMessage(3)).toContain('sucursal')
  })
})
