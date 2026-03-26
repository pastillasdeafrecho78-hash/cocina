import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { guardarConfiguracion } from '@/lib/configuracion-restaurante'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/configuracion/caja
 * Actualiza configuración de caja (alerta efectivo mínimo).
 * Requiere permiso caja o configuracion.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'caja') && !tienePermiso(user, 'configuracion')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const alertaEfectivoMinimo = body.alertaEfectivoMinimo

    if (alertaEfectivoMinimo !== undefined && alertaEfectivoMinimo !== null) {
      const num = Number(alertaEfectivoMinimo)
      if (!Number.isFinite(num) || num < 0) {
        return NextResponse.json(
          { success: false, error: 'alertaEfectivoMinimo debe ser un número >= 0' },
          { status: 400 }
        )
      }
    }

    await guardarConfiguracion(user.restauranteId, {
      alertaEfectivoMinimo:
        alertaEfectivoMinimo === '' || alertaEfectivoMinimo === null || alertaEfectivoMinimo === undefined
          ? null
          : Number(alertaEfectivoMinimo),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error en PATCH /api/configuracion/caja:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
