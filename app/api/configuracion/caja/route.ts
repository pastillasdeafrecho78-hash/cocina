import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardarConfiguracion } from '@/lib/configuracion-restaurante'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/configuracion/caja
 * Actualiza configuración de caja (alerta efectivo mínimo).
 * Requiere permiso caja o configuracion.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['caja', 'configuracion'])
    const tenant = requireActiveTenant(user)

    const body = await request.json()
    const alertaEfectivoMinimo = body.alertaEfectivoMinimo

    if (alertaEfectivoMinimo !== undefined && alertaEfectivoMinimo !== null) {
      const num = Number(alertaEfectivoMinimo)
      if (!Number.isFinite(num) || num < 0) {
        raise(400, 'alertaEfectivoMinimo debe ser un número >= 0')
      }
    }

    await guardarConfiguracion(tenant.restauranteId, {
      alertaEfectivoMinimo:
        alertaEfectivoMinimo === '' || alertaEfectivoMinimo === null || alertaEfectivoMinimo === undefined
          ? null
          : Number(alertaEfectivoMinimo),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en PATCH /api/configuracion/caja:')
  }
}
