import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMenuContext } from '@/lib/menu-context'
import { requireActiveTenant, requireAuthenticatedUser, requireCapability } from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'
import { z } from 'zod'

const modificadorSchema = z.object({
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

    const categoria = await prisma.categoria.findFirst({
      where: { id: params.id, restauranteId: menuCtx.menuRestauranteId },
    })

    if (!categoria) {
      raise(404, 'Categoría no encontrada')
    }

    const modificadores = await prisma.modificadorCategoria.findMany({
      where: { categoriaId: params.id },
      include: { modificador: true },
      orderBy: { modificador: { nombre: 'asc' } },
    })

    return NextResponse.json({ success: true, data: modificadores })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en GET /api/categorias/[id]/modificadores:'
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

    const categoria = await prisma.categoria.findFirst({
      where: { id: params.id, restauranteId: menuCtx.menuRestauranteId },
    })

    if (!categoria) {
      raise(404, 'Categoría no encontrada')
    }

    const body = await request.json()
    const data = modificadorSchema.parse(body)

    const modificador = await prisma.modificador.findFirst({
      where: { id: data.modificadorId, restauranteId: menuCtx.menuRestauranteId },
    })

    if (!modificador) {
      raise(404, 'Extra no encontrado')
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
        restauranteId: tenant.restauranteId,
        usuarioId: user.id,
        accion: 'ASIGNAR_EXTRA_CATEGORIA',
        entidad: 'Categoria',
        entidadId: params.id,
        detalles: { modificadorId: data.modificadorId, modificadorNombre: modificador.nombre },
      },
    })

    return NextResponse.json({ success: true, data: relacion }, { status: 201 })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en POST /api/categorias/[id]/modificadores:'
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
    const data = modificadorSchema.parse(body)

    const catOk = await prisma.categoria.findFirst({
      where: { id: params.id, restauranteId: menuCtx.menuRestauranteId },
    })
    if (!catOk) {
      raise(404, 'Categoría no encontrada')
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
      raise(404, 'El extra no está asignado a esta categoría')
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
        restauranteId: tenant.restauranteId,
        usuarioId: user.id,
        accion: 'QUITAR_EXTRA_CATEGORIA',
        entidad: 'Categoria',
        entidadId: params.id,
        detalles: { modificadorId: data.modificadorId },
      },
    })

    return NextResponse.json({ success: true, message: 'Extra quitado de la categoría' })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en DELETE /api/categorias/[id]/modificadores:'
    )
  }
}
