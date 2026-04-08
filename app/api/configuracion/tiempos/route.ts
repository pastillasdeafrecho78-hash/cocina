import { NextRequest, NextResponse } from 'next/server'
import { obtenerConfiguracion, guardarConfiguracion } from '@/lib/configuracion-restaurante'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'

/**
 * GET /api/configuracion/tiempos
 * Obtiene la configuración de tiempos para mesas
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    const tenant = requireActiveTenant(user)

    const config = await obtenerConfiguracion(tenant.restauranteId)

    return NextResponse.json({
      success: true,
      data: {
        tiempoAmarilloMinutos: config?.tiempoAmarilloMinutos || 30,
        tiempoRojoMinutos: config?.tiempoRojoMinutos || 60,
      },
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/configuracion/tiempos:')
  }
}

/**
 * POST /api/configuracion/tiempos
 * Guarda la configuración de tiempos para mesas
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'configuracion')
    const tenant = requireActiveTenant(user)

    const body = await request.json()

    if (!body.tiempoAmarilloMinutos || !body.tiempoRojoMinutos) {
      raise(400, 'Ambos tiempos son requeridos')
    }

    if (body.tiempoRojoMinutos <= body.tiempoAmarilloMinutos) {
      raise(400, 'El tiempo para rojo debe ser mayor que el tiempo para amarillo')
    }

    const config = await guardarConfiguracion(tenant.restauranteId, {
      tiempoAmarilloMinutos: body.tiempoAmarilloMinutos,
      tiempoRojoMinutos: body.tiempoRojoMinutos,
    })

    return NextResponse.json({
      success: true,
      data: {
        tiempoAmarilloMinutos: config.tiempoAmarilloMinutos,
        tiempoRojoMinutos: config.tiempoRojoMinutos,
      },
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/configuracion/tiempos:')
  }
}
