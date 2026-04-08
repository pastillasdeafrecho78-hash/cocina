import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deactivateClipTerminal } from '@/lib/clip-terminal-compat'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'configuracion')
    const tenant = requireActiveTenant(user)
    const t = await prisma.clipTerminal.findFirst({
      where: { id: params.id, restauranteId: tenant.restauranteId },
      select: { id: true },
    })
    if (!t) {
      return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 })
    }
    await deactivateClipTerminal(prisma, t.id, tenant.restauranteId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return toErrorResponse(error, 'Error interno', 'Error en DELETE /api/clip/terminales/[id]:')
  }
}
