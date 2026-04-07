import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { getMenuContext } from '@/lib/menu-context'
import { z } from 'zod'

const updateProductoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').optional(),
  descripcion: z.string().optional(),
  precio: z.number().positive('El precio debe ser mayor a 0').optional(),
  categoriaId: z.string().min(1, 'La categoría es requerida').optional(),
  imagenUrl: z.string().url().optional().or(z.literal('')),
  activo: z.boolean().optional(),
  listoPorDefault: z.boolean().optional(),
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
        { success: false, error: 'Sin permisos para editar productos' },
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
    const data = updateProductoSchema.parse(body)

    // Verificar que el producto existe
    const productoExistente = await prisma.producto.findFirst({
      where: {
        id: params.id,
        categoria: { restauranteId: menuCtx.menuRestauranteId },
      },
    })

    if (!productoExistente) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    // Si se está cambiando la categoría, verificar que existe
    if (data.categoriaId) {
      const categoria = await prisma.categoria.findFirst({
        where: { id: data.categoriaId, restauranteId: menuCtx.menuRestauranteId },
      })

      if (!categoria) {
        return NextResponse.json(
          { success: false, error: 'Categoría no encontrada' },
          { status: 404 }
        )
      }
    }

    // Actualizar el producto
    const producto = await prisma.producto.update({
      where: { id: params.id },
      data: {
        ...(data.nombre && { nombre: data.nombre }),
        ...(data.descripcion !== undefined && { descripcion: data.descripcion || null }),
        ...(data.precio && { precio: data.precio }),
        ...(data.categoriaId && { categoriaId: data.categoriaId }),
        ...(data.imagenUrl !== undefined && { imagenUrl: data.imagenUrl || null }),
        ...(data.activo !== undefined && { activo: data.activo }),
        ...(data.listoPorDefault !== undefined && { listoPorDefault: data.listoPorDefault }),
      },
      include: {
        categoria: true,
      },
    })

    // Registrar auditoría
    await prisma.auditoria.create({
      data: {
        restauranteId: user.restauranteId,
        usuarioId: user.id,
        accion: 'ACTUALIZAR_PRODUCTO',
        entidad: 'Producto',
        entidadId: producto.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: producto,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error en PATCH /api/productos/[id]:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
