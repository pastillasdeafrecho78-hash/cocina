'use client'

import { ReportWidgetConfig, ReportWidgetResult } from '@/lib/reportes/types'
import WidgetShell from '@/app/dashboard/reportes/_components/WidgetShell'

interface DashboardCanvasProps {
  loading: boolean
  onDeleteWidget: (widgetId: string) => void
  onDuplicateWidget: (widgetId: string) => void
  onMoveWidget: (widgetId: string, direction: 'up' | 'down') => void
  onSelectWidget: (widgetId: string) => void
  results: Record<string, ReportWidgetResult>
  selectedWidgetId: string | null
  widgets: ReportWidgetConfig[]
}

export default function DashboardCanvas({
  loading,
  onDeleteWidget,
  onDuplicateWidget,
  onMoveWidget,
  onSelectWidget,
  results,
  selectedWidgetId,
  widgets,
}: DashboardCanvasProps) {
  if (widgets.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-stone-300 bg-white/60 p-10 text-center text-stone-500 dark:bg-stone-950/30 dark:text-stone-400">
        Todavía no hay widgets. Agrega uno desde el panel derecho para empezar tu tablero.
      </div>
    )
  }

  return (
    <div className="grid gap-5">
      {widgets.map((widget, index) => (
        <WidgetShell
          key={widget.id}
          index={index}
          loading={loading}
          onDelete={() => onDeleteWidget(widget.id)}
          onDuplicate={() => onDuplicateWidget(widget.id)}
          onMoveDown={() => onMoveWidget(widget.id, 'down')}
          onMoveUp={() => onMoveWidget(widget.id, 'up')}
          onSelect={() => onSelectWidget(widget.id)}
          result={results[widget.id]}
          selected={selectedWidgetId === widget.id}
          totalWidgets={widgets.length}
          widget={widget}
        />
      ))}
    </div>
  )
}
