import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'

/** POST: Marca todos los items en estado LISTO como ENTREGADO (confirmación de recogida por mesero). */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'comandas')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const comanda = await prisma.comanda.findFirst({
      where: { id: params.id, restauranteId: user.restauranteId },
      include: {
        items: {
          where: { estado: 'LISTO' },
          include: { producto: { select: { nombre: true } } },
        },
      },
    })

    if (!comanda) {
      return NextResponse.json({ success: false, error: 'Comanda no encontrada' }, { status: 404 })
    }

    const itemsListos = comanda.items
    if (itemsListos.length === 0) {
      return NextResponse.json({
        success: true,
        data: { actualizados: 0, mensaje: 'No hay items listos para entregar' },
      })
    }

    await prisma.comandaItem.updateMany({
      where: {
        comandaId: params.id,
        estado: 'LISTO',
      },
      data: { estado: 'ENTREGADO' },
    })

    for (const item of itemsListos) {
      await prisma.comandaHistorial.create({
        data: {
          comandaId: params.id,
          accion: 'ITEM_ACTUALIZADO',
          descripcion: `${item.producto.nombre}: ENTREGADO (recogido por mesero)`,
          usuarioId: user.id,
        },
      })
    }

    const todosEntregados = await prisma.comandaItem.count({
      where: {
        comandaId: params.id,
        estado: { not: 'ENTREGADO' },
      },
    })
    if (todosEntregados === 0) {
      await prisma.comanda.update({
        where: { id: params.id },
        data: { estado: 'SERVIDO' },
      })
    }

    return NextResponse.json({
      success: true,
      data: { actualizados: itemsListos.length },
    })
  } catch (error) {
    console.error('Error en POST /api/comandas/[id]/entregar:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
