import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMenuContext } from '@/lib/menu-context'
import { requireActiveTenant, requireAuthenticatedUser, requireCapability } from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'
import { z } from 'zod'

const updateTamanoSchema = z.object({
  nombre: z.string().min(1).optional(),
  precio: z.number().positive().optional(),
  orden: z.number().int().optional(),
})

/**
 * PATCH /api/productos/[id]/tamanos/[tamanoId]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; tamanoId: string } }
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

    const tamano = await prisma.productoTamano.findFirst({
      where: {
        id: params.tamanoId,
        productoId: params.id,
        producto: { categoria: { restauranteId: menuCtx.menuRestauranteId } },
      },
    })
    if (!tamano) {
      raise(404, 'Tamaño no encontrado')
    }

    const body = await request.json()
    const data = updateTamanoSchema.parse(body)

    const actualizado = await prisma.productoTamano.update({
      where: { id: params.tamanoId },
      data: {
        ...(data.nombre != null && { nombre: data.nombre.trim() }),
        ...(data.precio != null && { precio: data.precio }),
        ...(data.orden != null && { orden: data.orden }),
      },
    })

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en PATCH /api/productos/[id]/tamanos/[tamanoId]:'
    )
  }
}

/**
 * DELETE /api/productos/[id]/tamanos/[tamanoId]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; tamanoId: string } }
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

    const tamano = await prisma.productoTamano.findFirst({
      where: {
        id: params.tamanoId,
        productoId: params.id,
        producto: { categoria: { restauranteId: menuCtx.menuRestauranteId } },
      },
    })
    if (!tamano) {
      raise(404, 'Tamaño no encontrado')
    }

    await prisma.productoTamano.delete({
      where: { id: params.tamanoId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en DELETE /api/productos/[id]/tamanos/[tamanoId]:'
    )
  }
}
