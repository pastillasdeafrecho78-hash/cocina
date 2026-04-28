import { describe, expect, it } from 'vitest'
import { normalizeKdsSlug, resolveLegacyDestino } from '@/lib/kds'

describe('kds helpers', () => {
  it('uses the explicit legacy KDS section when it exists', () => {
    expect(
      resolveLegacyDestino({
        tipoCategoria: 'COMIDA',
        kdsSeccion: { tipoLegacy: 'BARRA' },
      })
    ).toBe('BARRA')
  })

  it('falls back to category routing when the section has no legacy destination', () => {
    expect(
      resolveLegacyDestino({
        tipoCategoria: 'BEBIDA',
        kdsSeccion: null,
      })
    ).toBe('BARRA')

    expect(
      resolveLegacyDestino({
        tipoCategoria: 'POSTRE',
        kdsSeccion: { tipoLegacy: null },
      })
    ).toBe('COCINA')
  })

  it('normalizes section slugs', () => {
    expect(normalizeKdsSlug(' Cocina Fría!! ')).toBe('cocina-fria')
  })
})
