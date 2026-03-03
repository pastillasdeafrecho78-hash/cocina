import { NextRequest, NextResponse } from 'next/server'
import { obtenerConfiguracion, guardarConfiguracion } from '@/lib/configuracion-restaurante'
import { verifyToken, isAdmin } from '@/lib/auth'

/**
 * GET /api/configuracion
 * Obtiene la configuración del restaurante
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 401 }
      )
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    const config = await obtenerConfiguracion()

    // Solo admin ve la configuración completa; el resto solo tiempos
    if (!isAdmin(payload.rol)) {
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

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    if (!isAdmin(payload.rol)) {
      return NextResponse.json(
        { success: false, error: 'Solo el administrador puede configurar' },
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
      configuradoPorId: payload.userId,
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
