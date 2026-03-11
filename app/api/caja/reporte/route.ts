import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth'
import { tienePermiso } from '@/lib/permisos'
import { calcularReportePeriodo, obtenerInicioPeriodoActual } from '@/lib/caja-helpers'

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
    const fechaInicioParam = searchParams.get('fechaInicio')
    const fechaFinParam = searchParams.get('fechaFin')

    let fechaInicio: Date
    const fechaFin = fechaFinParam ? new Date(fechaFinParam) : new Date()

    if (fechaInicioParam) {
      fechaInicio = new Date(fechaInicioParam)
    } else {
      fechaInicio = await obtenerInicioPeriodoActual()
    }

    const reporte = await calcularReportePeriodo(fechaInicio, fechaFin)

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
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Error en GET /api/caja/reporte:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          process.env.NODE_ENV === 'development' ? msg : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}
