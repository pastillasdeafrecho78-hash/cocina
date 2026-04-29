import { describe, expect, it } from 'vitest'
import { getMesaPixelSize, normalizeMesaLayout } from '@/lib/mesas/layout'

describe('mesa layout helpers', () => {
  it('normalizes defaults', () => {
    expect(normalizeMesaLayout({})).toEqual({
      forma: 'RECTANGULAR',
      ancho: 1,
      alto: 1,
    })
  })

  it('keeps circular tables proportional', () => {
    expect(normalizeMesaLayout({ forma: 'CIRCULAR', ancho: 2, alto: 4 })).toEqual({
      forma: 'CIRCULAR',
      ancho: 2,
      alto: 2,
    })
  })

  it('converts dimensions to pixels', () => {
    expect(getMesaPixelSize({ ancho: 2, alto: 1.5, cellSize: 50 })).toEqual({
      width: 100,
      height: 75,
    })
  })
})
