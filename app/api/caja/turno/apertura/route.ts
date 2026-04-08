import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'

export const dynamic = 'force-dynamic'

/**
 * POST /api/caja/turno/apertura
 * Abre un nuevo turno de caja con fondo inicial
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'caja')
    const tenant = requireActiveTenant(user)

    const body = await request.json()
    const fondoInicial = Number(body.fondoInicial)

    if (!Number.isFinite(fondoInicial) || fondoInicial < 0) {
      raise(400, 'fondoInicial debe ser un número >= 0')
    }

    const turnoAbierto = await prisma.turnoCaja.findFirst({
      where: { restauranteId: tenant.restauranteId, fechaCierre: null },
    })
    if (turnoAbierto) {
      raise(400, 'Ya hay un turno abierto. Ciérralo antes de abrir uno nuevo.')
    }

    const turno = await prisma.turnoCaja.create({
      data: {
        restauranteId: tenant.restauranteId,
        usuarioId: user.id,
        fondoInicial,
      },
    })

    await prisma.auditoria.create({
      data: {
        restauranteId: tenant.restauranteId,
        usuarioId: user.id,
        accion: 'TURNO_APERTURA',
        entidad: 'TurnoCaja',
        entidadId: turno.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: turno.id,
        fechaApertura: turno.fechaApertura.toISOString(),
        fondoInicial: turno.fondoInicial,
      },
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/caja/turno/apertura:')
  }
}
