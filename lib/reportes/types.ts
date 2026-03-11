export type ReportDimension =
  | 'none'
  | 'dia'
  | 'hora'
  | 'tipoPedido'
  | 'metodoPago'
  | 'producto'
  | 'categoria'
  | 'mesa'
  | 'usuario'

export type ReportMetric =
  | 'ventas'
  | 'comandas'
  | 'ticketPromedio'
  | 'productosVendidos'
  | 'propina'
  | 'descuento'

export type ReportChartType = 'kpi' | 'bar' | 'line' | 'donut' | 'table'

export type ReportSortDirection = 'asc' | 'desc'

export interface ReportFilters {
  fechaInicio: string
  fechaFin: string
  tipoPedido: string[]
  metodoPago: string[]
}

export interface ReportWidgetConfig {
  id: string
  title: string
  dimension: ReportDimension
  metric: ReportMetric
  chartType: ReportChartType
  limit: number
  sort: ReportSortDirection
}

export interface ReportMetricTotals {
  ventas: number
  comandas: number
  ticketPromedio: number
  productosVendidos: number
  propina: number
  descuento: number
}

export interface ReportRow {
  key: string
  label: string
  value: number
  metrics: ReportMetricTotals
}

export interface ReportWidgetResult {
  widgetId: string
  title: string
  metric: ReportMetric
  dimension: ReportDimension
  chartType: ReportChartType
  rows: ReportRow[]
  totals: ReportMetricTotals
  generatedAt: string
}

export interface DashboardVistaData {
  id: string
  nombre: string
  descripcion?: string | null
  esDefault: boolean
  filtros: ReportFilters
  widgets: ReportWidgetConfig[]
  createdAt: string
  updatedAt: string
}

export interface LegacyAnaliticaData {
  ventasPorHora: Array<{ hora: number; label: string; ventas: number; comandas: number }>
  ventasPorDia: Array<{ dia: string; diaRaw: string; ventas: number; comandas: number }>
  porTipoPedido: Array<{ nombre: string; tipo: string; count: number; ventas: number }>
  porMetodoPago: Array<{ nombre: string; metodo: string; count: number; monto: number }>
  productosMasVendidos: Array<{ id: string; nombre: string; cantidad: number }>
  resumen: {
    ventasTotales: number
    comandasTotales: number
    ticketPromedio: number
  }
  comandas: Array<{
    id: string
    numeroComanda: string
    total: number
    fechaCreacion: string
    mesa?: { numero: number } | null
    cliente?: { nombre: string } | null
  }>
}
