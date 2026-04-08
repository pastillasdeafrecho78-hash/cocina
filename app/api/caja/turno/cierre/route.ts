import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calcularReportePeriodo } from '@/lib/caja-helpers'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'

export const dynamic = 'force-dynamic'

/**
 * POST /api/caja/turno/cierre
 * Cierra el turno de caja con arqueo (monto contado)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'caja')
    const tenant = requireActiveTenant(user)

    const body = await request.json()
    const fondoCierre = Number(body.fondoCierre)

    if (!Number.isFinite(fondoCierre) || fondoCierre < 0) {
      raise(400, 'fondoCierre debe ser un número >= 0')
    }

    const turno = await prisma.turnoCaja.findFirst({
      where: { restauranteId: tenant.restauranteId, fechaCierre: null },
      orderBy: { fechaApertura: 'desc' },
    })
    if (!turno) {
      raise(400, 'No hay turno abierto para cerrar')
    }

    const { totalEfectivo } = await calcularReportePeriodo(
      turno.fechaApertura,
      new Date(),
      tenant.restauranteId
    )
    const efectivoEsperado = turno.fondoInicial + totalEfectivo
    const diferencia = fondoCierre - efectivoEsperado

    const turnoActualizado = await prisma.turnoCaja.update({
      where: { id: turno.id },
      data: {
        fechaCierre: new Date(),
        fondoCierre,
      },
    })

    await prisma.auditoria.create({
      data: {
        restauranteId: tenant.restauranteId,
        usuarioId: user.id,
        accion: 'TURNO_CIERRE',
        entidad: 'TurnoCaja',
        entidadId: turno.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: turnoActualizado.id,
        fechaCierre: turnoActualizado.fechaCierre?.toISOString(),
        fondoCierre: turnoActualizado.fondoCierre,
        efectivoEsperado,
        diferencia,
      },
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/caja/turno/cierre:')
  }
}
