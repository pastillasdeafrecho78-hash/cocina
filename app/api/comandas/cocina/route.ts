import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveTenant, requireAuthenticatedUser, requireCapability } from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'cocina')
    const tenant = requireActiveTenant(user)

    const items = await prisma.comandaItem.findMany({
      where: {
        destino: 'COCINA',
        estado: {
          in: ['PENDIENTE', 'EN_PREPARACION', 'LISTO'],
        },
        comanda: { restauranteId: tenant.restauranteId },
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
            asignadoA: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
              },
            },
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
        { createdAt: 'asc' }, // Más antiguos primero
        { estado: 'asc' }, // Pendientes antes que en preparación
      ],
    })

    return NextResponse.json({
      success: true,
      data: items,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/comandas/cocina:')
  }
}








