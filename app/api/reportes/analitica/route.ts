import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth'
import { tienePermiso } from '@/lib/permisos'
import { buildLegacyAnaliticaData, normalizeReportFilters } from '@/lib/reportes/server'

/**
 * GET /api/reportes/analitica
 * Devuelve datos agregados para gráficos de reportes.
 * Query: fechaInicio, fechaFin (ISO strings)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'reportes')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const filters = normalizeReportFilters({
      fechaInicio: searchParams.get('fechaInicio') || undefined,
      fechaFin: searchParams.get('fechaFin') || undefined,
      tipoPedido: searchParams.getAll('tipoPedido'),
      metodoPago: searchParams.getAll('metodoPago'),
    })
    const data = await buildLegacyAnaliticaData(filters)

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Error en GET /api/reportes/analitica:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
