import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { getClipApiKeyStatus } from '@/lib/clip-config'
import { clipDevicesStatus, ClipProviderError } from '@/lib/clip-payclip'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || !tienePermiso(user, 'configuracion')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }
    const status = await getClipApiKeyStatus(user.restauranteId)
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
  } catch (e: any) {
    console.error(e)
    if (e instanceof ClipProviderError) {
      return NextResponse.json(
        { success: false, error: e.message || 'Error al consultar dispositivos Clip' },
        { status: e.status >= 400 && e.status < 600 ? e.status : 502 }
      )
    }
    return NextResponse.json(
      { success: false, error: e?.message || 'Error al consultar dispositivos Clip' },
      { status: 502 }
    )
  }
}
