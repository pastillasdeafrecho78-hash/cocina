import { NextRequest, NextResponse } from 'next/server'
import { toErrorResponse } from '@/lib/authz/http'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'

export const dynamic = 'force-dynamic'
import { buildLegacyAnaliticaData, normalizeReportFilters } from '@/lib/reportes/server'

/**
 * GET /api/reportes/analitica
 * Devuelve datos agregados para gráficos de reportes.
 * Query: fechaInicio, fechaFin (ISO strings)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'reportes')
    const tenant = requireActiveTenant(user)

    const { searchParams } = new URL(request.url)
    const filters = normalizeReportFilters({
      fechaInicio: searchParams.get('fechaInicio') || undefined,
      fechaFin: searchParams.get('fechaFin') || undefined,
      tipoPedido: searchParams.getAll('tipoPedido'),
      metodoPago: searchParams.getAll('metodoPago'),
    })
    const data = await buildLegacyAnaliticaData(filters, tenant.restauranteId)

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/reportes/analitica:')
  }
}
