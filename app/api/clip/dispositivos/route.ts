import { NextRequest, NextResponse } from 'next/server'
import { getClipApiKeyStatus } from '@/lib/clip-config'
import { clipDevicesStatus, ClipProviderError } from '@/lib/clip-payclip'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'configuracion')
    const tenant = requireActiveTenant(user)
    const status = await getClipApiKeyStatus(tenant.restauranteId)
    if (!status.ok) {
      const errorByReason: Record<string, string> = {
        INACTIVE: 'Clip está inactivo. Actívalo desde Configuración.',
        MISSING_KEY: 'Falta la API key de Clip. Guárdala en Configuración.',
        DECRYPT_FAILED: 'La API key guardada no se puede leer. Guarda la API key nuevamente.',
      }
      return NextResponse.json(
        { success: false, error: errorByReason[status.reason] || 'Clip no configurado' },
        { status: 400 }
      )
    }
    const data = await clipDevicesStatus(status.apiKey)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof ClipProviderError) {
      return NextResponse.json(
        { success: false, error: error.message || 'Error al consultar dispositivos Clip' },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 }
      )
    }
    return toErrorResponse(error, 'Error al consultar dispositivos Clip', 'Error en GET /api/clip/dispositivos:')
  }
}
