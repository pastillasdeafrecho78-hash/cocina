import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { getMenuContext } from '@/lib/menu-context'
import { z } from 'zod'

const modificadorSchema = z.object({
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

    const categoria = await prisma.categoria.findFirst({
      where: { id: params.id, restauranteId: menuCtx.menuRestauranteId },
    })

    if (!categoria) {
      return NextResponse.json(
        { success: false, error: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    const modificadores = await prisma.modificadorCategoria.findMany({
      where: { categoriaId: params.id },
      include: { modificador: true },
      orderBy: { modificador: { nombre: 'asc' } },
    })

    return NextResponse.json({ success: true, data: modificadores })
  } catch (error) {
    console.error('Error en GET /api/categorias/[id]/modificadores:', error)
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
        { success: false, error: 'Sin permisos para asignar extras a categorías' },
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

    const categoria = await prisma.categoria.findFirst({
      where: { id: params.id, restauranteId: menuCtx.menuRestauranteId },
    })

    if (!categoria) {
      return NextResponse.json(
        { success: false, error: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const data = modificadorSchema.parse(body)

    const modificador = await prisma.modificador.findFirst({
      where: { id: data.modificadorId, restauranteId: menuCtx.menuRestauranteId },
    })

    if (!modificador) {
      return NextResponse.json(
        { success: false, error: 'Extra no encontrado' },
        { status: 404 }
      )
    }

    const relacion = await prisma.modificadorCategoria.upsert({
      where: {
        categoriaId_modificadorId: {
          categoriaId: params.id,
          modificadorId: data.modificadorId,
        },
      },
      create: {
        categoriaId: params.id,
        modificadorId: data.modificadorId,
      },
      update: {},
      include: { modificador: true },
    })

    await prisma.auditoria.create({
      data: {
        restauranteId: user.restauranteId,
        usuarioId: user.id,
        accion: 'ASIGNAR_EXTRA_CATEGORIA',
        entidad: 'Categoria',
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

    console.error('Error en POST /api/categorias/[id]/modificadores:', error)
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
        { success: false, error: 'Sin permisos para quitar extras de categorías' },
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
    const data = modificadorSchema.parse(body)

    const catOk = await prisma.categoria.findFirst({
      where: { id: params.id, restauranteId: menuCtx.menuRestauranteId },
    })
    if (!catOk) {
      return NextResponse.json(
        { success: false, error: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    const relacion = await prisma.modificadorCategoria.findUnique({
      where: {
        categoriaId_modificadorId: {
          categoriaId: params.id,
          modificadorId: data.modificadorId,
        },
      },
    })

    if (!relacion) {
      return NextResponse.json(
        { success: false, error: 'El extra no está asignado a esta categoría' },
        { status: 404 }
      )
    }

    await prisma.modificadorCategoria.delete({
      where: {
        categoriaId_modificadorId: {
          categoriaId: params.id,
          modificadorId: data.modificadorId,
        },
      },
    })

    await prisma.auditoria.create({
      data: {
        restauranteId: user.restauranteId,
        usuarioId: user.id,
        accion: 'QUITAR_EXTRA_CATEGORIA',
        entidad: 'Categoria',
        entidadId: params.id,
        detalles: { modificadorId: data.modificadorId },
      },
    })

    return NextResponse.json({ success: true, message: 'Extra quitado de la categoría' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error en DELETE /api/categorias/[id]/modificadores:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
