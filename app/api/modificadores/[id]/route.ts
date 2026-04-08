import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMenuContext } from '@/lib/menu-context'
import { z } from 'zod'
import { requireAuthenticatedUser, requireCapability } from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'

const updateModificadorSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').optional(),
  tipo: z.enum(['INGREDIENTE', 'COCCION', 'TAMANO', 'EXTRAS']).optional(),
  precioExtra: z.number().min(0, 'El precio no puede ser negativo').optional(),
  activo: z.boolean().optional(),
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

    const modificadorExistente = await prisma.modificador.findFirst({
      where: { id: params.id, restauranteId: menuCtx.menuRestauranteId },
    })

    if (!modificadorExistente) {
      raise(404, 'Extra no encontrado')
    }

    const body = await request.json()
    const data = updateModificadorSchema.parse(body)

    if (data.nombre && data.tipo && (data.nombre !== modificadorExistente.nombre || data.tipo !== modificadorExistente.tipo)) {
      const duplicado = await prisma.modificador.findFirst({
        where: {
          restauranteId: menuCtx.menuRestauranteId,
          nombre: data.nombre,
          tipo: data.tipo,
          id: { not: params.id },
        },
      })

      if (duplicado) {
        raise(400, 'Ya existe un extra con ese nombre y tipo')
      }
    }

    const modificador = await prisma.modificador.update({
      where: { id: params.id },
      data: {
        ...(data.nombre !== undefined && { nombre: data.nombre }),
        ...(data.tipo !== undefined && { tipo: data.tipo }),
        ...(data.precioExtra !== undefined && { precioExtra: data.precioExtra }),
        ...(data.activo !== undefined && { activo: data.activo }),
      },
    })

    await prisma.auditoria.create({
      data: {
        restauranteId: user.restauranteId,
        usuarioId: user.id,
        accion: 'ACTUALIZAR_MODIFICADOR',
        entidad: 'Modificador',
        entidadId: modificador.id,
      },
    })

    return NextResponse.json({ success: true, data: modificador })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en PATCH /api/modificadores/[id]:'
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

    const modificador = await prisma.modificador.findFirst({
      where: { id: params.id, restauranteId: menuCtx.menuRestauranteId },
      include: {
        productos: true,
        items: true,
      },
    })

    if (!modificador) {
      raise(404, 'Extra no encontrado')
    }

    // Si está asignado a productos o usado en comandas, solo desactivar
    if (modificador.productos.length > 0 || modificador.items.length > 0) {
      const modificadorActualizado = await prisma.modificador.update({
        where: { id: modificador.id },
        data: { activo: false },
      })

      await prisma.auditoria.create({
        data: {
          restauranteId: user.restauranteId,
          usuarioId: user.id,
          accion: 'DESACTIVAR_MODIFICADOR',
          entidad: 'Modificador',
          entidadId: params.id,
        },
      })

      return NextResponse.json({
        success: true,
        data: modificadorActualizado,
        message: 'Extra desactivado (está asignado a productos o comandas)',
      })
    }

    await prisma.modificador.delete({ where: { id: modificador.id } })

    await prisma.auditoria.create({
      data: {
        restauranteId: user.restauranteId,
        usuarioId: user.id,
        accion: 'ELIMINAR_MODIFICADOR',
        entidad: 'Modificador',
        entidadId: params.id,
      },
    })

    return NextResponse.json({ success: true, message: 'Extra eliminado exitosamente' })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en DELETE /api/modificadores/[id]:'
    )
  }
}
