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
  aggregateWidgetData,
  fetchCancelledReportBaseData,
  fetchReportBaseData,
} from '@/lib/reportes/server'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'reportes')
    const tenant = requireActiveTenant(user)

    const body = await request.json()
    const data = reportQuerySchema.parse(body)

    const result =
      data.widget.metric === 'comandasCanceladas'
        ? aggregateCancelledWidgetData(
            await fetchCancelledReportBaseData(data.filters, tenant.restauranteId),
            data.widget
          )
        : aggregateWidgetData(
            await fetchReportBaseData(data.filters, tenant.restauranteId),
            data.widget
          )

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/reportes/query:')
  }
}
