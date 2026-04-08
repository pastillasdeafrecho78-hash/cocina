import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

export const dynamic = 'force-dynamic'

/**
 * GET /api/dashboard/estadisticas
 * Respuesta ligera: solo conteos. Evita cargar comandas/items completos.
 * Requiere al menos uno de: mesas, comandas, cocina, barra, reportes.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['mesas', 'comandas', 'cocina', 'barra', 'reportes'])
    const tenant = requireActiveTenant(user)

    const rid = tenant.restauranteId
    const [mesasTotal, mesasOcupadas, comandasActivas, itemsCocina, itemsBarra] = await Promise.all([
      prisma.mesa.count({ where: { activa: true, restauranteId: rid } }),
      prisma.mesa.count({ where: { activa: true, estado: 'OCUPADA', restauranteId: rid } }),
      prisma.comanda.count({
        where: {
          restauranteId: rid,
          estado: { in: ['PENDIENTE', 'EN_PREPARACION', 'LISTO'] },
        },
      }),
      prisma.comandaItem.count({
        where: {
          destino: 'COCINA',
          estado: { in: ['PENDIENTE', 'EN_PREPARACION'] },
          comanda: { restauranteId: rid },
        },
      }),
      prisma.comandaItem.count({
        where: {
          destino: 'BARRA',
          estado: { in: ['PENDIENTE', 'EN_PREPARACION'] },
          comanda: { restauranteId: rid },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        mesasTotal,
        mesasOcupadas,
        comandasActivas,
        itemsCocina,
        itemsBarra,
      },
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/dashboard/estadisticas:')
  }
}
