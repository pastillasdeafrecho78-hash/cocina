import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { calcularReportePeriodo } from '@/lib/caja-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/caja/turno
 * Obtiene el turno de caja actual (abierto o el último cerrado)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'caja') && !tienePermiso(user, 'comandas')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const rid = user.restauranteId

    const [turnoAbierto, ultimoCerrado, config] = await Promise.all([
      prisma.turnoCaja.findFirst({
        where: { restauranteId: rid, fechaCierre: null },
        orderBy: { fechaApertura: 'desc' },
      }),
      prisma.turnoCaja.findFirst({
        where: { restauranteId: rid, fechaCierre: { not: null } },
        orderBy: { fechaCierre: 'desc' },
      }),
      prisma.configuracionRestaurante.findUnique({
        where: { restauranteId: rid },
        select: { alertaEfectivoMinimo: true },
      }),
    ])

    const turno = turnoAbierto ?? ultimoCerrado

    if (!turno) {
      return NextResponse.json({
        success: true,
        data: {
          id: null,
          fechaApertura: null,
          fechaCierre: null,
          fondoInicial: 0,
          fondoCierre: null,
          efectivoEsperado: 0,
          abierto: false,
          alertaEfectivoMinimo: config?.alertaEfectivoMinimo ?? null,
        },
      })
    }

    let efectivoEsperado = 0
    if (turno.fechaCierre == null) {
      const { totalEfectivo } = await calcularReportePeriodo(
        turno.fechaApertura,
        new Date(),
        rid
      )
      efectivoEsperado = turno.fondoInicial + totalEfectivo
    }

    return NextResponse.json({
      success: true,
      data: {
        id: turno.id,
        fechaApertura: turno.fechaApertura.toISOString(),
        fechaCierre: turno.fechaCierre?.toISOString() ?? null,
        fondoInicial: turno.fondoInicial,
        fondoCierre: turno.fondoCierre,
        efectivoEsperado,
        abierto: turno.fechaCierre == null,
        alertaEfectivoMinimo: config?.alertaEfectivoMinimo ?? null,
      },
    })
  } catch (error) {
    console.error('Error en GET /api/caja/turno:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
