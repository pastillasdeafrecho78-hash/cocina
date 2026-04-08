import { NextRequest, NextResponse } from 'next/server'
import { verificarConfiguracionCompleta, obtenerConfiguracion } from '@/lib/configuracion-restaurante'
import { getClipApiKeyStatus } from '@/lib/clip-config'
import { requireActiveTenant, requireAuthenticatedUser } from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

/**
 * GET /api/configuracion/estado
 * Verifica si la configuración está completa
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    const tenant = requireActiveTenant(user)

    const rid = tenant.restauranteId
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
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/configuracion/estado:')
  }
}
