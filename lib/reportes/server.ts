import { Prisma } from '@prisma/client'
import { endOfDay, format, getHours, parseISO, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'
import {
  METODO_PAGO_LABELS,
  TIPO_PEDIDO_LABELS,
  buildWidgetTitle,
  getDefaultReportFilters,
  isMetricSupportedForDimension,
} from '@/lib/reportes/catalog'
import {
  LegacyAnaliticaData,
  ReportDimension,
  ReportMetric,
  ReportFilters,
  ReportMetricTotals,
  ReportRow,
  ReportWidgetConfig,
  ReportWidgetResult,
} from '@/lib/reportes/types'
import {
  calcularDuracionPreparacionMs,
  type EventoTiempoLite,
} from '@/lib/tiempos/eventos'

type ReportBaseComanda = Prisma.ComandaGetPayload<{
  select: {
    id: true
    numeroComanda: true
    tipoPedido: true
    total: true
    propina: true
    descuento: true
    motivoCancelacion: true
    fechaCreacion: true
    fechaCompletado: true
    mesa: {
      select: {
        id: true
        numero: true
      }
    }
    cliente: {
      select: {
        nombre: true
      }
    }
    creadoPor: {
      select: {
        id: true
        nombre: true
        apellido: true
      }
    }
    canceladoPor: {
      select: {
        id: true
        nombre: true
        apellido: true
      }
    }
    pagos: {
      where: {
        estado: 'COMPLETADO'
      }
      select: {
        id: true
        monto: true
        metodoPago: true
      }
    }
    items: {
      select: {
        cantidad: true
        subtotal: true
        numeroRonda: true
        productoId: true
        producto: {
          select: {
            nombre: true
            categoria: {
              select: {
                id: true
                nombre: true
              }
            }
          }
        }
      }
    }
  }
}>

interface AggregationSeed {
  key: string
  label: string
  metrics: ReportMetricTotals
}

function emptyTotals(): ReportMetricTotals {
  return {
    ventas: 0,
    comandas: 0,
    comandasCanceladas: 0,
    ticketPromedio: 0,
    productosVendidos: 0,
    propina: 0,
    descuento: 0,
    inventarioBajo: 0,
    inventarioMovimientos: 0,
    tiempoPreparacionPromedio: 0,
  }
}

function computeTicketPromedio(metrics: ReportMetricTotals): number {
  return metrics.comandas > 0 ? metrics.ventas / metrics.comandas : 0
}

function finalizeTotals(metrics: ReportMetricTotals): ReportMetricTotals {
  return {
    ...metrics,
    ticketPromedio: computeTicketPromedio(metrics),
  }
}

function mergeTotals(target: ReportMetricTotals, source: ReportMetricTotals) {
  target.ventas += source.ventas
  target.comandas += source.comandas
  target.comandasCanceladas += source.comandasCanceladas
  target.productosVendidos += source.productosVendidos
  target.propina += source.propina
  target.descuento += source.descuento
  target.inventarioBajo += source.inventarioBajo
  target.inventarioMovimientos += source.inventarioMovimientos
}

function isInventoryMetric(metric: ReportMetric) {
  return metric === 'inventarioBajo' || metric === 'inventarioMovimientos'
}

function isTimingMetric(metric: ReportMetric) {
  return metric === 'tiempoPreparacionPromedio'
}

function normalizeMetodoPago(metodoPago: string | null | undefined) {
  return (metodoPago || 'otro').toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'otro'
}

function getMetodoPagoLabel(metodoPago: string) {
  return METODO_PAGO_LABELS[metodoPago] || metodoPago
}

function ventaComanda(comanda: ReportBaseComanda) {
  const totalConPropina = comanda.total * (1 + (comanda.propina || 0) / 100)
  return totalConPropina - (comanda.descuento || 0)
}

function fechaComanda(comanda: ReportBaseComanda) {
  return comanda.fechaCompletado ? new Date(comanda.fechaCompletado) : new Date(comanda.fechaCreacion)
}

function productCount(comanda: ReportBaseComanda) {
  return comanda.items.reduce((acc, item) => acc + item.cantidad, 0)
}

function buildBaseMetrics(comanda: ReportBaseComanda): ReportMetricTotals {
  const metrics = emptyTotals()
  metrics.ventas = ventaComanda(comanda)
  metrics.comandas = 1
  metrics.productosVendidos = productCount(comanda)
  metrics.propina = comanda.total * ((comanda.propina || 0) / 100)
  metrics.descuento = comanda.descuento || 0
  metrics.ticketPromedio = metrics.ventas
  return metrics
}

export function normalizeReportFilters(input?: Partial<ReportFilters>): ReportFilters {
  const defaults = getDefaultReportFilters()
  return {
    fechaInicio: input?.fechaInicio || defaults.fechaInicio,
    fechaFin: input?.fechaFin || defaults.fechaFin,
    tipoPedido: Array.isArray(input?.tipoPedido) ? input?.tipoPedido.filter(Boolean) : [],
    metodoPago: Array.isArray(input?.metodoPago) ? input?.metodoPago.filter(Boolean) : [],
    estados: Array.isArray(input?.estados) ? input?.estados.filter(Boolean) : [],
    creadorIds: Array.isArray(input?.creadorIds) ? input?.creadorIds.filter(Boolean) : [],
    canceladorIds: Array.isArray(input?.canceladorIds) ? input?.canceladorIds.filter(Boolean) : [],
    motivosCancelacion: Array.isArray(input?.motivosCancelacion)
      ? input?.motivosCancelacion.filter(Boolean)
      : [],
  }
}

export function buildReportWhere(
  filters: ReportFilters,
  restauranteId?: string
): Prisma.ComandaWhereInput {
  const fechaInicio = startOfDay(new Date(filters.fechaInicio))
  const fechaFin = endOfDay(new Date(filters.fechaFin))

  const estadosNoCancelados = (filters.estados || []).filter((estado) => estado !== 'CANCELADO')

  const where: Prisma.ComandaWhereInput = {
    estado: {
      in: (estadosNoCancelados.length > 0 ? estadosNoCancelados : ['PAGADO']) as any[],
    },
    OR: [
      { fechaCompletado: { gte: fechaInicio, lte: fechaFin } },
      { fechaCompletado: null, fechaCreacion: { gte: fechaInicio, lte: fechaFin } },
    ],
  }

  if (restauranteId) {
    where.restauranteId = restauranteId
  }

  if (filters.tipoPedido.length > 0) {
    where.tipoPedido = { in: filters.tipoPedido as any[] }
  }
  if ((filters.creadorIds || []).length > 0) {
    where.creadoPorId = { in: filters.creadorIds }
  }
  if ((filters.canceladorIds || []).length > 0) {
    where.canceladoPorId = { in: filters.canceladorIds }
  }
  if ((filters.motivosCancelacion || []).length > 0) {
    where.motivoCancelacion = { in: filters.motivosCancelacion }
  }

  return where
}

function passesMetodoPagoFilter(comanda: ReportBaseComanda, filters: ReportFilters) {
  if (filters.metodoPago.length === 0) return true

  if (comanda.pagos.length === 0) {
    return filters.metodoPago.includes('efectivo')
  }

  const metodos = comanda.pagos.map((pago) => normalizeMetodoPago(pago.metodoPago))
  return metodos.some((metodo) => filters.metodoPago.includes(metodo))
}

export async function fetchReportBaseData(
  filtersInput?: Partial<ReportFilters>,
  restauranteId?: string
) {
  const filters = normalizeReportFilters(filtersInput)

  const comandas = await prisma.comanda.findMany({
    where: buildReportWhere(filters, restauranteId),
    select: {
      id: true,
      numeroComanda: true,
      tipoPedido: true,
      total: true,
      propina: true,
      descuento: true,
      motivoCancelacion: true,
      fechaCreacion: true,
      fechaCompletado: true,
      mesa: {
        select: {
          id: true,
          numero: true,
        },
      },
      cliente: {
        select: {
          nombre: true,
        },
      },
      creadoPor: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
        },
      },
      canceladoPor: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
        },
      },
      pagos: {
        where: {
          estado: 'COMPLETADO',
        },
        select: {
          id: true,
          monto: true,
          metodoPago: true,
        },
      },
      items: {
        select: {
          cantidad: true,
          subtotal: true,
          numeroRonda: true,
          productoId: true,
          producto: {
            select: {
              nombre: true,
              categoria: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ fechaCompletado: 'desc' }, { fechaCreacion: 'desc' }],
  })

  return comandas.filter((comanda) => passesMetodoPagoFilter(comanda, filters))
}

export function buildCancelledReportWhere(
  filters: ReportFilters,
  restauranteId?: string
): Prisma.ComandaWhereInput {
  const fechaInicio = startOfDay(new Date(filters.fechaInicio))
  const fechaFin = endOfDay(new Date(filters.fechaFin))

  const where: Prisma.ComandaWhereInput = {
    estado: {
      in: ['CANCELADO'] as any[],
    },
    OR: [
      { fechaCancelacion: { gte: fechaInicio, lte: fechaFin } },
      { fechaCancelacion: null, fechaCreacion: { gte: fechaInicio, lte: fechaFin } },
    ],
  }

  if (restauranteId) {
    where.restauranteId = restauranteId
  }

  if (filters.tipoPedido.length > 0) {
    where.tipoPedido = { in: filters.tipoPedido as any[] }
  }
  if ((filters.creadorIds || []).length > 0) {
    where.creadoPorId = { in: filters.creadorIds }
  }
  if ((filters.canceladorIds || []).length > 0) {
    where.canceladoPorId = { in: filters.canceladorIds }
  }
  if ((filters.motivosCancelacion || []).length > 0) {
    where.motivoCancelacion = { in: filters.motivosCancelacion }
  }

  return where
}

export async function fetchCancelledReportBaseData(
  filtersInput?: Partial<ReportFilters>,
  restauranteId?: string
) {
  const filters = normalizeReportFilters(filtersInput)

  return prisma.comanda.findMany({
    where: buildCancelledReportWhere(filters, restauranteId),
    select: {
      id: true,
      numeroComanda: true,
      tipoPedido: true,
      total: true,
      propina: true,
      descuento: true,
      motivoCancelacion: true,
      fechaCreacion: true,
      fechaCompletado: true,
      fechaCancelacion: true,
      mesa: {
        select: {
          id: true,
          numero: true,
        },
      },
      cliente: {
        select: {
          nombre: true,
        },
      },
      creadoPor: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
        },
      },
      canceladoPor: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
        },
      },
      pagos: {
        where: {
          estado: 'COMPLETADO',
        },
        select: {
          id: true,
          monto: true,
          metodoPago: true,
        },
      },
      items: {
        select: {
          cantidad: true,
          subtotal: true,
          numeroRonda: true,
          productoId: true,
          producto: {
            select: {
              nombre: true,
              categoria: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ fechaCancelacion: 'desc' }, { fechaCreacion: 'desc' }],
  })
}

function fechaCanceladaComanda(
  comanda: ReportBaseComanda & { fechaCancelacion?: Date | null }
) {
  return comanda.fechaCancelacion
    ? new Date(comanda.fechaCancelacion)
    : new Date(comanda.fechaCreacion)
}

function getCancelledDimensionSeeds(
  comanda: ReportBaseComanda & { fechaCancelacion?: Date | null },
  dimension: ReportDimension
): AggregationSeed[] {
  const baseDate = fechaCanceladaComanda(comanda)
  const metrics = emptyTotals()
  metrics.comandasCanceladas = 1

  switch (dimension) {
    case 'none':
      return [{ key: 'total', label: 'Total', metrics }]
    case 'dia': {
      const rawKey = format(baseDate, 'yyyy-MM-dd')
      return [{ key: rawKey, label: format(parseISO(rawKey), 'EEE d MMM', { locale: es }), metrics }]
    }
    case 'hora': {
      const hour = getHours(baseDate)
      return [{ key: String(hour), label: `${String(hour).padStart(2, '0')}:00`, metrics }]
    }
    case 'tipoPedido':
      return [
        {
          key: comanda.tipoPedido,
          label: TIPO_PEDIDO_LABELS[comanda.tipoPedido] || comanda.tipoPedido,
          metrics,
        },
      ]
    case 'mesa': {
      const key = comanda.mesa?.id || 'sin_mesa'
      const label = comanda.mesa ? `Mesa ${comanda.mesa.numero}` : 'Sin mesa'
      return [{ key, label, metrics }]
    }
    case 'usuarioCreador': {
      const nombre = `${comanda.creadoPor.nombre} ${comanda.creadoPor.apellido}`.trim()
      return [{ key: comanda.creadoPor.id, label: nombre, metrics }]
    }
    case 'usuarioCancelador': {
      if (!comanda.canceladoPor) {
        return [{ key: 'sin_cancelador', label: 'Sin registro de cancelador', metrics }]
      }
      const nombre = `${comanda.canceladoPor.nombre} ${comanda.canceladoPor.apellido}`.trim()
      return [{ key: comanda.canceladoPor.id, label: nombre, metrics }]
    }
    case 'motivoCancelacion': {
      const motivo = comanda.motivoCancelacion?.trim() || 'Sin motivo especificado'
      return [{ key: motivo.toLowerCase(), label: motivo, metrics }]
    }
    default:
      return [{ key: 'total', label: 'Total', metrics }]
  }
}

function getDimensionSeeds(comanda: ReportBaseComanda, dimension: ReportDimension): AggregationSeed[] {
  const baseMetrics = buildBaseMetrics(comanda)
  const baseDate = fechaComanda(comanda)

  switch (dimension) {
    case 'none':
      return [{ key: 'total', label: 'Total', metrics: baseMetrics }]
    case 'dia': {
      const rawKey = format(baseDate, 'yyyy-MM-dd')
      return [
        {
          key: rawKey,
          label: format(parseISO(rawKey), 'EEE d MMM', { locale: es }),
          metrics: baseMetrics,
        },
      ]
    }
    case 'hora': {
      const hour = getHours(baseDate)
      return [
        {
          key: String(hour),
          label: `${String(hour).padStart(2, '0')}:00`,
          metrics: baseMetrics,
        },
      ]
    }
    case 'tipoPedido': {
      return [
        {
          key: comanda.tipoPedido,
          label: TIPO_PEDIDO_LABELS[comanda.tipoPedido] || comanda.tipoPedido,
          metrics: baseMetrics,
        },
      ]
    }
    case 'mesa': {
      const key = comanda.mesa?.id || 'sin_mesa'
      const label = comanda.mesa ? `Mesa ${comanda.mesa.numero}` : 'Sin mesa'
      return [{ key, label, metrics: baseMetrics }]
    }
    case 'usuarioCreador': {
      const nombre = `${comanda.creadoPor.nombre} ${comanda.creadoPor.apellido}`.trim()
      return [{ key: comanda.creadoPor.id, label: nombre, metrics: baseMetrics }]
    }
    case 'metodoPago': {
      if (comanda.pagos.length === 0) {
        const metrics = emptyTotals()
        metrics.ventas = ventaComanda(comanda)
        metrics.comandas = 1
        metrics.ticketPromedio = metrics.ventas
        return [{ key: 'efectivo', label: getMetodoPagoLabel('efectivo'), metrics }]
      }

      return comanda.pagos.map((pago) => {
        const key = normalizeMetodoPago(pago.metodoPago)
        const metrics = emptyTotals()
        metrics.ventas = pago.monto
        metrics.comandas = 1
        metrics.ticketPromedio = pago.monto
        return {
          key,
          label: getMetodoPagoLabel(key),
          metrics,
        }
      })
    }
    case 'producto':
      return comanda.items.map((item) => {
        const metrics = emptyTotals()
        metrics.ventas = item.subtotal
        metrics.productosVendidos = item.cantidad
        metrics.ticketPromedio = item.subtotal
        return {
          key: item.productoId,
          label: item.producto.nombre,
          metrics,
        }
      })
    case 'categoria':
      return comanda.items.map((item) => {
        const metrics = emptyTotals()
        metrics.ventas = item.subtotal
        metrics.productosVendidos = item.cantidad
        metrics.ticketPromedio = item.subtotal
        return {
          key: item.producto.categoria.id,
          label: item.producto.categoria.nombre,
          metrics,
        }
      })
    case 'envio':
      return comanda.items.map((item) => {
        const metrics = emptyTotals()
        metrics.ventas = item.subtotal
        metrics.productosVendidos = item.cantidad
        metrics.ticketPromedio = item.subtotal
        const ronda = item.numeroRonda || 1
        return {
          key: String(ronda),
          label: `Envio ${ronda}`,
          metrics,
        }
      })
    default:
      return [{ key: 'total', label: 'Total', metrics: baseMetrics }]
  }
}

function sortRows(rows: ReportRow[], widget: ReportWidgetConfig) {
  const factor = widget.sort === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (widget.dimension === 'dia' || widget.dimension === 'hora') {
      if (widget.dimension === 'hora') {
        return widget.sort === 'asc'
          ? Number(a.key) - Number(b.key)
          : Number(b.key) - Number(a.key)
      }

      return widget.sort === 'asc' ? a.key.localeCompare(b.key) : b.key.localeCompare(a.key)
    }
    return (a.value - b.value) * factor
  })
}

function buildEmptyWidgetResult(widgetInput: ReportWidgetConfig): ReportWidgetResult {
  return {
    widgetId: widgetInput.id,
    title: widgetInput.title?.trim() || buildWidgetTitle(widgetInput.dimension, widgetInput.metric),
    metric: widgetInput.metric,
    dimension: widgetInput.dimension,
    chartType: widgetInput.chartType,
    rows: [],
    totals: emptyTotals(),
    generatedAt: new Date().toISOString(),
  }
}

function rowsToWidgetResult(
  widgetInput: ReportWidgetConfig,
  rows: ReportRow[],
  totals: ReportMetricTotals
): ReportWidgetResult {
  const widget = {
    ...widgetInput,
    title: widgetInput.title?.trim() || buildWidgetTitle(widgetInput.dimension, widgetInput.metric),
  }
  const sortedRows = sortRows(rows, widget).slice(0, Math.max(1, widget.limit || 10))

  return {
    widgetId: widget.id,
    title: widget.title,
    metric: widget.metric,
    dimension: widget.dimension,
    chartType: widget.chartType,
    rows: sortedRows,
    totals,
    generatedAt: new Date().toISOString(),
  }
}

export async function aggregateInventoryWidgetData(
  filtersInput: Partial<ReportFilters> | undefined,
  widgetInput: ReportWidgetConfig,
  restauranteId?: string
): Promise<ReportWidgetResult> {
  if (!isMetricSupportedForDimension(widgetInput.dimension, widgetInput.metric)) {
    throw new Error('La métrica no es compatible con la dimensión seleccionada')
  }
  if (!isInventoryMetric(widgetInput.metric)) {
    throw new Error('La métrica solicitada no pertenece a inventario')
  }

  const filters = normalizeReportFilters(filtersInput)
  const fechaInicio = startOfDay(new Date(filters.fechaInicio))
  const fechaFin = endOfDay(new Date(filters.fechaFin))
  const rows = new Map<string, ReportRow>()
  const totals = emptyTotals()
  const db = prisma as any

  if (widgetInput.metric === 'inventarioBajo') {
    const articulos = await db.inventarioArticulo.findMany({
      where: {
        ...(restauranteId ? { restauranteId } : {}),
        activo: true,
        stockMinimo: { gt: 0 },
      },
      select: {
        id: true,
        nombre: true,
        stockActual: true,
        stockMinimo: true,
      },
      orderBy: [{ stockActual: 'asc' }, { nombre: 'asc' }],
      take: 500,
    })
    const articulosBajos = articulos
      .filter((articulo: any) => articulo.stockActual <= articulo.stockMinimo)
      .slice(0, Math.max(1, widgetInput.limit || 20))

    totals.inventarioBajo = articulosBajos.length
    if (widgetInput.dimension === 'none') {
      rows.set('total', {
        key: 'total',
        label: 'Total',
        value: articulosBajos.length,
        metrics: { ...totals },
      })
    } else {
      for (const articulo of articulosBajos) {
        const metrics = emptyTotals()
        metrics.inventarioBajo = 1
        rows.set(articulo.id, {
          key: articulo.id,
          label: `${articulo.nombre} (${articulo.stockActual}/${articulo.stockMinimo})`,
          value: 1,
          metrics,
        })
      }
    }

    return rowsToWidgetResult(widgetInput, Array.from(rows.values()), totals)
  }

  const movimientos = await db.inventarioMovimiento.findMany({
    where: {
      ...(restauranteId ? { restauranteId } : {}),
      createdAt: { gte: fechaInicio, lte: fechaFin },
    },
    select: {
      id: true,
      articulo: {
        select: {
          id: true,
          nombre: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  totals.inventarioMovimientos = movimientos.length
  if (widgetInput.dimension === 'none') {
    rows.set('total', {
      key: 'total',
      label: 'Total',
      value: movimientos.length,
      metrics: { ...totals },
    })
  } else {
    for (const movimiento of movimientos) {
      const key = movimiento.articulo?.id || 'sin_articulo'
      const current = rows.get(key)
      if (current) {
        current.metrics.inventarioMovimientos += 1
        current.value = current.metrics.inventarioMovimientos
        continue
      }

      const metrics = emptyTotals()
      metrics.inventarioMovimientos = 1
      rows.set(key, {
        key,
        label: movimiento.articulo?.nombre || 'Sin artículo',
        value: 1,
        metrics,
      })
    }
  }

  return rowsToWidgetResult(widgetInput, Array.from(rows.values()), totals)
}

export async function aggregateTimingWidgetData(
  filtersInput: Partial<ReportFilters> | undefined,
  widgetInput: ReportWidgetConfig,
  restauranteId?: string
): Promise<ReportWidgetResult> {
  if (!isMetricSupportedForDimension(widgetInput.dimension, widgetInput.metric)) {
    throw new Error('La métrica no es compatible con la dimensión seleccionada')
  }
  if (!isTimingMetric(widgetInput.metric)) {
    throw new Error('La métrica solicitada no pertenece a tiempos')
  }

  const filters = normalizeReportFilters(filtersInput)
  const fechaInicio = startOfDay(new Date(filters.fechaInicio))
  const fechaFin = endOfDay(new Date(filters.fechaFin))
  const db = prisma as any

  const eventos = await db.itemTiempoEvento.findMany({
    where: {
      ...(restauranteId ? { restauranteId } : {}),
      tipo: { in: ['EN_PREPARACION', 'LISTO'] },
      occurredAt: { gte: fechaInicio, lte: fechaFin },
    },
    select: {
      tipo: true,
      occurredAt: true,
      comandaItemId: true,
      producto: {
        select: {
          id: true,
          nombre: true,
        },
      },
      kdsSeccion: {
        select: {
          id: true,
          nombre: true,
        },
      },
    },
    orderBy: { occurredAt: 'asc' },
    take: 2000,
  })

  if (eventos.length === 0) return buildEmptyWidgetResult(widgetInput)

  const porItem = new Map<
    string,
    {
      productoId: string
      productoLabel: string
      kdsSeccionId: string
      kdsSeccionLabel: string
      eventos: EventoTiempoLite[]
    }
  >()

  for (const evento of eventos) {
    if (!evento.comandaItemId) continue
    const fallback: {
      productoId: string
      productoLabel: string
      kdsSeccionId: string
      kdsSeccionLabel: string
      eventos: EventoTiempoLite[]
    } = {
      productoId: evento.producto?.id || 'sin_producto',
      productoLabel: evento.producto?.nombre || 'Sin producto',
      kdsSeccionId: evento.kdsSeccion?.id || 'sin_seccion',
      kdsSeccionLabel: evento.kdsSeccion?.nombre || 'Sin sección KDS',
      eventos: [],
    }
    const current =
      porItem.get(evento.comandaItemId) ||
      fallback
    current.eventos.push({
      tipo: evento.tipo,
      occurredAt: evento.occurredAt,
    })
    porItem.set(evento.comandaItemId, current)
  }

  const accum = new Map<string, { label: string; totalMs: number; count: number }>()
  let totalMs = 0
  let totalCount = 0

  for (const item of porItem.values()) {
    const duracionMs = calcularDuracionPreparacionMs(item.eventos)
    if (duracionMs === null) continue

    const key =
      widgetInput.dimension === 'producto'
        ? item.productoId
        : widgetInput.dimension === 'kdsSeccion'
          ? item.kdsSeccionId
          : 'total'
    const label =
      widgetInput.dimension === 'producto'
        ? item.productoLabel
        : widgetInput.dimension === 'kdsSeccion'
          ? item.kdsSeccionLabel
          : 'Total'

    const current = accum.get(key) || { label, totalMs: 0, count: 0 }
    current.totalMs += duracionMs
    current.count += 1
    accum.set(key, current)
    totalMs += duracionMs
    totalCount += 1
  }

  const totals = emptyTotals()
  totals.tiempoPreparacionPromedio = totalCount > 0 ? totalMs / totalCount / 60000 : 0

  const rows = Array.from(accum.entries()).map(([key, item]) => {
    const metrics = emptyTotals()
    metrics.tiempoPreparacionPromedio = item.count > 0 ? item.totalMs / item.count / 60000 : 0
    return {
      key,
      label: item.label,
      value: metrics.tiempoPreparacionPromedio,
      metrics,
    }
  })

  return rowsToWidgetResult(widgetInput, rows, totals)
}

export function aggregateWidgetData(
  comandas: ReportBaseComanda[],
  widgetInput: ReportWidgetConfig
): ReportWidgetResult {
  const widget = {
    ...widgetInput,
    title:
      widgetInput.title?.trim() ||
      buildWidgetTitle(widgetInput.dimension, widgetInput.metric),
  }

  if (!isMetricSupportedForDimension(widget.dimension, widget.metric)) {
    throw new Error('La métrica no es compatible con la dimensión seleccionada')
  }

  const groups = new Map<string, ReportRow>()
  const totals = emptyTotals()

  for (const comanda of comandas) {
    const seeds = getDimensionSeeds(comanda, widget.dimension)

    for (const seed of seeds) {
      mergeTotals(totals, seed.metrics)

      const current = groups.get(seed.key)
      if (!current) {
        groups.set(seed.key, {
          key: seed.key,
          label: seed.label,
          value: 0,
          metrics: finalizeTotals({ ...seed.metrics }),
        })
        continue
      }

      mergeTotals(current.metrics, seed.metrics)
      current.metrics.ticketPromedio = computeTicketPromedio(current.metrics)
    }
  }

  const rows = Array.from(groups.values()).map((row) => ({
    ...row,
    metrics: finalizeTotals(row.metrics),
    value: finalizeTotals(row.metrics)[widget.metric],
  }))

  const sortedRows = sortRows(rows, widget).slice(0, Math.max(1, widget.limit || 10))

  return {
    widgetId: widget.id,
    title: widget.title,
    metric: widget.metric,
    dimension: widget.dimension,
    chartType: widget.chartType,
    rows: sortedRows,
    totals: finalizeTotals(totals),
    generatedAt: new Date().toISOString(),
  }
}

export function aggregateCancelledWidgetData(
  comandas: Array<ReportBaseComanda & { fechaCancelacion?: Date | null }>,
  widgetInput: ReportWidgetConfig
): ReportWidgetResult {
  const widget = {
    ...widgetInput,
    title: widgetInput.title?.trim() || buildWidgetTitle(widgetInput.dimension, widgetInput.metric),
  }

  if (!isMetricSupportedForDimension(widget.dimension, widget.metric)) {
    throw new Error('La métrica no es compatible con la dimensión seleccionada')
  }
  if (widget.metric !== 'comandasCanceladas') {
    throw new Error('Solo se permite la métrica de comandas canceladas para este dataset')
  }

  const groups = new Map<string, ReportRow>()
  const totals = emptyTotals()

  for (const comanda of comandas) {
    const seeds = getCancelledDimensionSeeds(comanda, widget.dimension)

    for (const seed of seeds) {
      mergeTotals(totals, seed.metrics)
      const current = groups.get(seed.key)
      if (!current) {
        groups.set(seed.key, {
          key: seed.key,
          label: seed.label,
          value: 0,
          metrics: finalizeTotals({ ...seed.metrics }),
        })
        continue
      }
      mergeTotals(current.metrics, seed.metrics)
      current.metrics.ticketPromedio = computeTicketPromedio(current.metrics)
    }
  }

  const rows = Array.from(groups.values()).map((row) => ({
    ...row,
    metrics: finalizeTotals(row.metrics),
    value: row.metrics.comandasCanceladas,
  }))

  const sortedRows = sortRows(rows, widget).slice(0, Math.max(1, widget.limit || 10))

  return {
    widgetId: widget.id,
    title: widget.title,
    metric: widget.metric,
    dimension: widget.dimension,
    chartType: widget.chartType,
    rows: sortedRows,
    totals: finalizeTotals(totals),
    generatedAt: new Date().toISOString(),
  }
}

export async function buildLegacyAnaliticaData(
  filtersInput?: Partial<ReportFilters>,
  restauranteId?: string
): Promise<LegacyAnaliticaData> {
  const comandas = await fetchReportBaseData(filtersInput, restauranteId)

  const ventasPorHora = aggregateWidgetData(comandas, {
    id: 'legacy-hora',
    title: 'Ventas por hora',
    dimension: 'hora',
    metric: 'ventas',
    chartType: 'bar',
    limit: 24,
    sort: 'asc',
  }).rows.map((row) => ({
    hora: parseInt(row.key, 10),
    label: row.label,
    ventas: row.metrics.ventas,
    comandas: row.metrics.comandas,
  }))

  const ventasPorDia = aggregateWidgetData(comandas, {
    id: 'legacy-dia',
    title: 'Ventas por día',
    dimension: 'dia',
    metric: 'ventas',
    chartType: 'line',
    limit: 366,
    sort: 'asc',
  }).rows.map((row) => ({
    dia: row.label,
    diaRaw: row.key,
    ventas: row.metrics.ventas,
    comandas: row.metrics.comandas,
  }))

  const porTipoPedido = aggregateWidgetData(comandas, {
    id: 'legacy-tipo',
    title: 'Tipo de pedido',
    dimension: 'tipoPedido',
    metric: 'comandas',
    chartType: 'donut',
    limit: 10,
    sort: 'desc',
  }).rows.map((row) => ({
    nombre: row.label,
    tipo: row.key,
    count: row.metrics.comandas,
    ventas: row.metrics.ventas,
  }))

  const porMetodoPago = aggregateWidgetData(comandas, {
    id: 'legacy-metodo',
    title: 'Método de pago',
    dimension: 'metodoPago',
    metric: 'ventas',
    chartType: 'donut',
    limit: 10,
    sort: 'desc',
  }).rows.map((row) => ({
    nombre: row.label,
    metodo: row.key,
    count: row.metrics.comandas,
    monto: row.metrics.ventas,
  }))

  const productosMasVendidos = aggregateWidgetData(comandas, {
    id: 'legacy-productos',
    title: 'Productos más vendidos',
    dimension: 'producto',
    metric: 'productosVendidos',
    chartType: 'bar',
    limit: 10,
    sort: 'desc',
  }).rows.map((row) => ({
    id: row.key,
    nombre: row.label,
    cantidad: row.metrics.productosVendidos,
  }))

  const resumen = finalizeTotals(
    comandas.reduce((acc, comanda) => {
      mergeTotals(acc, buildBaseMetrics(comanda))
      return acc
    }, emptyTotals())
  )

  return {
    ventasPorHora,
    ventasPorDia,
    porTipoPedido,
    porMetodoPago,
    productosMasVendidos,
    resumen: {
      ventasTotales: resumen.ventas,
      comandasTotales: resumen.comandas,
      ticketPromedio: resumen.ticketPromedio,
    },
    comandas: comandas.map((comanda) => ({
      id: comanda.id,
      numeroComanda: comanda.numeroComanda,
      total: ventaComanda(comanda),
      fechaCreacion: comanda.fechaCreacion.toISOString(),
      mesa: comanda.mesa,
      cliente: comanda.cliente,
    })),
  }
}
