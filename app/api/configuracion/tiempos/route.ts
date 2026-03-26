import { NextRequest, NextResponse } from 'next/server'
import { obtenerConfiguracion, guardarConfiguracion } from '@/lib/configuracion-restaurante'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'

/**
 * GET /api/configuracion/tiempos
 * Obtiene la configuración de tiempos para mesas
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const config = await obtenerConfiguracion(user.restauranteId)

    return NextResponse.json({
      success: true,
      data: {
        tiempoAmarilloMinutos: config?.tiempoAmarilloMinutos || 30,
        tiempoRojoMinutos: config?.tiempoRojoMinutos || 60,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/configuracion/tiempos
 * Guarda la configuración de tiempos para mesas
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || !user.activo) {
      return NextResponse.json(
        { success: false, error: 'Token inválido o usuario no válido' },
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

    if (!body.tiempoAmarilloMinutos || !body.tiempoRojoMinutos) {
      return NextResponse.json(
        { success: false, error: 'Ambos tiempos son requeridos' },
        { status: 400 }
      )
    }

    if (body.tiempoRojoMinutos <= body.tiempoAmarilloMinutos) {
      return NextResponse.json(
        { success: false, error: 'El tiempo para rojo debe ser mayor que el tiempo para amarillo' },
        { status: 400 }
      )
    }

    const config = await guardarConfiguracion(user.restauranteId, {
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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
