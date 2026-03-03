import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken, getTokenFromRequest, isAdmin } from '@/lib/auth'
import { z } from 'zod'

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
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    if (!isAdmin(user.rol)) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para editar categorías' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = updateCategoriaSchema.parse(body)

    // Verificar que la categoría existe
    const categoriaExistente = await prisma.categoria.findUnique({
      where: { id: params.id },
    })

    if (!categoriaExistente) {
      return NextResponse.json(
        { success: false, error: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    // Si se está cambiando el nombre, verificar que no exista otra con ese nombre
    if (data.nombre && data.nombre !== categoriaExistente.nombre) {
      const nombreExistente = await prisma.categoria.findFirst({
        where: {
          nombre: data.nombre,
          activa: true,
          id: { not: params.id },
        },
      })

      if (nombreExistente) {
        return NextResponse.json(
          { success: false, error: 'Ya existe una categoría con ese nombre' },
          { status: 400 }
        )
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error en PATCH /api/categorias/[id]:', error)
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
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    if (!isAdmin(user.rol)) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para eliminar categorías' },
        { status: 403 }
      )
    }

    // Verificar que la categoría existe
    const categoria = await prisma.categoria.findUnique({
      where: { id: params.id },
      include: {
        productos: {
          where: { activo: true },
        },
      },
    })

    if (!categoria) {
      return NextResponse.json(
        { success: false, error: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    // Si tiene productos activos, no se puede eliminar, solo desactivar
    if (categoria.productos.length > 0) {
      // Desactivar en lugar de eliminar
      const categoriaActualizada = await prisma.categoria.update({
        where: { id: params.id },
        data: { activa: false },
      })

      // Registrar auditoría
      await prisma.auditoria.create({
        data: {
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
      where: { id: params.id },
    })

    // Registrar auditoría
    await prisma.auditoria.create({
      data: {
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
    console.error('Error en DELETE /api/categorias/[id]:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
