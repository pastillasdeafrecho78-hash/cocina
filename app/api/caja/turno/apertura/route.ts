import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth'
import { tienePermiso } from '@/lib/permisos'

export const dynamic = 'force-dynamic'

/**
 * POST /api/caja/turno/apertura
 * Abre un nuevo turno de caja con fondo inicial
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'caja')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const fondoInicial = Number(body.fondoInicial)

    if (!Number.isFinite(fondoInicial) || fondoInicial < 0) {
      return NextResponse.json(
        { success: false, error: 'fondoInicial debe ser un número >= 0' },
        { status: 400 }
      )
    }

    const turnoAbierto = await prisma.turnoCaja.findFirst({
      where: { restauranteId: user.restauranteId, fechaCierre: null },
    })
    if (turnoAbierto) {
      return NextResponse.json(
        { success: false, error: 'Ya hay un turno abierto. Ciérralo antes de abrir uno nuevo.' },
        { status: 400 }
      )
    }

    const turno = await prisma.turnoCaja.create({
      data: {
        restauranteId: user.restauranteId,
        usuarioId: user.id,
        fondoInicial,
      },
    })

    await prisma.auditoria.create({
      data: {
        restauranteId: user.restauranteId,
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
    console.error('Error en POST /api/caja/turno/apertura:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
