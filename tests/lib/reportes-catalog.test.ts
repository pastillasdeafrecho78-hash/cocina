import { describe, expect, it } from 'vitest'
import { REPORT_PRESETS, isMetricSupportedForDimension } from '@/lib/reportes/catalog'
import { reportWidgetSchema } from '@/lib/reportes/schemas'

describe('reportes catalog', () => {
  it('rechaza combinaciones invalidas de metrica y dimension', () => {
    const result = reportWidgetSchema.safeParse({
      id: 'w1',
      title: 'Stock bajo por dia',
      dimension: 'dia',
      metric: 'inventarioBajo',
      chartType: 'bar',
      limit: 10,
      sort: 'desc',
    })

    expect(result.success).toBe(false)
  })

  it('mantiene presets con combinaciones soportadas', () => {
    expect(REPORT_PRESETS.length).toBeGreaterThan(0)

    for (const preset of REPORT_PRESETS) {
      expect(
        isMetricSupportedForDimension(preset.widget.dimension, preset.widget.metric)
      ).toBe(true)
    }
  })

  it('acepta metricas nuevas de inventario y tiempos en sus dimensiones', () => {
    expect(isMetricSupportedForDimension('inventarioArticulo', 'inventarioBajo')).toBe(true)
    expect(isMetricSupportedForDimension('kdsSeccion', 'tiempoPreparacionPromedio')).toBe(true)
  })
})
