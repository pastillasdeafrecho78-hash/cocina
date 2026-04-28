import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'

export const dynamic = 'force-dynamic'

const prismaKds = prisma as any

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['kitchen.view', 'bar.view', 'cocina', 'barra'])
    const tenant = requireActiveTenant(user)

    const seccion = await prismaKds.kdsSeccion.findFirst({
      where: {
        id: params.id,
        restauranteId: tenant.restauranteId,
        activa: true,
      },
      select: {
        id: true,
        tipoLegacy: true,
      },
    })

    if (!seccion) {
      raise(404, 'Sección KDS no encontrada')
    }

    const legacyDestino =
      seccion.tipoLegacy === 'COCINA' || seccion.tipoLegacy === 'BARRA'
        ? seccion.tipoLegacy
        : null

    const items = await prismaKds.comandaItem.findMany({
      where: {
        estado: {
          in: ['PENDIENTE', 'EN_PREPARACION', 'LISTO'],
        },
        comanda: { restauranteId: tenant.restauranteId },
        OR: [
          { producto: { kdsSeccionId: seccion.id } },
          ...(legacyDestino ? [{ destino: legacyDestino }] : []),
        ],
      },
      include: {
        producto: {
          include: {
            categoria: true,
            kdsSeccion: true,
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
      orderBy: [{ createdAt: 'asc' }, { estado: 'asc' }],
    })

    return NextResponse.json({
      success: true,
      data: items,
    })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en GET /api/kds/secciones/[id]/items:'
    )
  }
}
