import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { getClipApiKey } from '@/lib/clip-config'
import { clipDevicesStatus } from '@/lib/clip-payclip'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || !tienePermiso(user, 'caja')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }
    const apiKey = await getClipApiKey(user.restauranteId)
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Clip no configurado' }, { status: 400 })
    }
    const data = await clipDevicesStatus(apiKey)
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json(
      { success: false, error: e?.message || 'Error al consultar dispositivos Clip' },
      { status: 502 }
    )
  }
}
