import { NextRequest, NextResponse } from 'next/server'
import { verificarConfiguracionCompleta, obtenerConfiguracion } from '@/lib/configuracion-restaurante'
import { verifyToken } from '@/lib/auth'

/**
 * GET /api/configuracion/estado
 * Verifica si la configuración está completa
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

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    const config = await obtenerConfiguracion()
    const completa = await verificarConfiguracionCompleta()

    return NextResponse.json({
      success: true,
      data: {
        configuracionCompleta: completa,
        tieneDatosFiscales: !!config?.rfc,
        tienePAC: !!config?.pacApiKey,
        tieneConekta: !!config?.conektaPrivateKey,
        tieneCSD: !!config?.csdCerPath,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
