import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDestinoFromCategoria } from '@/lib/comanda-helpers'
import { z } from 'zod'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'
import { registrarEventoItemSeguro } from '@/lib/tiempos/eventos'

const addItemsSchema = z.object({
  items: z.array(
    z.object({
      productoId: z.string(),
      tamanoId: z.string().optional(),
      cantidad: z.number().int().positive(),
      modificadores: z.array(z.string()).optional(),
      notas: z.string().optional(),
    })
  ),
})

/**
 * POST /api/comandas/[id]/items
 * Agrega items a una comanda existente.
 * Solo si la comanda no está PAGADA ni CANCELADA.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'comandas')
    const tenant = requireActiveTenant(user)

    const comanda = await prisma.comanda.findFirst({
      where: { id: params.id, restauranteId: tenant.restauranteId },
      include: { items: true },
    })

    if (!comanda) {
      return NextResponse.json(
        { success: false, error: 'Comanda no encontrada' },
        { status: 404 }
      )
    }

    if (comanda.estado === 'PAGADO' || comanda.estado === 'CANCELADO') {
      return NextResponse.json(
        { success: false, error: 'No se pueden agregar items a una comanda pagada o cancelada' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const data = addItemsSchema.parse(body)

    if (data.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Debe incluir al menos un item' },
        { status: 400 }
      )
    }

    const productos = await prisma.producto.findMany({
      where: {
        id: { in: data.items.map((i) => i.productoId) },
        activo: true,
        categoria: { restauranteId: tenant.restauranteId },
      },
      include: {
        categoria: true,
        tamanos: true,
      },
    })

    const comandaItems: Array<{
      productoId: string
      tamanoId?: string
      cantidad: number
      precioUnitario: number
      subtotal: number
      notas?: string
      destino: 'COCINA' | 'BARRA'
      modificadores: { create: Array<{ modificadorId: string; precioExtra: number }> }
    }> = []
    const rondaActualMax = comanda.items.reduce(
      (max, item: { numeroRonda?: number }) => Math.max(max, item.numeroRonda || 1),
      1
    )
    const numeroRonda = rondaActualMax + 1

    for (const itemData of data.items) {
      const producto = productos.find((p) => p.id === itemData.productoId)
      if (!producto) {
        return NextResponse.json(
          { success: false, error: `Producto ${itemData.productoId} no encontrado` },
          { status: 400 }
        )
      }

      const tieneTamanos = producto.tamanos && producto.tamanos.length > 0

      if (tieneTamanos && !itemData.tamanoId) {
        return NextResponse.json(
          { success: false, error: `El producto "${producto.nombre}" requiere selección de tamaño` },
          { status: 400 }
        )
      }
      if (!tieneTamanos && itemData.tamanoId) {
        return NextResponse.json(
          { success: false, error: `El producto "${producto.nombre}" no tiene tamaños configurados` },
          { status: 400 }
        )
      }

      let precioBase = producto.precio
      let tamanoId: string | undefined
      if (itemData.tamanoId) {
        const tamano = producto.tamanos.find((t) => t.id === itemData.tamanoId)
        if (!tamano) {
          return NextResponse.json(
            { success: false, error: `Tamaño no válido para "${producto.nombre}"` },
            { status: 400 }
          )
        }
        precioBase = tamano.precio
        tamanoId = tamano.id
      }

      let precioModificadores = 0
      const itemModificadores: Array<{ modificadorId: string; precioExtra: number }> = []
      if (itemData.modificadores && itemData.modificadores.length > 0) {
        for (const modificadorId of itemData.modificadores) {
          const modificador = await prisma.modificador.findFirst({
            where: { id: modificadorId, restauranteId: tenant.restauranteId },
          })
          if (modificador && modificador.tipo !== 'TAMANO') {
            precioModificadores += modificador.precioExtra || 0
            itemModificadores.push({
              modificadorId: modificador.id,
              precioExtra: modificador.precioExtra || 0,
            })
          }
        }
      }

      const precioUnitario = precioBase + precioModificadores
      const subtotal = itemData.cantidad * precioUnitario

      comandaItems.push({
        productoId: producto.id,
        tamanoId,
        cantidad: itemData.cantidad,
        precioUnitario,
        subtotal,
        notas: itemData.notas,
        destino: getDestinoFromCategoria(producto.categoria.tipo),
        modificadores: { create: itemModificadores },
      })
    }

    const subtotalNuevos = comandaItems.reduce((sum, i) => sum + i.subtotal, 0)
    const totalAnterior = comanda.total
    const nuevoTotal = totalAnterior + subtotalNuevos

    for (const item of comandaItems) {
      const created = await prisma.comandaItem.create({
        data: {
          comandaId: params.id,
          productoId: item.productoId,
          tamanoId: item.tamanoId,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          subtotal: item.subtotal,
          notas: item.notas,
          numeroRonda,
          destino: item.destino,
          modificadores: {
            create: item.modificadores.create.map((m) => ({
              modificadorId: m.modificadorId,
              precioExtra: m.precioExtra,
            })),
          },
        },
      })
      await registrarEventoItemSeguro({
        restauranteId: tenant.restauranteId,
        comandaId: params.id,
        comandaItemId: created.id,
        productoId: created.productoId,
        usuarioId: user.id,
        tipo: 'ENTRADA',
        estadoNuevo: 'PENDIENTE',
        metadata: { destino: item.destino, numeroRonda },
      })
    }

    await prisma.comanda.update({
      where: { id: params.id },
      data: { total: nuevoTotal },
    })

    await prisma.comandaHistorial.create({
      data: {
        comandaId: params.id,
        accion: 'ITEMS_AGREGADOS',
        descripcion: `${user.nombre} ${user.apellido} agregó ${data.items.length} item(s) en envío ${numeroRonda}. Subtotal agregado: $${subtotalNuevos.toFixed(2)}`,
        usuarioId: user.id,
      },
    })

    const comandaActualizada = await prisma.comanda.findFirst({
      where: { id: params.id, restauranteId: tenant.restauranteId },
      include: {
        items: {
          include: {
            producto: { include: { categoria: true } },
            tamano: true,
            modificadores: { include: { modificador: true } },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: comandaActualizada,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/comandas/[id]/items:')
  }
}
