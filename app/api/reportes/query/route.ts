import { NextRequest, NextResponse } from 'next/server'
import { toErrorResponse } from '@/lib/authz/http'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { reportQuerySchema } from '@/lib/reportes/schemas'
import {
  aggregateCancelledWidgetData,
  aggregateInventoryWidgetData,
  aggregateTimingWidgetData,
  aggregateWidgetData,
  fetchCancelledReportBaseData,
  fetchReportBaseData,
} from '@/lib/reportes/server'

const INVENTORY_METRICS = new Set(['inventarioBajo', 'inventarioMovimientos'])
const TIMING_METRICS = new Set(['tiempoPreparacionPromedio'])

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'reportes')
    const tenant = requireActiveTenant(user)

    const body = await request.json()
    const data = reportQuerySchema.parse(body)

    let result
    if (INVENTORY_METRICS.has(data.widget.metric)) {
      result = await aggregateInventoryWidgetData(data.filters, data.widget, tenant.restauranteId)
    } else if (TIMING_METRICS.has(data.widget.metric)) {
      result = await aggregateTimingWidgetData(data.filters, data.widget, tenant.restauranteId)
    } else if (data.widget.metric === 'comandasCanceladas') {
      result = aggregateCancelledWidgetData(
        await fetchCancelledReportBaseData(data.filters, tenant.restauranteId),
        data.widget
      )
    } else {
      result = aggregateWidgetData(
        await fetchReportBaseData(data.filters, tenant.restauranteId),
        data.widget
      )
    }

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/reportes/query:')
  }
}
