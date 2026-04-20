import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'comandas')
    const tenant = requireActiveTenant(user)

    const estadoParam = (request.nextUrl.searchParams.get('estado') || 'PENDIENTE').toUpperCase()
    const estadosValidos = new Set(['PENDIENTE', 'EN_COLA', 'APROBADA', 'RECHAZADA', 'EXPIRADA', 'TODAS'])
    if (!estadosValidos.has(estadoParam)) {
      return NextResponse.json({ success: false, error: 'Estado inválido' }, { status: 400 })
    }
    const estadoFilter = estadoParam === 'TODAS' ? undefined : estadoParam

    const orderBy: Prisma.SolicitudPedidoOrderByWithRelationInput[] =
      estadoFilter === 'EN_COLA'
        ? [{ prioridadColaAt: 'asc' }, { createdAt: 'asc' }]
        : estadoFilter === 'PENDIENTE'
          ? [{ createdAt: 'asc' }]
          : [{ createdAt: 'desc' }]

    const solicitudes = await prisma.solicitudPedido.findMany({
      where: {
        restauranteId: tenant.restauranteId,
        ...(estadoFilter
          ? {
              estado: estadoFilter as
                | 'PENDIENTE'
                | 'EN_COLA'
                | 'APROBADA'
                | 'RECHAZADA'
                | 'EXPIRADA',
            }
          : {}),
      },
      include: {
        mesa: {
          select: { id: true, numero: true },
        },
        items: {
          include: {
            producto: {
              select: { id: true, nombre: true },
            },
            tamano: {
              select: { id: true, nombre: true },
            },
            modificadores: {
              include: {
                modificador: {
                  select: { id: true, nombre: true },
                },
              },
            },
          },
        },
        approvedComanda: {
          select: { id: true, numeroComanda: true, estado: true },
        },
        reviewedBy: {
          select: { id: true, nombre: true, apellido: true },
        },
      },
      orderBy,
      take: 200,
    })

    return NextResponse.json({ success: true, data: solicitudes })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/solicitudes:')
  }
}
