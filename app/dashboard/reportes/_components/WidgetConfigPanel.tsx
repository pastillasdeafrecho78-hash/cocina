'use client'

import { useTheme } from '@/components/ThemeProvider'
import {
  METODO_PAGO_LABELS,
  REPORT_CHART_TYPES,
  REPORT_DIMENSIONS,
  REPORT_METRICS,
  TIPO_PEDIDO_LABELS,
  buildWidgetTitle,
} from '@/lib/reportes/catalog'
import { ReportWidgetConfig } from '@/lib/reportes/types'

interface WidgetFilterOptions {
  creadores: Array<{ id: string; label: string }>
  canceladores: Array<{ id: string; label: string }>
  motivosCancelacion: string[]
}

interface WidgetConfigPanelProps {
  onAddWidget: () => void
  onChange: (widgetId: string, patch: Partial<ReportWidgetConfig>) => void
  selectedWidget: ReportWidgetConfig | null
  filterOptions: WidgetFilterOptions
}

const ESTADO_COMANDA_OPTIONS = [
  'PENDIENTE',
  'EN_PREPARACION',
  'LISTO',
  'SERVIDO',
  'PAGADO',
  'CANCELADO',
]

export default function WidgetConfigPanel({
  onAddWidget,
  onChange,
  selectedWidget,
  filterOptions,
}: WidgetConfigPanelProps) {
  const { resolvedTheme } = useTheme()
  const toggleFilterValue = (
    field:
      | 'estados'
      | 'tipoPedido'
      | 'metodoPago'
      | 'creadorIds'
      | 'canceladorIds'
      | 'motivosCancelacion',
    value: string
  ) => {
    if (!selectedWidget) return
    const current = selectedWidget.widgetFilters?.[field] || []
    const nextValues = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]
    onChange(selectedWidget.id, {
      widgetFilters: {
        ...(selectedWidget.widgetFilters || {}),
        [field]: nextValues,
      },
    })
  }

  return (
    <aside className="app-card sticky top-6 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Constructor de widgets</h2>
          <p className="text-sm text-stone-700">
            Diseña cada bloque paso a paso: qué medir, cómo dividir y cómo mostrarlo.
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
          <div className="app-card-muted rounded-2xl !p-4">
            <p className="app-kicker tracking-[0.2em]">1. Qué medir</p>
            <p className="mt-1 text-xs text-stone-700">
              Selecciona la métrica principal del widget.
            </p>
          </div>

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
            <p className="mt-1 text-xs text-stone-500">
              Ejemplo: ventas para dinero, comandas canceladas para seguimiento operativo.
            </p>
          </label>

          <div className="app-card-muted rounded-2xl !p-4">
            <p className="app-kicker tracking-[0.2em]">2. Cómo partir</p>
            <p className="mt-1 text-xs text-stone-700">
              Define el eje de análisis: día, hora, mesero, mesa, método o motivo.
            </p>
          </div>

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

          <div className="app-card-muted rounded-2xl !p-4">
            <p className="app-kicker tracking-[0.2em]">
              3. Cómo visualizar
            </p>
            <p className="mt-1 text-xs text-stone-700">
              Ajusta gráfica, límite y orden para que el widget sea claro.
            </p>
          </div>

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

          <div className="app-card-muted rounded-2xl !p-4">
            <p className="app-kicker tracking-[0.2em]">4. Afinar datos</p>
            <p className="mt-1 text-xs text-stone-700">
              Personaliza este widget con filtros locales sin afectar los demás.
            </p>
          </div>

          <div className="grid gap-4">
            <div>
              <p className="mb-1.5 text-sm font-medium text-stone-700">Estado de comanda</p>
              <div className="flex flex-wrap gap-2">
                {ESTADO_COMANDA_OPTIONS.map((estado) => {
                  const active = (selectedWidget.widgetFilters?.estados || []).includes(estado)
                  return (
                    <button
                      key={estado}
                      type="button"
                      onClick={() => toggleFilterValue('estados', estado)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        active
                          ? 'border-transparent bg-stone-900 text-white dark:bg-white dark:text-stone-900'
                          : 'border-stone-300 bg-white/80 text-stone-700 dark:bg-stone-900/70 dark:text-stone-200'
                      }`}
                    >
                      {estado}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-stone-700">Tipo de pedido</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TIPO_PEDIDO_LABELS).map(([value, label]) => {
                  const active = (selectedWidget.widgetFilters?.tipoPedido || []).includes(value)
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleFilterValue('tipoPedido', value)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        active
                          ? 'border-transparent bg-stone-900 text-white dark:bg-white dark:text-stone-900'
                          : 'border-stone-300 bg-white/80 text-stone-700 dark:bg-stone-900/70 dark:text-stone-200'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-stone-700">Método de pago</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(METODO_PAGO_LABELS).map(([value, label]) => {
                  const active = (selectedWidget.widgetFilters?.metodoPago || []).includes(value)
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleFilterValue('metodoPago', value)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        active
                          ? 'border-transparent bg-stone-900 text-white dark:bg-white dark:text-stone-900'
                          : 'border-stone-300 bg-white/80 text-stone-700 dark:bg-stone-900/70 dark:text-stone-200'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Fecha inicio local</span>
                <input
                  type="date"
                  value={selectedWidget.widgetFilters?.fechaInicio || ''}
                  onChange={(event) =>
                    onChange(selectedWidget.id, {
                      widgetFilters: {
                        ...(selectedWidget.widgetFilters || {}),
                        fechaInicio: event.target.value || undefined,
                      },
                    })
                  }
                  className="app-input app-field"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Fecha fin local</span>
                <input
                  type="date"
                  value={selectedWidget.widgetFilters?.fechaFin || ''}
                  onChange={(event) =>
                    onChange(selectedWidget.id, {
                      widgetFilters: {
                        ...(selectedWidget.widgetFilters || {}),
                        fechaFin: event.target.value || undefined,
                      },
                    })
                  }
                  className="app-input app-field"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Mesero creador</span>
                <select
                  className="app-input app-field"
                  onChange={(event) => {
                    if (event.target.value) toggleFilterValue('creadorIds', event.target.value)
                  }}
                  value=""
                >
                  <option value="">Agregar mesero creador</option>
                  {filterOptions.creadores.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Mesero cancelador</span>
                <select
                  className="app-input app-field"
                  onChange={(event) => {
                    if (event.target.value) toggleFilterValue('canceladorIds', event.target.value)
                  }}
                  value=""
                >
                  <option value="">Agregar mesero cancelador</option>
                  {filterOptions.canceladores.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {(selectedWidget.widgetFilters?.creadorIds || []).map((id) => {
                const label = filterOptions.creadores.find((u) => u.id === id)?.label || id
                return (
                  <button
                    key={`c-${id}`}
                    type="button"
                    onClick={() => toggleFilterValue('creadorIds', id)}
                    className="rounded-full border border-stone-300 px-3 py-1 text-left text-xs text-stone-700 dark:text-stone-200"
                  >
                    Quitar creador: {label}
                  </button>
                )
              })}
              {(selectedWidget.widgetFilters?.canceladorIds || []).map((id) => {
                const label = filterOptions.canceladores.find((u) => u.id === id)?.label || id
                return (
                  <button
                    key={`x-${id}`}
                    type="button"
                    onClick={() => toggleFilterValue('canceladorIds', id)}
                    className="rounded-full border border-stone-300 px-3 py-1 text-left text-xs text-stone-700 dark:text-stone-200"
                  >
                    Quitar cancelador: {label}
                  </button>
                )
              })}
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-stone-700">Motivo de cancelación</span>
              <select
                className="app-input app-field"
                onChange={(event) => {
                  if (event.target.value) toggleFilterValue('motivosCancelacion', event.target.value)
                }}
                value=""
              >
                <option value="">Agregar motivo</option>
                {filterOptions.motivosCancelacion.map((motivo) => (
                  <option key={motivo} value={motivo}>
                    {motivo}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              {(selectedWidget.widgetFilters?.motivosCancelacion || []).map((motivo) => (
                <button
                  key={motivo}
                  type="button"
                  onClick={() => toggleFilterValue('motivosCancelacion', motivo)}
                  className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 dark:text-stone-200"
                >
                  Quitar: {motivo}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
