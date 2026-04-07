import { z } from 'zod'

export const reportFiltersSchema = z.object({
  fechaInicio: z.string().min(1),
  fechaFin: z.string().min(1),
  tipoPedido: z.array(z.string()).default([]),
  metodoPago: z.array(z.string()).default([]),
  estados: z.array(z.string()).optional().default([]),
  creadorIds: z.array(z.string()).optional().default([]),
  canceladorIds: z.array(z.string()).optional().default([]),
  motivosCancelacion: z.array(z.string()).optional().default([]),
})

export const reportWidgetFiltersSchema = z.object({
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional(),
  estados: z.array(z.string()).optional().default([]),
  tipoPedido: z.array(z.string()).optional().default([]),
  metodoPago: z.array(z.string()).optional().default([]),
  creadorIds: z.array(z.string()).optional().default([]),
  canceladorIds: z.array(z.string()).optional().default([]),
  motivosCancelacion: z.array(z.string()).optional().default([]),
})

export const reportWidgetSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  dimension: z.enum([
    'none',
    'dia',
    'hora',
    'tipoPedido',
    'metodoPago',
    'producto',
    'categoria',
    'envio',
    'mesa',
    'usuarioCreador',
    'usuarioCancelador',
    'motivoCancelacion',
  ]),
  metric: z.enum([
    'ventas',
    'comandas',
    'comandasCanceladas',
    'ticketPromedio',
    'productosVendidos',
    'propina',
    'descuento',
  ]),
  chartType: z.enum(['kpi', 'bar', 'line', 'donut', 'table']),
  limit: z.number().int().min(1).max(50).default(10),
  sort: z.enum(['asc', 'desc']).default('desc'),
  widgetFilters: reportWidgetFiltersSchema.optional(),
})

export const reportQuerySchema = z.object({
  filters: reportFiltersSchema,
  widget: reportWidgetSchema,
})

export const dashboardVistaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().optional().nullable(),
  esDefault: z.boolean().optional().default(false),
  filtros: reportFiltersSchema,
  widgets: z.array(reportWidgetSchema).min(1, 'Agrega al menos un widget'),
})
