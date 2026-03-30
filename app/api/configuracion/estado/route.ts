import { NextRequest, NextResponse } from 'next/server'
import { verificarConfiguracionCompleta, obtenerConfiguracion } from '@/lib/configuracion-restaurante'
import { getSessionUser } from '@/lib/auth-server'
import { getClipApiKeyStatus } from '@/lib/clip-config'

/**
 * GET /api/configuracion/estado
 * Verifica si la configuración está completa
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    const rid = user.restauranteId
    const config = await obtenerConfiguracion(rid)
    const completa = await verificarConfiguracionCompleta(rid)
    const clipStatus = await getClipApiKeyStatus(rid)

    return NextResponse.json({
      success: true,
      data: {
        configuracionCompleta: completa,
        tieneDatosFiscales: !!config?.rfc,
        tienePAC: !!config?.pacApiKey,
        tieneConekta: !!config?.conektaPrivateKey,
        tieneCSD: !!config?.csdCerPath,
        clipListo: clipStatus.ok,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
