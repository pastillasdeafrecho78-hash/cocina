import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMenuContext } from '@/lib/menu-context'
import { z } from 'zod'
import { requireAuthenticatedUser, requireCapability } from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'

const updateCategoriaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').optional(),
  descripcion: z.string().optional(),
  tipo: z.enum(['COMIDA', 'BEBIDA', 'POSTRE', 'ENTRADA']).optional(),
  orden: z.number().int().optional(),
  activa: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'menu.manage')

    const menuCtx = await getMenuContext(user.restauranteId)
    if (!menuCtx) {
      raise(404, 'Sucursal no encontrada')
    }
    if (menuCtx.isSharedConsumer) {
      raise(409, 'La carta es compartida y no puede editarse desde esta sucursal')
    }

    const body = await request.json()
    const data = updateCategoriaSchema.parse(body)

    // Verificar que la categoría existe
    const categoriaExistente = await prisma.categoria.findFirst({
      where: { id: params.id, restauranteId: menuCtx.menuRestauranteId },
    })

    if (!categoriaExistente) {
      raise(404, 'Categoría no encontrada')
    }

    // Si se está cambiando el nombre, verificar que no exista otra con ese nombre
    if (data.nombre && data.nombre !== categoriaExistente.nombre) {
      const nombreExistente = await prisma.categoria.findFirst({
        where: {
          restauranteId: menuCtx.menuRestauranteId,
          nombre: data.nombre,
          activa: true,
          id: { not: params.id },
        },
      })

      if (nombreExistente) {
        raise(400, 'Ya existe una categoría con ese nombre')
      }
    }

    const categoria = await prisma.categoria.update({
      where: { id: params.id },
      data: {
        ...(data.nombre && { nombre: data.nombre }),
        ...(data.descripcion !== undefined && { descripcion: data.descripcion || null }),
        ...(data.tipo && { tipo: data.tipo }),
        ...(data.orden !== undefined && { orden: data.orden }),
        ...(data.activa !== undefined && { activa: data.activa }),
      },
    })

    // Registrar auditoría
    await prisma.auditoria.create({
      data: {
        restauranteId: user.restauranteId,
        usuarioId: user.id,
        accion: 'ACTUALIZAR_CATEGORIA',
        entidad: 'Categoria',
        entidadId: categoria.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: categoria,
    })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en PATCH /api/categorias/[id]:'
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

    const menuCtx = await getMenuContext(user.restauranteId)
    if (!menuCtx) {
      raise(404, 'Sucursal no encontrada')
    }
    if (menuCtx.isSharedConsumer) {
      raise(409, 'La carta es compartida y no puede editarse desde esta sucursal')
    }

    // Verificar que la categoría existe
    const categoria = await prisma.categoria.findFirst({
      where: { id: params.id, restauranteId: menuCtx.menuRestauranteId },
      include: {
        productos: {
          where: { activo: true },
        },
      },
    })

    if (!categoria) {
      raise(404, 'Categoría no encontrada')
    }

    // Si tiene productos activos, no se puede eliminar, solo desactivar
    if (categoria.productos.length > 0) {
      // Desactivar en lugar de eliminar
      const categoriaActualizada = await prisma.categoria.update({
        where: { id: categoria.id },
        data: { activa: false },
      })

      // Registrar auditoría
      await prisma.auditoria.create({
        data: {
          restauranteId: user.restauranteId,
          usuarioId: user.id,
          accion: 'DESACTIVAR_CATEGORIA',
          entidad: 'Categoria',
          entidadId: categoria.id,
        },
      })

      return NextResponse.json({
        success: true,
        data: categoriaActualizada,
        message: 'Categoría desactivada (tiene productos asociados)',
      })
    }

    // Si no tiene productos, eliminar físicamente
    await prisma.categoria.delete({
      where: { id: categoria.id },
    })

    // Registrar auditoría
    await prisma.auditoria.create({
      data: {
        restauranteId: user.restauranteId,
        usuarioId: user.id,
        accion: 'ELIMINAR_CATEGORIA',
        entidad: 'Categoria',
        entidadId: params.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Categoría eliminada exitosamente',
    })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en DELETE /api/categorias/[id]:'
    )
  }
}
