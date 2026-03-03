import { NextRequest, NextResponse } from 'next/server'
import { obtenerConfiguracion, guardarConfiguracion } from '@/lib/configuracion-restaurante'
import { verifyToken, getUserFromToken, isAdmin } from '@/lib/auth'

/**
 * GET /api/configuracion/tiempos
 * Obtiene la configuración de tiempos para mesas
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
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 401 }
      )
    }

    const user = await getUserFromToken(token)
    if (!user || !user.activo) {
      return NextResponse.json(
        { success: false, error: 'Token inválido o usuario no válido' },
        { status: 401 }
      )
    }
    if (!isAdmin(user.rol)) {
      return NextResponse.json(
        { success: false, error: 'Solo el administrador puede configurar' },
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

    const config = await guardarConfiguracion({
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
