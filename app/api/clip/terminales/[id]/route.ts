import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { deactivateClipTerminal } from '@/lib/clip-terminal-compat'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser()
    if (!user || !tienePermiso(user, 'configuracion')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }
    const t = await prisma.clipTerminal.findFirst({
      where: { id: params.id, restauranteId: user.restauranteId },
      select: { id: true },
    })
    if (!t) {
      return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 })
    }
    await deactivateClipTerminal(prisma, t.id, user.restauranteId)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}
