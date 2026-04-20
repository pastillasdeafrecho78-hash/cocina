import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { calcularTotal, getDestinoFromCategoria } from '@/lib/comanda-helpers'
import { resolveEffectiveMenu } from '@/lib/menu-effective'

export const publicSolicitudSchema = z.object({
  slug: z.string().min(1).max(64),
  mesaCode: z.string().min(1).max(128).optional(),
  tipoPedido: z.enum(['MESA', 'PARA_LLEVAR', 'ENVIO']),
  acceptEnCola: z.boolean().optional(),
  cliente: z.object({
    nombre: z.string().min(1).max(120),
    telefono: z.string().max(40).optional().nullable(),
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

export type PublicSolicitudInput = z.infer<typeof publicSolicitudSchema>

export async function buildSolicitudItems(restauranteId: string, data: PublicSolicitudInput) {
  const menuCtx = await resolveEffectiveMenu(restauranteId)
  const menuRestauranteId = menuCtx.menuRestauranteId

  const productos = await prisma.producto.findMany({
    where: {
      id: { in: data.items.map((item) => item.productoId) },
      activo: true,
      categoria: { restauranteId: menuRestauranteId, activa: true },
    },
    include: {
      categoria: true,
      tamanos: true,
    },
  })

  const solicitudItems: Array<{
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
      throw new Error(`Producto no disponible: ${itemData.productoId}`)
    }

    const tieneTamanos = producto.tamanos.length > 0
    if (tieneTamanos && !itemData.tamanoId) {
      throw new Error(`El producto "${producto.nombre}" requiere tamaño`)
    }
    if (!tieneTamanos && itemData.tamanoId) {
      throw new Error(`El producto "${producto.nombre}" no maneja tamaños`)
    }

    let precioBase = producto.precio
    let tamanoId: string | undefined
    if (itemData.tamanoId) {
      const tamano = producto.tamanos.find((t) => t.id === itemData.tamanoId)
      if (!tamano) {
        throw new Error(`Tamaño inválido para ${producto.nombre}`)
      }
      precioBase = tamano.precio
      tamanoId = tamano.id
    }

    let precioModificadores = 0
    const itemModificadores = []
    if (itemData.modificadores?.length) {
      const mods = await prisma.modificador.findMany({
        where: { id: { in: itemData.modificadores }, restauranteId: menuRestauranteId, activo: true },
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
    solicitudItems.push({
      productoId: producto.id,
      tamanoId,
      cantidad: itemData.cantidad,
      precioUnitario,
      subtotal: itemData.cantidad * precioUnitario,
      notas: itemData.notas,
      destino: getDestinoFromCategoria(producto.categoria.tipo),
      modificadores: {
        create: itemModificadores,
      },
    })
  }

  const totalEstimado = calcularTotal(
    solicitudItems.map((item) => ({
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      precioModificadores: 0,
    }))
  )

  return { solicitudItems, totalEstimado }
}
