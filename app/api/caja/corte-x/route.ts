import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calcularReportePeriodo, obtenerInicioPeriodoActual } from '@/lib/caja-helpers'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

/**
 * POST /api/caja/corte-x
 * Corte X: reporte temporal. NO reinicia la caja.
 * Solo guarda el snapshot y devuelve el reporte.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'caja')
    const tenant = requireActiveTenant(user)

    const rid = tenant.restauranteId
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
        restauranteId: tenant.restauranteId,
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
        restauranteId: tenant.restauranteId,
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
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/caja/corte-x:')
  }
}
