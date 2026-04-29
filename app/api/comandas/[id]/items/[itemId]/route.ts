import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'
import type { SessionUser } from '@/lib/auth-server'
import { registrarEventoItemSeguro, tipoEventoParaEstado } from '@/lib/tiempos/eventos'

const updateItemSchema = z.object({
  estado: z.enum(['PENDIENTE', 'EN_PREPARACION', 'LISTO', 'ENTREGADO']),
})

function requireItemCapability(destino: string, user: SessionUser) {
  if (destino === 'COCINA') {
    requireAnyCapability(user, ['comandas', 'cocina'])
    return
  }
  if (destino === 'BARRA') {
    requireAnyCapability(user, ['comandas', 'barra'])
    return
  }
  requireCapability(user, 'comandas')
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['comandas', 'cocina', 'barra'])
    const tenant = requireActiveTenant(user)

    const body = await request.json()
    const { estado } = updateItemSchema.parse(body)

    const item = await prisma.comandaItem.findFirst({
      where: {
        id: params.itemId,
        comandaId: params.id,
        comanda: { restauranteId: tenant.restauranteId },
      },
      include: {
        comanda: true,
        producto: true,
      },
    })

    if (!item) {
      raise(404, 'Item no encontrado')
    }
    requireItemCapability(item.destino, user)

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

    await registrarEventoItemSeguro({
      restauranteId: tenant.restauranteId,
      comandaId: params.id,
      comandaItemId: item.id,
      productoId: item.productoId,
      kdsSeccionId: (item.producto as any).kdsSeccionId ?? null,
      usuarioId: user.id,
      tipo: tipoEventoParaEstado(estado),
      estadoPrevio: item.estado,
      estadoNuevo: estado,
      metadata: { destino: item.destino },
    })

    // Sincronizar estado de comanda según items
    const comanda = await prisma.comanda.findFirst({
      where: { id: params.id, restauranteId: tenant.restauranteId },
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
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en PATCH /api/comandas/[id]/items/[itemId]:'
    )
  }
}






