import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'
import { tienePermiso } from '@/lib/permisos'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Verificar rol
    if (!tienePermiso(user, 'barra')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos' },
        { status: 403 }
      )
    }

    const items = await prisma.comandaItem.findMany({
      where: {
        destino: 'BARRA',
        estado: {
          in: ['PENDIENTE', 'EN_PREPARACION', 'LISTO'],
        },
        comanda: { restauranteId: user.restauranteId },
      },
      include: {
        producto: {
          include: {
            categoria: true,
          },
        },
        comanda: {
          include: {
            mesa: true,
            cliente: true,
          },
        },
        tamano: true,
        modificadores: {
          include: {
            modificador: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'asc' },
        { estado: 'asc' },
      ],
    })

    return NextResponse.json({
      success: true,
      data: items,
    })
  } catch (error) {
    console.error('Error en GET /api/comandas/barra:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}








