import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { reportQuerySchema } from '@/lib/reportes/schemas'
import {
  aggregateCancelledWidgetData,
  aggregateWidgetData,
  fetchCancelledReportBaseData,
  fetchReportBaseData,
} from '@/lib/reportes/server'

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'reportes')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const data = reportQuerySchema.parse(body)

    const result =
      data.widget.metric === 'comandasCanceladas'
        ? aggregateCancelledWidgetData(
            await fetchCancelledReportBaseData(data.filters, user.restauranteId),
            data.widget
          )
        : aggregateWidgetData(
            await fetchReportBaseData(data.filters, user.restauranteId),
            data.widget
          )

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: 'Consulta inválida', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error en POST /api/reportes/query:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
