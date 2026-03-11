import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth'
import { tienePermiso } from '@/lib/permisos'
import { z } from 'zod'

const updateItemSchema = z.object({
  estado: z.enum(['PENDIENTE', 'EN_PREPARACION', 'LISTO', 'ENTREGADO']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { estado } = updateItemSchema.parse(body)

    const item = await prisma.comandaItem.findUnique({
      where: { id: params.itemId },
      include: {
        comanda: true,
        producto: true,
      },
    })

    if (!item || item.comandaId !== params.id) {
      return NextResponse.json(
        { success: false, error: 'Item no encontrado' },
        { status: 404 }
      )
    }
    const puede =
      tienePermiso(user, 'comandas') ||
      (item.destino === 'COCINA' && tienePermiso(user, 'cocina')) ||
      (item.destino === 'BARRA' && tienePermiso(user, 'barra'))
    if (!puede) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos' },
        { status: 403 }
      )
    }

    const updateData: any = { estado }

    if (estado === 'EN_PREPARACION' && !item.fechaPreparacion) {
      updateData.fechaPreparacion = new Date()
    }

    if (estado === 'LISTO' && !item.fechaListo) {
      updateData.fechaListo = new Date()
    }

    const updated = await prisma.comandaItem.update({
      where: { id: params.itemId },
      data: updateData,
      include: {
        producto: {
          include: {
            categoria: true,
          },
        },
        modificadores: {
          include: {
            modificador: true,
          },
        },
      },
    })

    // Sincronizar estado de comanda según items
    const comanda = await prisma.comanda.findUnique({
      where: { id: params.id },
      select: { estado: true },
    })
    if (comanda) {
      const itemsPendientes = await prisma.comandaItem.count({
        where: {
          comandaId: params.id,
          estado: { notIn: ['LISTO', 'ENTREGADO'] },
        },
      })
      const itemsEntregados = await prisma.comandaItem.count({
        where: { comandaId: params.id, estado: 'ENTREGADO' },
      })
      const totalItems = await prisma.comandaItem.count({
        where: { comandaId: params.id },
      })

      if (itemsEntregados === totalItems && totalItems > 0) {
        await prisma.comanda.update({
          where: { id: params.id },
          data: { estado: 'SERVIDO' },
        })
      } else if (itemsPendientes === 0 && comanda.estado !== 'SERVIDO' && comanda.estado !== 'PAGADO') {
        await prisma.comanda.update({
          where: { id: params.id },
          data: { estado: 'LISTO' },
        })
      } else if (estado === 'EN_PREPARACION' && comanda.estado === 'PENDIENTE') {
        await prisma.comanda.update({
          where: { id: params.id },
          data: { estado: 'EN_PREPARACION' },
        })
      }
    }

    // Registrar en historial
    await prisma.comandaHistorial.create({
      data: {
        comandaId: params.id,
        accion: 'ITEM_ACTUALIZADO',
        descripcion: `${item.producto.nombre}: ${estado}`,
        usuarioId: user.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error en PATCH /api/comandas/[id]/items/[itemId]:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}








