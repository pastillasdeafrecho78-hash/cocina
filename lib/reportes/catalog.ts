import { subDays } from 'date-fns'
import {
  ReportChartType,
  ReportDimension,
  ReportFilters,
  ReportMetric,
  ReportWidgetConfig,
} from '@/lib/reportes/types'

export const REPORT_COLORS = ['#b45309', '#c2410c', '#15803d', '#1d4ed8', '#7c3aed', '#be123c']

export const TIPO_PEDIDO_LABELS: Record<string, string> = {
  EN_MESA: 'En mesa',
  PARA_LLEVAR: 'Para llevar',
  A_DOMICILIO: 'A domicilio',
  WHATSAPP: 'WhatsApp',
}

export const METODO_PAGO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta_credito: 'Tarjeta crédito',
  tarjeta_debito: 'Tarjeta débito',
  oxxo: 'OXXO',
  spei: 'SPEI',
  stripe: 'Stripe',
  otro: 'Otro',
}

export const REPORT_DIMENSIONS: Array<{
  value: ReportDimension
  label: string
  supportedMetrics: ReportMetric[]
}> = [
  {
    value: 'none',
    label: 'Sin desglose',
    supportedMetrics: ['ventas', 'comandas', 'ticketPromedio', 'productosVendidos', 'propina', 'descuento'],
  },
  {
    value: 'dia',
    label: 'Por día',
    supportedMetrics: ['ventas', 'comandas', 'ticketPromedio', 'productosVendidos', 'propina', 'descuento'],
  },
  {
    value: 'hora',
    label: 'Por hora',
    supportedMetrics: ['ventas', 'comandas', 'ticketPromedio', 'productosVendidos', 'propina', 'descuento'],
  },
  {
    value: 'tipoPedido',
    label: 'Por tipo de pedido',
    supportedMetrics: ['ventas', 'comandas', 'ticketPromedio', 'productosVendidos', 'propina', 'descuento'],
  },
  {
    value: 'metodoPago',
    label: 'Por método de pago',
    supportedMetrics: ['ventas', 'comandas', 'ticketPromedio'],
  },
  {
    value: 'producto',
    label: 'Por producto',
    supportedMetrics: ['ventas', 'productosVendidos'],
  },
  {
    value: 'categoria',
    label: 'Por categoría',
    supportedMetrics: ['ventas', 'productosVendidos'],
  },
  {
    value: 'mesa',
    label: 'Por mesa',
    supportedMetrics: ['ventas', 'comandas', 'ticketPromedio', 'productosVendidos', 'propina', 'descuento'],
  },
  {
    value: 'usuario',
    label: 'Por usuario',
    supportedMetrics: ['ventas', 'comandas', 'ticketPromedio', 'productosVendidos', 'propina', 'descuento'],
  },
]

export const REPORT_METRICS: Array<{ value: ReportMetric; label: string; shortLabel: string }> = [
  { value: 'ventas', label: 'Ventas', shortLabel: 'Ventas' },
  { value: 'comandas', label: 'Comandas', shortLabel: 'Comandas' },
  { value: 'ticketPromedio', label: 'Ticket promedio', shortLabel: 'Ticket' },
  { value: 'productosVendidos', label: 'Productos vendidos', shortLabel: 'Productos' },
  { value: 'propina', label: 'Propina', shortLabel: 'Propina' },
  { value: 'descuento', label: 'Descuento', shortLabel: 'Descuento' },
]

export const REPORT_CHART_TYPES: Array<{ value: ReportChartType; label: string }> = [
  { value: 'kpi', label: 'KPI' },
  { value: 'bar', label: 'Barras' },
  { value: 'line', label: 'Línea' },
  { value: 'donut', label: 'Dona' },
  { value: 'table', label: 'Tabla' },
]

export function getDefaultReportFilters(): ReportFilters {
  const hoy = new Date()
  return {
    fechaInicio: subDays(hoy, 6).toISOString().split('T')[0],
    fechaFin: hoy.toISOString().split('T')[0],
    tipoPedido: [],
    metodoPago: [],
  }
}

export function getDefaultWidgets(): ReportWidgetConfig[] {
  return [
    {
      id: crypto.randomUUID(),
      title: 'Ventas totales',
      dimension: 'none',
      metric: 'ventas',
      chartType: 'kpi',
      limit: 8,
      sort: 'desc',
    },
    {
      id: crypto.randomUUID(),
      title: 'Comandas pagadas',
      dimension: 'none',
      metric: 'comandas',
      chartType: 'kpi',
      limit: 8,
      sort: 'desc',
    },
    {
      id: crypto.randomUUID(),
      title: 'Ventas por día',
      dimension: 'dia',
      metric: 'ventas',
      chartType: 'line',
      limit: 14,
      sort: 'asc',
    },
    {
      id: crypto.randomUUID(),
      title: 'Ventas por método de pago',
      dimension: 'metodoPago',
      metric: 'ventas',
      chartType: 'donut',
      limit: 6,
      sort: 'desc',
    },
  ]
}

export function getMetricLabel(metric: ReportMetric): string {
  return REPORT_METRICS.find((item) => item.value === metric)?.label || metric
}

export function getDimensionLabel(dimension: ReportDimension): string {
  return REPORT_DIMENSIONS.find((item) => item.value === dimension)?.label || dimension
}

export function getChartTypeLabel(chartType: ReportChartType): string {
  return REPORT_CHART_TYPES.find((item) => item.value === chartType)?.label || chartType
}

export function buildWidgetTitle(dimension: ReportDimension, metric: ReportMetric): string {
  const dimensionLabel = getDimensionLabel(dimension)
  const metricLabel = getMetricLabel(metric)
  return dimension === 'none' ? metricLabel : `${metricLabel} ${dimensionLabel.toLowerCase()}`
}

export function isMetricSupportedForDimension(
  dimension: ReportDimension,
  metric: ReportMetric
): boolean {
  const config = REPORT_DIMENSIONS.find((item) => item.value === dimension)
  return config ? config.supportedMetrics.includes(metric) : false
}
