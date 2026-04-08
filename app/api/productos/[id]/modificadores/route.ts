import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMenuContext } from '@/lib/menu-context'
import { requireActiveTenant, requireAuthenticatedUser, requireCapability } from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'
import { z } from 'zod'

const asignarModificadorSchema = z.object({
  modificadorId: z.string().min(1, 'El ID del extra es requerido'),
})

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

    const modificadores = await prisma.modificadorProducto.findMany({
      where: { productoId: params.id },
      include: { modificador: true },
      orderBy: { modificador: { nombre: 'asc' } },
    })

    return NextResponse.json({ success: true, data: modificadores })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en GET /api/productos/[id]/modificadores:'
    )
  }
}

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
    const data = asignarModificadorSchema.parse(body)

    const modificador = await prisma.modificador.findFirst({
      where: { id: data.modificadorId, restauranteId: menuCtx.menuRestauranteId },
    })

    if (!modificador) {
      raise(404, 'Extra no encontrado')
    }

    // upsert para evitar duplicados
    const relacion = await prisma.modificadorProducto.upsert({
      where: {
        productoId_modificadorId: {
          productoId: params.id,
          modificadorId: data.modificadorId,
        },
      },
      create: {
        productoId: params.id,
        modificadorId: data.modificadorId,
      },
      update: {},
      include: { modificador: true },
    })

    await prisma.auditoria.create({
      data: {
        restauranteId: tenant.restauranteId,
        usuarioId: user.id,
        accion: 'ASIGNAR_EXTRA_PRODUCTO',
        entidad: 'Producto',
        entidadId: params.id,
        detalles: { modificadorId: data.modificadorId, modificadorNombre: modificador.nombre },
      },
    })

    return NextResponse.json({ success: true, data: relacion }, { status: 201 })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en POST /api/productos/[id]/modificadores:'
    )
  }
}

export async function DELETE(
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

    const body = await request.json()
    const data = asignarModificadorSchema.parse(body)

    const prodOk = await prisma.producto.findFirst({
      where: { id: params.id, categoria: { restauranteId: menuCtx.menuRestauranteId } },
    })
    if (!prodOk) {
      raise(404, 'Producto no encontrado')
    }

    const relacion = await prisma.modificadorProducto.findUnique({
      where: {
        productoId_modificadorId: {
          productoId: params.id,
          modificadorId: data.modificadorId,
        },
      },
    })

    if (!relacion) {
      raise(404, 'El extra no está asignado a este producto')
    }

    await prisma.modificadorProducto.delete({
      where: {
        productoId_modificadorId: {
          productoId: params.id,
          modificadorId: data.modificadorId,
        },
      },
    })

    await prisma.auditoria.create({
      data: {
        restauranteId: tenant.restauranteId,
        usuarioId: user.id,
        accion: 'QUITAR_EXTRA_PRODUCTO',
        entidad: 'Producto',
        entidadId: params.id,
        detalles: { modificadorId: data.modificadorId },
      },
    })

    return NextResponse.json({ success: true, message: 'Extra quitado del producto' })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en DELETE /api/productos/[id]/modificadores:'
    )
  }
}
