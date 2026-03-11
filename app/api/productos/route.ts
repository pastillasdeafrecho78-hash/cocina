import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth'
import { tienePermiso } from '@/lib/permisos'
import { z } from 'zod'

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
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const categoriaId = searchParams.get('categoriaId')
    const tipo = searchParams.get('tipo') as any
    const activo = searchParams.get('activo')

    const where: any = {}
    if (categoriaId) where.categoriaId = categoriaId
    if (tipo) {
      where.categoria = { tipo }
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
    console.error('Error en GET /api/productos:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    if (!tienePermiso(user, 'carta')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para crear productos' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = createProductoSchema.parse(body)

    // Verificar que la categoría existe
    const categoria = await prisma.categoria.findUnique({
      where: { id: data.categoriaId },
    })

    if (!categoria) {
      return NextResponse.json(
        { success: false, error: 'Categoría no encontrada' },
        { status: 404 }
      )
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error en POST /api/productos:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}








