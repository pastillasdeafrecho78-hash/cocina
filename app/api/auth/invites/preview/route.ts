import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')?.trim() ?? ''
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token requerido' }, { status: 400 })
    }
    const tokenHash = hashToken(token)
    const invite = await prisma.invitacion.findUnique({
      where: { tokenHash },
      select: {
        email: true,
        expiraEn: true,
        usadaEn: true,
        rol: { select: { id: true, nombre: true } },
        restaurante: {
          select: {
            id: true,
            nombre: true,
            slug: true,
            organizacion: {
              select: { id: true, nombre: true },
            },
          },
        },
      },
    })
    if (!invite) {
      return NextResponse.json(
        { success: false, error: 'Invitación inválida o no encontrada' },
        { status: 404 }
      )
    }
    const expirada = invite.expiraEn.getTime() < Date.now()
    return NextResponse.json({
      success: true,
      data: {
        email: invite.email,
        expiraEn: invite.expiraEn,
        usadaEn: invite.usadaEn,
        expirada,
        rol: invite.rol,
        restaurante: invite.restaurante,
      },
    })
  } catch (error) {
    console.error('Error en /api/auth/invites/preview:', error)
    return NextResponse.json(
      { success: false, error: 'Error al consultar invitación' },
      { status: 500 }
    )
  }
}
