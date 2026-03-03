import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth'

/**
 * GET /api/dashboard/estadisticas
 * Respuesta ligera: solo conteos. Evita cargar comandas/items completos.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const [mesasTotal, mesasOcupadas, comandasActivas, itemsCocina, itemsBarra] = await Promise.all([
      prisma.mesa.count({ where: { activa: true } }),
      prisma.mesa.count({ where: { activa: true, estado: 'OCUPADA' } }),
      prisma.comanda.count({
        where: { estado: { in: ['PENDIENTE', 'EN_PREPARACION', 'LISTO'] } },
      }),
      prisma.comandaItem.count({
        where: {
          destino: 'COCINA',
          estado: { in: ['PENDIENTE', 'EN_PREPARACION'] },
        },
      }),
      prisma.comandaItem.count({
        where: {
          destino: 'BARRA',
          estado: { in: ['PENDIENTE', 'EN_PREPARACION'] },
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
    console.error('Error en GET /api/dashboard/estadisticas:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
