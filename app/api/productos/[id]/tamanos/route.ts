import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMenuContext } from '@/lib/menu-context'
import { requireActiveTenant, requireAuthenticatedUser, requireCapability } from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'
import { z } from 'zod'

const createTamanoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  precio: z.number().positive('El precio debe ser mayor a 0'),
  orden: z.number().int().optional().default(0),
})

/**
 * GET /api/productos/[id]/tamanos
 * Lista los tamaños de un producto
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'menu.view')
    const tenant = requireActiveTenant(user)

    const menuCtx = await getMenuContext(tenant.restauranteId)
    if (!menuCtx) {
      raise(404, 'Sucursal no encontrada')
    }

    const producto = await prisma.producto.findFirst({
      where: { id: params.id, categoria: { restauranteId: menuCtx.menuRestauranteId } },
    })
    if (!producto) {
      raise(404, 'Producto no encontrado')
    }

    const tamanos = await prisma.productoTamano.findMany({
      where: { productoId: producto.id },
      orderBy: { orden: 'asc' },
    })

    return NextResponse.json({ success: true, data: tamanos })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en GET /api/productos/[id]/tamanos:'
    )
  }
}

/**
 * POST /api/productos/[id]/tamanos
 * Crea un tamaño para el producto
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'menu.manage')
    const tenant = requireActiveTenant(user)

    const menuCtx = await getMenuContext(tenant.restauranteId)
    if (!menuCtx) {
      raise(404, 'Sucursal no encontrada')
    }
    if (menuCtx.isSharedConsumer) {
      raise(409, 'La carta es compartida y no puede editarse desde esta sucursal')
    }

    const producto = await prisma.producto.findFirst({
      where: { id: params.id, categoria: { restauranteId: menuCtx.menuRestauranteId } },
    })
    if (!producto) {
      raise(404, 'Producto no encontrado')
    }

    const body = await request.json()
    const data = createTamanoSchema.parse(body)

    const tamano = await prisma.productoTamano.create({
      data: {
        productoId: params.id,
        nombre: data.nombre.trim(),
        precio: data.precio,
        orden: data.orden,
      },
    })

    return NextResponse.json({ success: true, data: tamano })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en POST /api/productos/[id]/tamanos:'
    )
  }
}
