'use client'

import { useTheme } from '@/components/ThemeProvider'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { REPORT_COLORS, getDimensionLabel, getMetricLabel } from '@/lib/reportes/catalog'
import { ReportWidgetConfig, ReportWidgetResult } from '@/lib/reportes/types'
import { formatMetricValue } from '@/app/dashboard/reportes/utils'

interface WidgetRendererProps {
  loading: boolean
  result?: ReportWidgetResult
  widget: ReportWidgetConfig
}

interface TooltipContentProps {
  active?: boolean
  label?: string
  metricLabel: string
  metricKey: string
  payload?: Array<{ value: number | string }>
  theme: 'light' | 'dark'
}

function formatTooltipValue(
  metric: string,
  value: number | string | readonly (number | string)[] | undefined
) {
  const normalized = Array.isArray(value) ? value[0] : value
  return formatMetricValue(metric, Number(normalized || 0))
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-stone-300 bg-stone-50 text-sm text-stone-500 dark:bg-stone-900/40">
      No hay datos para este widget con los filtros actuales.
    </div>
  )
}

function CustomTooltip({
  active,
  label,
  metricLabel,
  metricKey,
  payload,
  theme,
}: TooltipContentProps) {
  if (!active || !payload?.length) return null

  return (
    <div
      className="rounded-2xl border px-3 py-2 shadow-lg"
      style={{
        borderColor: theme === 'dark' ? 'rgba(120,113,108,0.8)' : 'rgba(228,216,200,0.9)',
        background: theme === 'dark' ? 'rgba(24,22,22,0.96)' : 'rgba(255,252,249,0.96)',
        color: theme === 'dark' ? 'rgb(245 245 244)' : 'rgb(41 37 36)',
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-1 text-sm font-medium">
        {metricLabel}: {formatTooltipValue(metricKey, payload[0]?.value)}
      </p>
    </div>
  )
}

export default function WidgetRenderer({ loading, result, widget }: WidgetRendererProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  if (loading && !result) {
    return (
      <div className="flex h-full min-h-[220px] animate-pulse items-center justify-center rounded-3xl bg-stone-100 text-sm text-stone-500 dark:bg-stone-900/40">
        Cargando widget...
      </div>
    )
  }

  if (!result || result.rows.length === 0) {
    return <EmptyState />
  }

  const metricLabel = getMetricLabel(widget.metric)
  const dimensionLabel = getDimensionLabel(widget.dimension)

  if (widget.chartType === 'kpi') {
    const value = result.totals[widget.metric]
    return (
      <div className="flex min-h-[220px] flex-col justify-between rounded-3xl bg-gradient-to-br from-orange-100 via-rose-50 to-white p-6 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-800 dark:text-amber-300">
            {metricLabel}
          </p>
          <h3 className="mt-4 text-4xl font-semibold text-stone-900">
            {formatMetricValue(widget.metric, value)}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm text-stone-600">
          <div className="rounded-2xl bg-white/70 p-3 dark:bg-white/5">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Comandas</p>
            <p className="mt-1 font-semibold text-stone-900">{result.totals.comandas}</p>
          </div>
          <div className="rounded-2xl bg-white/70 p-3 dark:bg-white/5">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Productos</p>
            <p className="mt-1 font-semibold text-stone-900">{result.totals.productosVendidos}</p>
          </div>
        </div>
      </div>
    )
  }

  if (widget.chartType === 'table') {
    return (
      <div className="overflow-x-auto rounded-3xl border border-stone-200 dark:border-stone-700">
        <table className="min-w-full divide-y divide-stone-200 text-sm dark:divide-stone-800">
          <thead className="bg-stone-50 dark:bg-stone-900/70">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-stone-500">{dimensionLabel}</th>
              <th className="px-4 py-3 text-right font-medium text-stone-500">{metricLabel}</th>
              <th className="px-4 py-3 text-right font-medium text-stone-500">Comandas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white dark:divide-stone-800 dark:bg-stone-950/30">
            {result.rows.map((row) => (
              <tr key={row.key}>
                <td className="px-4 py-3 text-stone-700">{row.label}</td>
                <td className="px-4 py-3 text-right font-medium text-stone-900">
                  {formatMetricValue(widget.metric, row.value)}
                </td>
                <td className="px-4 py-3 text-right text-stone-600">{row.metrics.comandas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const chartData = result.rows.map((row) => ({
    name: row.label,
    value: row.value,
    comandas: row.metrics.comandas,
  }))
  const gridStroke = isDark ? '#3f3f46' : '#e7e5e4'
  const axisTick = isDark ? '#d6d3d1' : '#57534e'
  const lineStroke = isDark ? '#fb923c' : '#b45309'
  const lineFillTop = isDark ? '#fb923c' : '#b45309'
  const lineFillBottom = isDark ? '#fb923c' : '#b45309'
  const legendStyle = {
    color: isDark ? '#e7e5e4' : '#57534e',
    fontSize: '12px',
  }

  if (widget.chartType === 'donut') {
    return (
      <div className="h-[280px] rounded-3xl bg-white/45 px-2 py-3 dark:bg-stone-950/55">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={96}
              paddingAngle={2}
            >
              {chartData.map((_, index) => (
                <Cell key={index} fill={REPORT_COLORS[index % REPORT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={
                <CustomTooltip
                  metricKey={widget.metric}
                  metricLabel={metricLabel}
                  theme={resolvedTheme}
                />
              }
            />
            <Legend wrapperStyle={legendStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (widget.chartType === 'line') {
    return (
      <div className="h-[280px] rounded-3xl bg-white/45 px-2 py-3 dark:bg-stone-950/55">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`fill-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={lineFillTop} stopOpacity={isDark ? 0.28 : 0.45} />
                <stop offset="95%" stopColor={lineFillBottom} stopOpacity={isDark ? 0.01 : 0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: axisTick }} />
            <YAxis
              tick={{ fontSize: 12, fill: axisTick }}
              tickFormatter={(value) => formatMetricValue(widget.metric, Number(value))}
            />
            <Tooltip
              content={
                <CustomTooltip
                  metricKey={widget.metric}
                  metricLabel={metricLabel}
                  theme={resolvedTheme}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={lineStroke}
              strokeWidth={2}
              fill={`url(#fill-${widget.id})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="h-[280px] rounded-3xl bg-white/45 px-2 py-3 dark:bg-stone-950/55">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout={widget.dimension === 'producto' ? 'vertical' : 'horizontal'}>
          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
          {widget.dimension === 'producto' ? (
            <>
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: axisTick }}
                tickFormatter={(value) => formatMetricValue(widget.metric, Number(value))}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 11, fill: axisTick }}
                interval={0}
              />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: axisTick }} />
              <YAxis
                tick={{ fontSize: 12, fill: axisTick }}
                tickFormatter={(value) => formatMetricValue(widget.metric, Number(value))}
              />
            </>
          )}
          <Tooltip
            content={
              <CustomTooltip
                metricKey={widget.metric}
                metricLabel={metricLabel}
                theme={resolvedTheme}
              />
            }
          />
          <Bar dataKey="value" radius={[10, 10, 0, 0]}>
            {chartData.map((_, index) => (
              <Cell key={index} fill={REPORT_COLORS[index % REPORT_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
