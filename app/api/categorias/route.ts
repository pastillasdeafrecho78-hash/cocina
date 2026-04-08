import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { requireAuthenticatedUser, requireCapability } from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'
import { resolveEffectiveMenu } from '@/lib/menu-effective'

const createCategoriaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().optional(),
  tipo: z.enum(['COMIDA', 'BEBIDA', 'POSTRE', 'ENTRADA']),
  orden: z.number().int().optional().default(0),
  activa: z.boolean().optional().default(true),
})

const updateCategoriaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').optional(),
  descripcion: z.string().optional(),
  tipo: z.enum(['COMIDA', 'BEBIDA', 'POSTRE', 'ENTRADA']).optional(),
  orden: z.number().int().optional(),
  activa: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'menu.view')

    const menuCtx = await resolveEffectiveMenu(user.restauranteId)

    const categorias = await prisma.categoria.findMany({
      where: {
        restauranteId: menuCtx.menuRestauranteId,
        activa: true,
      },
      include: {
        productos: {
          where: {
            activo: true,
          },
          include: {
            modificadores: {
              include: {
                modificador: true,
              },
            },
            tamanos: { orderBy: { orden: 'asc' } },
          },
        },
        modificadores: {
          include: {
            modificador: true,
          },
        },
      },
      orderBy: {
        orden: 'asc',
      },
    })

    return NextResponse.json({
      success: true,
      data: categorias,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/categorias:')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'menu.manage')

    const menuCtx = await resolveEffectiveMenu(user.restauranteId)
    if (menuCtx.isSharedConsumer) {
      raise(
        409,
        'Esta sucursal usa carta compartida. No puedes editarla directamente; usa la sucursal fuente o clona la carta.'
      )
    }

    const body = await request.json()
    const data = createCategoriaSchema.parse(body)

    // Verificar si ya existe una categoría con ese nombre
    const categoriaExistente = await prisma.categoria.findFirst({
      where: {
        restauranteId: menuCtx.menuRestauranteId,
        nombre: data.nombre,
        activa: true,
      },
    })

    if (categoriaExistente) {
      raise(400, 'Ya existe una categoría con ese nombre')
    }

    // Obtener el máximo orden para poner la nueva categoría al final
    const maxOrden = await prisma.categoria.aggregate({
      where: { restauranteId: menuCtx.menuRestauranteId },
      _max: {
        orden: true,
      },
    })

    const categoria = await prisma.categoria.create({
      data: {
        restauranteId: menuCtx.menuRestauranteId,
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        tipo: data.tipo,
        orden: data.orden ?? (maxOrden._max.orden ?? 0) + 1,
        activa: data.activa ?? true,
      },
    })

    // Registrar auditoría
    await prisma.auditoria.create({
      data: {
        restauranteId: user.restauranteId,
        usuarioId: user.id,
        accion: 'CREAR_CATEGORIA',
        entidad: 'Categoria',
        entidadId: categoria.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: categoria,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/categorias:')
  }
}








