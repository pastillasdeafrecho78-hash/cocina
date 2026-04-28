import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMenuContext } from '@/lib/menu-context'
import { resolveDefaultKdsSeccionId } from '@/lib/kds'
import { z } from 'zod'
import { requireAuthenticatedUser, requireCapability } from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'

const prismaKds = prisma as any

const imagenSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      value.length === 0 ||
      /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(value) ||
      z.string().url().safeParse(value).success,
    'Imagen inválida: usa URL pública o data:image base64'
  )

const updateProductoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').optional(),
  descripcion: z.string().optional(),
  precio: z.number().positive('El precio debe ser mayor a 0').optional(),
  categoriaId: z.string().min(1, 'La categoría es requerida').optional(),
  kdsSeccionId: z.string().min(1).optional().nullable(),
  imagenUrl: imagenSchema.optional().or(z.literal('')),
  activo: z.boolean().optional(),
  listoPorDefault: z.boolean().optional(),
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
    const data = updateProductoSchema.parse(body)

    // Verificar que el producto existe
    const productoExistente = await prismaKds.producto.findFirst({
      where: {
        id: params.id,
        categoria: { restauranteId: menuCtx.menuRestauranteId },
      },
      include: { categoria: true },
    })

    if (!productoExistente) {
      raise(404, 'Producto no encontrado')
    }

    let nextCategoria = productoExistente.categoria
    if (data.categoriaId) {
      const categoria = await prisma.categoria.findFirst({
        where: { id: data.categoriaId, restauranteId: menuCtx.menuRestauranteId },
      })

      if (!categoria) {
        raise(404, 'Categoría no encontrada')
      }
      nextCategoria = categoria
    }

    let kdsSeccionId: string | null | undefined
    if (data.kdsSeccionId !== undefined) {
      kdsSeccionId = data.kdsSeccionId || null
      if (kdsSeccionId) {
        const kdsSeccion = await prismaKds.kdsSeccion.findFirst({
          where: { id: kdsSeccionId, restauranteId: menuCtx.menuRestauranteId, activa: true },
          select: { id: true },
        })
        if (!kdsSeccion) {
          raise(404, 'Sección KDS no encontrada')
        }
      }
    } else if (data.categoriaId && !productoExistente.kdsSeccionId) {
      kdsSeccionId = await resolveDefaultKdsSeccionId(menuCtx.menuRestauranteId, nextCategoria.tipo)
    }

    // Actualizar el producto
    const producto = await prismaKds.producto.update({
      where: { id: params.id },
      data: {
        ...(data.nombre && { nombre: data.nombre }),
        ...(data.descripcion !== undefined && { descripcion: data.descripcion || null }),
        ...(data.precio && { precio: data.precio }),
        ...(data.categoriaId && { categoriaId: data.categoriaId }),
        ...(kdsSeccionId !== undefined && { kdsSeccionId }),
        ...(data.imagenUrl !== undefined && { imagenUrl: data.imagenUrl || null }),
        ...(data.activo !== undefined && { activo: data.activo }),
        ...(data.listoPorDefault !== undefined && { listoPorDefault: data.listoPorDefault }),
      },
      include: {
        categoria: true,
        kdsSeccion: true,
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
    return toErrorResponse(error, 'Error interno del servidor', 'Error en PATCH /api/productos/[id]:')
  }
}
