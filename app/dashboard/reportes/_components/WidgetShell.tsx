'use client'

import { getChartTypeLabel, getDimensionLabel, getMetricLabel } from '@/lib/reportes/catalog'
import { ReportWidgetConfig, ReportWidgetResult } from '@/lib/reportes/types'
import WidgetRenderer from '@/app/dashboard/reportes/_components/WidgetRenderer'

interface WidgetShellProps {
  index: number
  loading: boolean
  onDelete: () => void
  onDuplicate: () => void
  onMoveDown: () => void
  onMoveUp: () => void
  onSelect: () => void
  result?: ReportWidgetResult
  selected: boolean
  totalWidgets: number
  widget: ReportWidgetConfig
}

export default function WidgetShell({
  index,
  loading,
  onDelete,
  onDuplicate,
  onMoveDown,
  onMoveUp,
  onSelect,
  result,
  selected,
  totalWidgets,
  widget,
}: WidgetShellProps) {
  return (
    <article
      className={`rounded-[30px] border p-5 shadow-sm transition ${
        selected
          ? 'border-orange-300 bg-white shadow-[0_20px_45px_-30px_rgba(220,38,38,0.45)] dark:border-orange-300/60 dark:bg-stone-950/55'
          : 'border-stone-200 bg-white/85 hover:border-amber-200 dark:bg-stone-950/40'
      }`}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <button type="button" onClick={onSelect} className="text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
            Widget {index + 1}
          </p>
          <h3 className="mt-1 text-xl font-semibold text-stone-900">{widget.title}</h3>
          <p className="mt-2 text-sm text-stone-600">
            {getMetricLabel(widget.metric)} · {getDimensionLabel(widget.dimension)} ·{' '}
            {getChartTypeLabel(widget.chartType)}
          </p>
        </button>

        <div className="flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="app-btn-secondary px-3 py-1.5"
          >
            Subir
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === totalWidgets - 1}
            className="app-btn-secondary px-3 py-1.5"
          >
            Bajar
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            className="app-btn-secondary px-3 py-1.5"
          >
            Duplicar
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="app-btn-danger px-3 py-1.5"
          >
            Eliminar
          </button>
        </div>
      </div>

      <div className="mt-5">
        <WidgetRenderer widget={widget} result={result} loading={loading} />
      </div>
    </article>
  )
}
