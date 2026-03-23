import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth'
import { tienePermiso } from '@/lib/permisos'
import { calcularReportePeriodo, obtenerInicioPeriodoActual } from '@/lib/caja-helpers'

/**
 * POST /api/caja/corte-x
 * Corte X: reporte temporal. NO reinicia la caja.
 * Solo guarda el snapshot y devuelve el reporte.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'caja')) {
      return NextResponse.json({ success: false, error: 'Sin permisos para Corte X' }, { status: 403 })
    }

    const rid = user.restauranteId
    const fechaInicio = await obtenerInicioPeriodoActual(rid)
    const fechaFin = new Date()

    const reporte = await calcularReportePeriodo(fechaInicio, fechaFin, rid)

    const detallesJson = reporte.comandas.map((c) => ({
      id: c.id,
      numeroComanda: c.numeroComanda,
      total: c.total,
      mesa: c.mesa,
      fechaCreacion: c.fechaCreacion.toISOString(),
    }))

    const corteX = await prisma.corteX.create({
      data: {
        restauranteId: user.restauranteId,
        usuarioId: user.id,
        totalVentas: reporte.totalVentas,
        totalEfectivo: reporte.totalEfectivo,
        totalTarjeta: reporte.totalTarjeta,
        totalOtros: reporte.totalOtros,
        numComandas: reporte.numComandas,
        detalles: detallesJson,
      },
    })

    await prisma.auditoria.create({
      data: {
        restauranteId: user.restauranteId,
        usuarioId: user.id,
        accion: 'CORTE_X',
        entidad: 'CorteX',
        entidadId: corteX.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        corteX: { id: corteX.id, fechaHora: corteX.fechaHora },
        reporte: {
          fechaInicio: reporte.fechaInicio,
          fechaFin: reporte.fechaFin,
          totalVentas: reporte.totalVentas,
          totalEfectivo: reporte.totalEfectivo,
          totalTarjeta: reporte.totalTarjeta,
          totalOtros: reporte.totalOtros,
          numComandas: reporte.numComandas,
          comandas: reporte.comandas,
        },
      },
    })
  } catch (error) {
    console.error('Error en POST /api/caja/corte-x:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
