import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth'
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
    if (!['CAJERO', 'ADMIN', 'GERENTE'].includes(user.rol)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para Corte X' }, { status: 403 })
    }

    const fechaInicio = await obtenerInicioPeriodoActual()
    const fechaFin = new Date()

    const reporte = await calcularReportePeriodo(fechaInicio, fechaFin)

    const corteX = await prisma.corteX.create({
      data: {
        usuarioId: user.id,
        totalVentas: reporte.totalVentas,
        totalEfectivo: reporte.totalEfectivo,
        totalTarjeta: reporte.totalTarjeta,
        totalOtros: reporte.totalOtros,
        numComandas: reporte.numComandas,
        detalles: reporte.comandas as any,
      },
    })

    await prisma.auditoria.create({
      data: {
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
