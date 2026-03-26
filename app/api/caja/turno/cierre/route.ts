import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { calcularReportePeriodo } from '@/lib/caja-helpers'

export const dynamic = 'force-dynamic'

/**
 * POST /api/caja/turno/cierre
 * Cierra el turno de caja con arqueo (monto contado)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'caja')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const fondoCierre = Number(body.fondoCierre)

    if (!Number.isFinite(fondoCierre) || fondoCierre < 0) {
      return NextResponse.json(
        { success: false, error: 'fondoCierre debe ser un número >= 0' },
        { status: 400 }
      )
    }

    const turno = await prisma.turnoCaja.findFirst({
      where: { restauranteId: user.restauranteId, fechaCierre: null },
      orderBy: { fechaApertura: 'desc' },
    })
    if (!turno) {
      return NextResponse.json(
        { success: false, error: 'No hay turno abierto para cerrar' },
        { status: 400 }
      )
    }

    const { totalEfectivo } = await calcularReportePeriodo(
      turno.fechaApertura,
      new Date(),
      user.restauranteId
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
        restauranteId: user.restauranteId,
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
    console.error('Error en POST /api/caja/turno/cierre:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
