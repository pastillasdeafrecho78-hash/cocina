import { NextResponse } from 'next/server'
import {
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'
import { getRolloutStatus } from '@/lib/rollout/status'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['settings.view', 'settings.manage', 'configuracion'])

    const data = await getRolloutStatus()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en GET /api/configuracion/rollout:'
    )
  }
}
