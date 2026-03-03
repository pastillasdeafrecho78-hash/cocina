import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Verificar rol
    if (!['COCINERO', 'ADMIN', 'GERENTE'].includes(user.rol)) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos' },
        { status: 403 }
      )
    }

    const items = await prisma.comandaItem.findMany({
      where: {
        destino: 'COCINA',
        estado: {
          in: ['PENDIENTE', 'EN_PREPARACION'],
        },
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
        modificadores: {
          include: {
            modificador: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'asc' }, // Más antiguos primero
        { estado: 'asc' }, // Pendientes antes que en preparación
      ],
    })

    return NextResponse.json({
      success: true,
      data: items,
    })
  } catch (error) {
    console.error('Error en GET /api/comandas/cocina:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}








