import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { getDestinoFromCategoria } from '@/lib/comanda-helpers'
import { z } from 'zod'

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
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }
    if (!tienePermiso(user, 'comandas')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos' },
        { status: 403 }
      )
    }

    const comanda = await prisma.comanda.findFirst({
      where: { id: params.id, restauranteId: user.restauranteId },
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
        categoria: { restauranteId: user.restauranteId },
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
            where: { id: modificadorId, restauranteId: user.restauranteId },
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
      await prisma.comandaItem.create({
        data: {
          comandaId: params.id,
          productoId: item.productoId,
          tamanoId: item.tamanoId,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          subtotal: item.subtotal,
          notas: item.notas,
          destino: item.destino,
          modificadores: {
            create: item.modificadores.create.map((m) => ({
              modificadorId: m.modificadorId,
              precioExtra: m.precioExtra,
            })),
          },
        },
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
        descripcion: `${user.nombre} ${user.apellido} agregó ${data.items.length} item(s). Subtotal agregado: $${subtotalNuevos.toFixed(2)}`,
        usuarioId: user.id,
      },
    })

    const comandaActualizada = await prisma.comanda.findFirst({
      where: { id: params.id, restauranteId: user.restauranteId },
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error en POST /api/comandas/[id]/items:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
