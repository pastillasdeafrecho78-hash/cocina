import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calcularTotal, generarNumeroComanda, getDestinoFromCategoria } from '@/lib/comanda-helpers'
import { resolveEffectiveMenu } from '@/lib/menu-effective'
import {
  type CreateExternalOrderBody,
  normalizeTipoPedido,
} from '@/lib/orders/public-contract'
import { raiseApiError } from '@/lib/orders/public-errors'

type CreateExternalOrderInput = {
  restauranteId: string
  restauranteSlug: string | null
  data: CreateExternalOrderBody
}

export async function createExternalOrder(input: CreateExternalOrderInput) {
  const menuCtx = await resolveEffectiveMenu(input.restauranteId)
  const menuRestauranteId = menuCtx.menuRestauranteId

  const existing = await prisma.comanda.findFirst({
    where: {
      restauranteId: input.restauranteId,
      externalOrderId: input.data.externalOrderId,
    },
    select: {
      id: true,
      numeroComanda: true,
      estado: true,
      total: true,
      fechaCreacion: true,
    },
  })

  if (existing) {
    return {
      status: 200,
      body: {
        success: true,
        data: {
          orderId: existing.id,
          numeroComanda: existing.numeroComanda,
          estado: existing.estado,
          total: existing.total,
          restauranteId: input.restauranteId,
          restauranteSlug: input.restauranteSlug,
          origen: 'EXTERNAL_API',
          idempotent: true,
          createdAt: existing.fechaCreacion,
        },
      },
    }
  }

  const fallbackUser = await prisma.usuario.findFirst({
    where: { restauranteId: input.restauranteId, activo: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!fallbackUser) {
    raiseApiError(409, 'branch_without_operator', 'Sucursal sin usuarios operativos')
  }

  const productos = await prisma.producto.findMany({
    where: {
      id: { in: input.data.items.map((item) => item.productoId) },
      activo: true,
      categoria: { restauranteId: menuRestauranteId, activa: true },
    },
    include: {
      categoria: true,
      tamanos: true,
    },
  })

  const requestedModifierIds = Array.from(
    new Set(
      input.data.items.flatMap((item) => item.modificadores?.map((mod) => mod.modificadorId) ?? [])
    )
  )
  const modifiersById = new Map<string, { id: string; precioExtra: number | null }>()
  if (requestedModifierIds.length > 0) {
    const mods = await prisma.modificador.findMany({
      where: {
        id: { in: requestedModifierIds },
        restauranteId: menuRestauranteId,
        activo: true,
      },
      select: { id: true, precioExtra: true },
    })
    for (const mod of mods) modifiersById.set(mod.id, mod)
  }

  const comandaItems: Array<{
    productoId: string
    tamanoId?: string
    cantidad: number
    precioUnitario: number
    subtotal: number
    notas?: string
    destino: 'COCINA' | 'BARRA'
    numeroRonda: number
    modificadores: Array<{ modificadorId: string; precioExtra: number }>
  }> = []
  const pricingForTotal: Array<{
    cantidad: number
    precioUnitario: number
    precioModificadores: number
  }> = []

  for (const itemData of input.data.items) {
    const producto = productos.find((p) => p.id === itemData.productoId)
    if (!producto) {
      raiseApiError(
        422,
        'invalid_item_scope',
        `Producto no disponible para esta sucursal: ${itemData.productoId}`
      )
    }

    const tieneTamanos = producto.tamanos.length > 0
    if (tieneTamanos && !itemData.tamanoId) {
      raiseApiError(400, 'invalid_payload', `El producto "${producto.nombre}" requiere tamaño`)
    }
    if (!tieneTamanos && itemData.tamanoId) {
      raiseApiError(400, 'invalid_payload', `El producto "${producto.nombre}" no maneja tamaños`)
    }

    let precioBase = producto.precio
    let tamanoId: string | undefined
    if (itemData.tamanoId) {
      const tamano = producto.tamanos.find((t) => t.id === itemData.tamanoId)
      if (!tamano) {
        raiseApiError(422, 'invalid_item_scope', `Tamaño inválido para ${producto.nombre}`)
      }
      precioBase = tamano.precio
      tamanoId = tamano.id
    }

    const parsedModifiers = (itemData.modificadores ?? []).map((mod) => {
      const found = modifiersById.get(mod.modificadorId)
      if (!found) {
        raiseApiError(
          422,
          'invalid_item_scope',
          `Modificador inválido para esta sucursal: ${mod.modificadorId}`
        )
      }
      return { modificadorId: found.id, precioExtra: found.precioExtra ?? 0 }
    })

    const modifierUnitPrice = parsedModifiers.reduce((sum, mod) => sum + mod.precioExtra, 0)
    const precioUnitario = precioBase
    comandaItems.push({
      productoId: producto.id,
      tamanoId,
      cantidad: itemData.cantidad,
      precioUnitario,
      subtotal: itemData.cantidad * (precioUnitario + modifierUnitPrice),
      notas: itemData.notas,
      destino: getDestinoFromCategoria(producto.categoria.tipo),
      numeroRonda: 1,
      modificadores: parsedModifiers,
    })
    pricingForTotal.push({
      cantidad: itemData.cantidad,
      precioUnitario,
      precioModificadores: modifierUnitPrice,
    })
  }

  const total = calcularTotal(pricingForTotal)
  const numeroComanda = await generarNumeroComanda(input.restauranteId)

  try {
    const created = await prisma.$transaction(async (tx) => {
      const cliente = input.data.cliente
        ? await tx.cliente.create({
            data: {
              restauranteId: input.restauranteId,
              nombre: input.data.cliente.nombre.trim(),
              telefono: input.data.cliente.telefono?.trim() || null,
              direccion: input.data.cliente.direccion?.trim() || null,
              notas: input.data.cliente.notas?.trim() || null,
            },
          })
        : null

      const comanda = await tx.comanda.create({
        data: {
          restauranteId: input.restauranteId,
          numeroComanda,
          clienteId: cliente?.id,
          tipoPedido: normalizeTipoPedido(input.data.tipoPedido),
          origen: 'EXTERNAL_API',
          total,
          observaciones: input.data.observaciones?.trim() || null,
          externalOrderId: input.data.externalOrderId,
          externalSource: input.data.source ?? input.data.canal ?? 'external-app-v1',
          creadoPorId: fallbackUser.id,
          items: {
            create: comandaItems.map((item) => ({
              productoId: item.productoId,
              tamanoId: item.tamanoId,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
              subtotal: item.subtotal,
              notas: item.notas,
              destino: item.destino,
              numeroRonda: item.numeroRonda,
              modificadores: {
                create: item.modificadores,
              },
            })),
          },
          historial: {
            create: {
              accion: 'CREADA',
              descripcion: `Comanda creada por API externa (${input.data.source ?? input.data.canal ?? 'external-app-v1'})`,
              usuarioId: fallbackUser.id,
            },
          },
        },
        select: {
          id: true,
          numeroComanda: true,
          estado: true,
          total: true,
          fechaCreacion: true,
        },
      })
      return comanda
    })

    return {
      status: 201,
      body: {
        success: true,
        data: {
          orderId: created.id,
          numeroComanda: created.numeroComanda,
          estado: created.estado,
          total: created.total,
          restauranteId: input.restauranteId,
          restauranteSlug: input.restauranteSlug,
          origen: 'EXTERNAL_API',
          idempotent: false,
          createdAt: created.fechaCreacion,
        },
      },
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await prisma.comanda.findFirst({
        where: {
          restauranteId: input.restauranteId,
          externalOrderId: input.data.externalOrderId,
        },
        select: {
          id: true,
          numeroComanda: true,
          estado: true,
          total: true,
          fechaCreacion: true,
        },
      })
      if (raced) {
        return {
          status: 200,
          body: {
            success: true,
            data: {
              orderId: raced.id,
              numeroComanda: raced.numeroComanda,
              estado: raced.estado,
              total: raced.total,
              restauranteId: input.restauranteId,
              restauranteSlug: input.restauranteSlug,
              origen: 'EXTERNAL_API',
              idempotent: true,
              createdAt: raced.fechaCreacion,
            },
          },
        }
      }
      raiseApiError(409, 'duplicate_external_order', 'La orden externa ya existe para esta sucursal')
    }

    throw error
  }
}

export async function getExternalOrderStatus(input: { restauranteId: string; orderId: string }) {
  const order = await prisma.comanda.findFirst({
    where: {
      id: input.orderId,
      restauranteId: input.restauranteId,
      origen: 'EXTERNAL_API',
    },
    select: {
      id: true,
      numeroComanda: true,
      estado: true,
      total: true,
      fechaCreacion: true,
      fechaCompletado: true,
      fechaCancelacion: true,
    },
  })

  if (!order) {
    raiseApiError(404, 'order_not_found', 'Orden no encontrada')
  }

  return {
    success: true,
    data: {
      orderId: order.id,
      numeroComanda: order.numeroComanda,
      estado: order.estado,
      total: order.total,
      createdAt: order.fechaCreacion,
      completedAt: order.fechaCompletado,
      cancelledAt: order.fechaCancelacion,
    },
  }
}
