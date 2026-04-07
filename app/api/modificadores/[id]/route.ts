import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { getMenuContext } from '@/lib/menu-context'
import { z } from 'zod'

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
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    if (!tienePermiso(user, 'menu.manage')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para editar extras' },
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

    const modificadorExistente = await prisma.modificador.findFirst({
      where: { id: params.id, restauranteId: menuCtx.menuRestauranteId },
    })

    if (!modificadorExistente) {
      return NextResponse.json(
        { success: false, error: 'Extra no encontrado' },
        { status: 404 }
      )
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
        return NextResponse.json(
          { success: false, error: 'Ya existe un extra con ese nombre y tipo' },
          { status: 400 }
        )
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error en PATCH /api/modificadores/[id]:', error)
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
        { success: false, error: 'Sin permisos para eliminar extras' },
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

    const modificador = await prisma.modificador.findFirst({
      where: { id: params.id, restauranteId: menuCtx.menuRestauranteId },
      include: {
        productos: true,
        items: true,
      },
    })

    if (!modificador) {
      return NextResponse.json(
        { success: false, error: 'Extra no encontrado' },
        { status: 404 }
      )
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
    console.error('Error en DELETE /api/modificadores/[id]:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
