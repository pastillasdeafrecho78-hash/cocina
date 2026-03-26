import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { calcularReportePeriodo, obtenerInicioPeriodoActual } from '@/lib/caja-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'reportes') && !tienePermiso(user, 'caja')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const fechaInicioParam = searchParams.get('fechaInicio')
    const fechaFinParam = searchParams.get('fechaFin')

    let fechaInicio: Date
    const fechaFin = fechaFinParam ? new Date(fechaFinParam) : new Date()

    const rid = user.restauranteId
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
