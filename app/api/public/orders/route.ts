import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { calcularTotal, generarNumeroComanda, getDestinoFromCategoria } from '@/lib/comanda-helpers'
import { createPublicTrackingToken } from '@/lib/public-ordering'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  slug: z.string().min(1).max(64),
  tipoPedido: z.enum(['PARA_LLEVAR', 'A_DOMICILIO', 'WHATSAPP']).default('PARA_LLEVAR'),
  metodoPago: z.enum(['tarjeta', 'efectivo']).default('efectivo'),
  cliente: z.object({
    nombre: z.string().min(1).max(120),
    telefono: z.string().max(40).optional().nullable(),
    direccion: z.string().max(220).optional().nullable(),
    notas: z.string().max(240).optional().nullable(),
  }),
  items: z
    .array(
      z.object({
        productoId: z.string().min(1),
        tamanoId: z.string().optional(),
        cantidad: z.number().int().positive(),
        notas: z.string().max(240).optional(),
        modificadores: z.array(z.string()).optional(),
      })
    )
    .min(1)
    .max(50),
  observaciones: z.string().max(320).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = bodySchema.parse(body)
    const slug = data.slug.trim().toLowerCase()

    const restaurante = await prisma.restaurante.findFirst({
      where: { slug, activo: true },
      select: { id: true },
    })
    if (!restaurante) {
      return NextResponse.json({ success: false, error: 'Sucursal no encontrada' }, { status: 404 })
    }

    const rid = restaurante.id
    const fallbackUser = await prisma.usuario.findFirst({
      where: { restauranteId: rid, activo: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!fallbackUser) {
      return NextResponse.json(
        { success: false, error: 'Sucursal sin usuarios operativos' },
        { status: 409 }
      )
    }

    const productos = await prisma.producto.findMany({
      where: {
        id: { in: data.items.map((item) => item.productoId) },
        activo: true,
        categoria: { restauranteId: rid, activa: true },
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
      numeroRonda: number
      modificadores: { create: Array<{ modificadorId: string; precioExtra: number }> }
    }> = []
    for (const itemData of data.items) {
      const producto = productos.find((p) => p.id === itemData.productoId)
      if (!producto) {
        return NextResponse.json(
          { success: false, error: `Producto no disponible: ${itemData.productoId}` },
          { status: 400 }
        )
      }

      const tieneTamanos = producto.tamanos.length > 0
      if (tieneTamanos && !itemData.tamanoId) {
        return NextResponse.json(
          { success: false, error: `El producto "${producto.nombre}" requiere tamaño` },
          { status: 400 }
        )
      }
      if (!tieneTamanos && itemData.tamanoId) {
        return NextResponse.json(
          { success: false, error: `El producto "${producto.nombre}" no maneja tamaños` },
          { status: 400 }
        )
      }

      let precioBase = producto.precio
      let tamanoId: string | undefined
      if (itemData.tamanoId) {
        const tamano = producto.tamanos.find((t) => t.id === itemData.tamanoId)
        if (!tamano) {
          return NextResponse.json(
            { success: false, error: `Tamaño inválido para ${producto.nombre}` },
            { status: 400 }
          )
        }
        precioBase = tamano.precio
        tamanoId = tamano.id
      }

      let precioModificadores = 0
      const itemModificadores = []
      if (itemData.modificadores?.length) {
        const mods = await prisma.modificador.findMany({
          where: { id: { in: itemData.modificadores }, restauranteId: rid, activo: true },
        })
        for (const mod of mods) {
          if (mod.tipo === 'TAMANO') continue
          const extra = mod.precioExtra ?? 0
          precioModificadores += extra
          itemModificadores.push({
            modificadorId: mod.id,
            precioExtra: extra,
          })
        }
      }

      const precioUnitario = precioBase + precioModificadores
      comandaItems.push({
        productoId: producto.id,
        tamanoId,
        cantidad: itemData.cantidad,
        precioUnitario,
        subtotal: itemData.cantidad * precioUnitario,
        notas: itemData.notas,
        destino: getDestinoFromCategoria(producto.categoria.tipo),
        numeroRonda: 1,
        modificadores: {
          create: itemModificadores,
        },
      })
    }

    const total = calcularTotal(
      comandaItems.map((item) => ({
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        precioModificadores: 0,
      }))
    )

    const numeroComanda = await generarNumeroComanda(rid)
    const token = createPublicTrackingToken()

    const result = await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.create({
        data: {
          restauranteId: rid,
          nombre: data.cliente.nombre.trim(),
          telefono: data.cliente.telefono?.trim() || null,
          direccion: data.cliente.direccion?.trim() || null,
          notas: data.cliente.notas?.trim() || null,
        },
      })

      const comanda = await tx.comanda.create({
        data: {
          restauranteId: rid,
          numeroComanda,
          clienteId: cliente.id,
          tipoPedido: data.tipoPedido,
          origen: 'PUBLIC_LINK',
          total,
          observaciones: [
            data.observaciones?.trim(),
            `Pago seleccionado: ${data.metodoPago}`,
          ]
            .filter(Boolean)
            .join(' | '),
          publicTokenHash: token.hash,
          creadoPorId: fallbackUser.id,
          items: {
            create: comandaItems,
          },
          historial: {
            create: {
              accion: 'CREADA',
              descripcion: 'Comanda creada desde canal público',
              usuarioId: fallbackUser.id,
            },
          },
        },
        select: {
          id: true,
          numeroComanda: true,
          estado: true,
          total: true,
        },
      })

      return { comanda }
    })

    return NextResponse.json({
      success: true,
      data: {
        ...result.comanda,
        trackingToken: token.raw,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error en POST /api/public/orders:', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo crear el pedido' },
      { status: 500 }
    )
  }
}
