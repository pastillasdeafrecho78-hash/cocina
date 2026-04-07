import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { getMenuContext } from '@/lib/menu-context'
import { z } from 'zod'

const asignarModificadorSchema = z.object({
  modificadorId: z.string().min(1, 'El ID del extra es requerido'),
})

export async function GET(
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

    if (!tienePermiso(user, 'menu.view')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const menuCtx = await getMenuContext(user.restauranteId)
    if (!menuCtx) {
      return NextResponse.json({ success: false, error: 'Sucursal no encontrada' }, { status: 404 })
    }

    const producto = await prisma.producto.findFirst({
      where: { id: params.id, categoria: { restauranteId: menuCtx.menuRestauranteId } },
    })

    if (!producto) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    const modificadores = await prisma.modificadorProducto.findMany({
      where: { productoId: params.id },
      include: { modificador: true },
      orderBy: { modificador: { nombre: 'asc' } },
    })

    return NextResponse.json({ success: true, data: modificadores })
  } catch (error) {
    console.error('Error en GET /api/productos/[id]/modificadores:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

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

    if (!tienePermiso(user, 'menu.manage')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para asignar extras' },
        { status: 403 }
      )
    }

    const menuCtx = await getMenuContext(user.restauranteId)
    if (!menuCtx) {
      return NextResponse.json({ success: false, error: 'Sucursal no encontrada' }, { status: 404 })
    }
    if (menuCtx.isSharedConsumer) {
      return NextResponse.json(
        { success: false, error: 'La carta es compartida y no puede editarse desde esta sucursal' },
        { status: 409 }
      )
    }

    const producto = await prisma.producto.findFirst({
      where: { id: params.id, categoria: { restauranteId: menuCtx.menuRestauranteId } },
    })

    if (!producto) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const data = asignarModificadorSchema.parse(body)

    const modificador = await prisma.modificador.findFirst({
      where: { id: data.modificadorId, restauranteId: menuCtx.menuRestauranteId },
    })

    if (!modificador) {
      return NextResponse.json(
        { success: false, error: 'Extra no encontrado' },
        { status: 404 }
      )
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
        restauranteId: user.restauranteId,
        usuarioId: user.id,
        accion: 'ASIGNAR_EXTRA_PRODUCTO',
        entidad: 'Producto',
        entidadId: params.id,
        detalles: { modificadorId: data.modificadorId, modificadorNombre: modificador.nombre },
      },
    })

    return NextResponse.json({ success: true, data: relacion }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error en POST /api/productos/[id]/modificadores:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    if (!tienePermiso(user, 'menu.manage')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para quitar extras' },
        { status: 403 }
      )
    }

    const menuCtx = await getMenuContext(user.restauranteId)
    if (!menuCtx) {
      return NextResponse.json({ success: false, error: 'Sucursal no encontrada' }, { status: 404 })
    }
    if (menuCtx.isSharedConsumer) {
      return NextResponse.json(
        { success: false, error: 'La carta es compartida y no puede editarse desde esta sucursal' },
        { status: 409 }
      )
    }

    const body = await request.json()
    const data = asignarModificadorSchema.parse(body)

    const prodOk = await prisma.producto.findFirst({
      where: { id: params.id, categoria: { restauranteId: menuCtx.menuRestauranteId } },
    })
    if (!prodOk) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
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
      return NextResponse.json(
        { success: false, error: 'El extra no está asignado a este producto' },
        { status: 404 }
      )
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
        restauranteId: user.restauranteId,
        usuarioId: user.id,
        accion: 'QUITAR_EXTRA_PRODUCTO',
        entidad: 'Producto',
        entidadId: params.id,
        detalles: { modificadorId: data.modificadorId },
      },
    })

    return NextResponse.json({ success: true, message: 'Extra quitado del producto' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error en DELETE /api/productos/[id]/modificadores:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
