'use client'

import { useTheme } from '@/components/ThemeProvider'
import {
  REPORT_CHART_TYPES,
  REPORT_DIMENSIONS,
  REPORT_METRICS,
  buildWidgetTitle,
} from '@/lib/reportes/catalog'
import { ReportWidgetConfig } from '@/lib/reportes/types'

interface WidgetConfigPanelProps {
  onAddWidget: () => void
  onChange: (widgetId: string, patch: Partial<ReportWidgetConfig>) => void
  selectedWidget: ReportWidgetConfig | null
}

export default function WidgetConfigPanel({
  onAddWidget,
  onChange,
  selectedWidget,
}: WidgetConfigPanelProps) {
  const { resolvedTheme } = useTheme()

  return (
    <aside className="app-card sticky top-6 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Constructor de widgets</h2>
          <p className="text-sm text-stone-600">
            Ajusta cada bloque como si fuera una pequeña consulta BI.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddWidget}
          className={`rounded-full px-4 py-2 text-sm font-medium text-white transition ${
            resolvedTheme === 'dark'
              ? 'bg-white/12 hover:bg-white/18'
              : 'bg-stone-900 hover:bg-stone-800'
          }`}
        >
          Agregar
        </button>
      </div>

      {!selectedWidget ? (
        <div className="mt-6 rounded-3xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-500 dark:bg-stone-900/40">
          Selecciona un widget del tablero para configurarlo.
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">Título</span>
            <input
              type="text"
              value={selectedWidget.title}
              onChange={(event) =>
                onChange(selectedWidget.id, { title: event.target.value || 'Widget' })
              }
              className="app-input app-field"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">Dimensión</span>
            <select
              value={selectedWidget.dimension}
              onChange={(event) =>
                onChange(selectedWidget.id, {
                  dimension: event.target.value as ReportWidgetConfig['dimension'],
                  title: buildWidgetTitle(
                    event.target.value as ReportWidgetConfig['dimension'],
                    selectedWidget.metric
                  ),
                })
              }
              className="app-input app-field"
            >
              {REPORT_DIMENSIONS.map((dimension) => (
                <option key={dimension.value} value={dimension.value}>
                  {dimension.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">Métrica</span>
            <select
              value={selectedWidget.metric}
              onChange={(event) =>
                onChange(selectedWidget.id, {
                  metric: event.target.value as ReportWidgetConfig['metric'],
                  title: buildWidgetTitle(
                    selectedWidget.dimension,
                    event.target.value as ReportWidgetConfig['metric']
                  ),
                })
              }
              className="app-input app-field"
            >
              {(REPORT_DIMENSIONS.find((dimension) => dimension.value === selectedWidget.dimension)
                ?.supportedMetrics || []
              ).map((metric) => {
                const option = REPORT_METRICS.find((item) => item.value === metric)
                return (
                  <option key={metric} value={metric}>
                    {option?.label || metric}
                  </option>
                )
              })}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">
              Tipo de gráfica
            </span>
            <select
              value={selectedWidget.chartType}
              onChange={(event) =>
                onChange(selectedWidget.id, {
                  chartType: event.target.value as ReportWidgetConfig['chartType'],
                })
              }
              className="app-input app-field"
            >
              {REPORT_CHART_TYPES.map((chartType) => (
                <option key={chartType.value} value={chartType.value}>
                  {chartType.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-stone-700">Límite</span>
              <input
                type="number"
                min={1}
                max={50}
                value={selectedWidget.limit}
                onChange={(event) =>
                  onChange(selectedWidget.id, {
                    limit: Math.min(50, Math.max(1, Number(event.target.value) || 1)),
                  })
                }
                className="app-input app-field"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-stone-700">Orden</span>
              <select
                value={selectedWidget.sort}
                onChange={(event) =>
                  onChange(selectedWidget.id, {
                    sort: event.target.value as ReportWidgetConfig['sort'],
                  })
                }
                className="app-input app-field"
              >
                <option value="desc">Mayor a menor</option>
                <option value="asc">Menor a mayor</option>
              </select>
            </label>
          </div>
        </div>
      )}
    </aside>
  )
}
