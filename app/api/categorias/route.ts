import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { z } from 'zod'

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
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const categorias = await prisma.categoria.findMany({
      where: {
        restauranteId: user.restauranteId,
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
    console.error('Error en GET /api/categorias:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    if (!tienePermiso(user, 'carta')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para crear categorías' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = createCategoriaSchema.parse(body)

    // Verificar si ya existe una categoría con ese nombre
    const categoriaExistente = await prisma.categoria.findFirst({
      where: {
        restauranteId: user.restauranteId,
        nombre: data.nombre,
        activa: true,
      },
    })

    if (categoriaExistente) {
      return NextResponse.json(
        { success: false, error: 'Ya existe una categoría con ese nombre' },
        { status: 400 }
      )
    }

    // Obtener el máximo orden para poner la nueva categoría al final
    const maxOrden = await prisma.categoria.aggregate({
      where: { restauranteId: user.restauranteId },
      _max: {
        orden: true,
      },
    })

    const categoria = await prisma.categoria.create({
      data: {
        restauranteId: user.restauranteId,
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error en POST /api/categorias:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}








