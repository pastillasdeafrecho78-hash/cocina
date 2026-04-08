import { NextRequest, NextResponse } from 'next/server'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'
import { calcularReportePeriodo, obtenerInicioPeriodoActual } from '@/lib/caja-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['reportes', 'caja'])
    const tenant = requireActiveTenant(user)

    const { searchParams } = new URL(request.url)
    const fechaInicioParam = searchParams.get('fechaInicio')
    const fechaFinParam = searchParams.get('fechaFin')

    let fechaInicio: Date
    const fechaFin = fechaFinParam ? new Date(fechaFinParam) : new Date()

    const rid = tenant.restauranteId
    if (fechaInicioParam) {
      fechaInicio = new Date(fechaInicioParam)
    } else {
      fechaInicio = await obtenerInicioPeriodoActual(rid)
    }

    const reporte = await calcularReportePeriodo(fechaInicio, fechaFin, rid)

    return NextResponse.json({
      success: true,
      data: {
        ...reporte,
        detalles: reporte.comandas.map((c) => ({
          numeroComanda: c.numeroComanda,
          total: c.total,
          mesa: c.mesa,
          fechaCreacion: c.fechaCreacion,
        })),
      },
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/caja/reporte:')
  }
}
