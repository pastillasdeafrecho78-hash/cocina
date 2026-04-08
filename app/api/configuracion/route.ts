import { NextRequest, NextResponse } from 'next/server'
import { obtenerConfiguracion, guardarConfiguracion } from '@/lib/configuracion-restaurante'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

/**
 * GET /api/configuracion
 * Obtiene la configuración del restaurante
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    const tenant = requireActiveTenant(user)

    const config = await obtenerConfiguracion(tenant.restauranteId)

    // Solo quien tiene configuracion ve la configuración completa; el resto solo tiempos
    try {
      requireCapability(user, 'configuracion')
    } catch {
      return NextResponse.json({
        success: true,
        data: {
          tiempoAmarilloMinutos: config?.tiempoAmarilloMinutos || 30,
          tiempoRojoMinutos: config?.tiempoRojoMinutos || 60,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: config,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/configuracion:')
  }
}

/**
 * POST /api/configuracion
 * Guarda o actualiza la configuración del restaurante
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'configuracion')
    const tenant = requireActiveTenant(user)

    const body = await request.json()

    const config = await guardarConfiguracion(tenant.restauranteId, {
      datosFiscales: body.datosFiscales,
      lugarExpedicion: body.lugarExpedicion,
      configuracionComprobante: body.configuracionComprobante,
      configuracionFiscal: body.configuracionFiscal,
      pac: body.pac,
      conekta: body.conekta,
      csd: body.csd,
      facturaGlobal: body.facturaGlobal,
      webhookSecretConekta: body.webhookSecretConekta,
      webhookUrl: body.webhookUrl,
      configuradoPorId: user.id,
      tiempoAmarilloMinutos: body.tiempos?.tiempoAmarilloMinutos,
      tiempoRojoMinutos: body.tiempos?.tiempoRojoMinutos,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        configuracionCompleta: config.configuracionCompleta,
      },
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/configuracion:')
  }
}
