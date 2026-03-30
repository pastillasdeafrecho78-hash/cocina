import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'

export const dynamic = 'force-dynamic'

function isMissingIsDefaultColumnError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2022'
  )
}

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
    })
    if (!t) {
      return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 })
    }
    try {
      await prisma.clipTerminal.update({
        where: { id: t.id },
        data: { activo: false, isDefault: false },
      })
      if (t.isDefault) {
        const fallback = await prisma.clipTerminal.findFirst({
          where: { restauranteId: user.restauranteId, activo: true, id: { not: t.id } },
          orderBy: { createdAt: 'asc' },
        })
        if (fallback) {
          await prisma.clipTerminal.update({
            where: { id: fallback.id },
            data: { isDefault: true },
          })
        }
      }
    } catch (error) {
      if (!isMissingIsDefaultColumnError(error)) throw error
      await prisma.clipTerminal.update({
        where: { id: t.id },
        data: { activo: false },
      })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}
