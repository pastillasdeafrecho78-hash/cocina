import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { calcularTotal, generarNumeroComanda, getDestinoFromCategoria } from '@/lib/comanda-helpers'
import { hashSecretToken } from '@/lib/public-ordering'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  externalOrderId: z.string().min(1).max(120),
  source: z.string().min(1).max(80).default('partner'),
  tipoPedido: z.enum(['PARA_LLEVAR', 'A_DOMICILIO', 'WHATSAPP']).default('A_DOMICILIO'),
  observaciones: z.string().max(320).optional(),
  cliente: z
    .object({
      nombre: z.string().min(1).max(120),
      telefono: z.string().max(40).optional(),
      direccion: z.string().max(220).optional(),
      notas: z.string().max(240).optional(),
    })
    .optional(),
  items: z
    .array(
      z.object({
        productoId: z.string().min(1),
        tamanoId: z.string().optional(),
        cantidad: z.number().int().positive(),
        notas: z.string().max(240).optional(),
      })
    )
    .min(1)
    .max(50),
})

function getApiKeyAndSlug(request: NextRequest): { apiKey: string; slug: string } | null {
  const apiKey = request.headers.get('x-api-key')?.trim() ?? ''
  const slug = request.headers.get('x-restaurante-slug')?.trim().toLowerCase() ?? ''
  if (!apiKey || !slug) return null
  return { apiKey, slug }
}

export async function POST(request: NextRequest) {
  try {
    const creds = getApiKeyAndSlug(request)
    if (!creds) {
      return NextResponse.json(
        { success: false, error: 'Headers x-api-key y x-restaurante-slug son requeridos' },
        { status: 401 }
      )
    }
    const body = await request.json()
    const data = bodySchema.parse(body)

    const restaurante = await prisma.restaurante.findFirst({
      where: { slug: creds.slug, activo: true },
      select: {
        id: true,
        integracionPedidosApi: { select: { apiKeyHash: true, activo: true } },
      },
    })
    if (!restaurante?.integracionPedidosApi?.activo) {
      return NextResponse.json(
        { success: false, error: 'Integración no configurada para esta sucursal' },
        { status: 403 }
      )
    }

    const apiHash = hashSecretToken(creds.apiKey)
    if (apiHash !== restaurante.integracionPedidosApi.apiKeyHash) {
      return NextResponse.json({ success: false, error: 'API key inválida' }, { status: 401 })
    }

    const rid = restaurante.id
    const existing = await prisma.comanda.findFirst({
      where: {
        restauranteId: rid,
        externalOrderId: data.externalOrderId,
      },
      select: { id: true, numeroComanda: true, estado: true, total: true },
    })
    if (existing) {
      return NextResponse.json({
        success: true,
        data: {
          ...existing,
          idempotent: true,
        },
      })
    }

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

      const precioUnitario = precioBase
      comandaItems.push({
        productoId: producto.id,
        tamanoId,
        cantidad: itemData.cantidad,
        precioUnitario,
        subtotal: itemData.cantidad * precioUnitario,
        notas: itemData.notas,
        destino: getDestinoFromCategoria(producto.categoria.tipo),
        numeroRonda: 1,
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

    const created = await prisma.$transaction(async (tx) => {
      const cliente = data.cliente
        ? await tx.cliente.create({
            data: {
              restauranteId: rid,
              nombre: data.cliente.nombre.trim(),
              telefono: data.cliente.telefono?.trim() || null,
              direccion: data.cliente.direccion?.trim() || null,
              notas: data.cliente.notas?.trim() || null,
            },
          })
        : null

      const comanda = await tx.comanda.create({
        data: {
          restauranteId: rid,
          numeroComanda,
          clienteId: cliente?.id,
          tipoPedido: data.tipoPedido,
          origen: 'EXTERNAL_API',
          total,
          observaciones: data.observaciones?.trim() || null,
          externalOrderId: data.externalOrderId,
          externalSource: data.source,
          creadoPorId: fallbackUser.id,
          items: {
            create: comandaItems,
          },
          historial: {
            create: {
              accion: 'CREADA',
              descripcion: `Comanda creada por API externa (${data.source})`,
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
      return comanda
    })

    return NextResponse.json({ success: true, data: created })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error en POST /api/public/integraciones/pedidos/orders:', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo crear la orden externa' },
      { status: 500 }
    )
  }
}
