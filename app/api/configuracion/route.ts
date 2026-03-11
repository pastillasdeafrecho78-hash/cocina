import { NextRequest, NextResponse } from 'next/server'
import { obtenerConfiguracion, guardarConfiguracion } from '@/lib/configuracion-restaurante'
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth'
import { tienePermiso } from '@/lib/permisos'

/**
 * GET /api/configuracion
 * Obtiene la configuración del restaurante
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const config = await obtenerConfiguracion()

    // Solo quien tiene configuracion ve la configuración completa; el resto solo tiempos
    if (!tienePermiso(user, 'configuracion')) {
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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/configuracion
 * Guarda o actualiza la configuración del restaurante
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 401 }
      )
    }

    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }
    if (!tienePermiso(user, 'configuracion')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para configurar' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const config = await guardarConfiguracion({
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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
