import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMenuContext } from '@/lib/menu-context'
import { z } from 'zod'
import { requireAuthenticatedUser, requireCapability } from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'

const createProductoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().optional(),
  precio: z.number().positive('El precio debe ser mayor a 0'),
  categoriaId: z.string().min(1, 'La categoría es requerida'),
  imagenUrl: z.string().url().optional().or(z.literal('')),
  activo: z.boolean().optional().default(true),
  listoPorDefault: z.boolean().optional().default(false),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'menu.view')

    const menuCtx = await getMenuContext(user.restauranteId)
    if (!menuCtx) {
      raise(404, 'Sucursal no encontrada')
    }

    const { searchParams } = new URL(request.url)
    const categoriaId = searchParams.get('categoriaId')
    const tipo = searchParams.get('tipo') as any
    const activo = searchParams.get('activo')

    const where: any = {}
    if (categoriaId) where.categoriaId = categoriaId
    if (tipo) {
      where.categoria = { tipo, restauranteId: menuCtx.menuRestauranteId }
    }
    where.categoria = {
      ...(where.categoria ?? {}),
      restauranteId: menuCtx.menuRestauranteId,
    }
    // Solo filtrar por activo si se pasa explícitamente el parámetro
    // Si no se pasa, traer todos los productos (para gestión de carta)
    if (activo !== null) {
      where.activo = activo === 'true'
    }
    // Si no se especifica, no filtrar (traer todos)

    const productos = await prisma.producto.findMany({
      where,
      include: {
        categoria: true,
        modificadores: {
          include: {
            modificador: true,
          },
        },
        tamanos: { orderBy: { orden: 'asc' } },
      },
      orderBy: {
        categoria: {
          orden: 'asc',
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: productos,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/productos:')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'menu.manage')

    const menuCtx = await getMenuContext(user.restauranteId)
    if (!menuCtx) {
      raise(404, 'Sucursal no encontrada')
    }
    if (menuCtx.isSharedConsumer) {
      raise(
        409,
        'Esta sucursal usa carta compartida. No puedes editarla directamente; usa la sucursal fuente o clona la carta.'
      )
    }

    const body = await request.json()
    const data = createProductoSchema.parse(body)

    // Verificar que la categoría existe
    const categoria = await prisma.categoria.findFirst({
      where: { id: data.categoriaId, restauranteId: menuCtx.menuRestauranteId },
    })

    if (!categoria) {
      raise(404, 'Categoría no encontrada')
    }

    // Crear el producto
    const producto = await prisma.producto.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        precio: data.precio,
        categoriaId: data.categoriaId,
        imagenUrl: data.imagenUrl || null,
        activo: data.activo ?? true,
        listoPorDefault: data.listoPorDefault ?? false,
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
        accion: 'CREAR_PRODUCTO',
        entidad: 'Producto',
        entidadId: producto.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: producto,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/productos:')
  }
}








