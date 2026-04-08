import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  calcularReportePeriodo,
  obtenerComandasPendientesParaCorteZ,
  obtenerInicioPeriodoActual,
} from '@/lib/caja-helpers'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

/**
 * POST /api/caja/corte-z
 * Corte Z: cierre definitivo del turno/día.
 * Guarda el reporte y "cierra" el periodo (el siguiente Corte X/Z empezará desde ahora).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'caja')
    const tenant = requireActiveTenant(user)

    const rid = tenant.restauranteId

    const comandasPendientes = await obtenerComandasPendientesParaCorteZ(rid)
    if (comandasPendientes.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No se puede realizar Corte Z mientras existan comandas pendientes. Debes pagarlas o cancelarlas con motivo antes de cerrar.',
          data: {
            pendientesCount: comandasPendientes.length,
            pendientes: comandasPendientes.slice(0, 50).map((c) => ({
              id: c.id,
              numeroComanda: c.numeroComanda,
              estado: c.estado,
              mesa: c.mesa,
              fechaCreacion: c.fechaCreacion,
            })),
          },
        },
        { status: 409 }
      )
    }

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

    const corteZ = await prisma.corteZ.create({
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
        accion: 'CORTE_Z',
        entidad: 'CorteZ',
        entidadId: corteZ.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        corteZ: { id: corteZ.id, fechaHora: corteZ.fechaHora },
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
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/caja/corte-z:')
  }
}
