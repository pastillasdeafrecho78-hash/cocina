import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth'
import { tienePermiso } from '@/lib/permisos'
import { z } from 'zod'

const createTamanoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  precio: z.number().positive('El precio debe ser mayor a 0'),
  orden: z.number().int().optional().default(0),
})

/**
 * GET /api/productos/[id]/tamanos
 * Lista los tamaños de un producto
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const producto = await prisma.producto.findFirst({
      where: { id: params.id, categoria: { restauranteId: user.restauranteId } },
    })
    if (!producto) {
      return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 })
    }

    const tamanos = await prisma.productoTamano.findMany({
      where: { productoId: producto.id },
      orderBy: { orden: 'asc' },
    })

    return NextResponse.json({ success: true, data: tamanos })
  } catch (error) {
    console.error('Error en GET /api/productos/[id]/tamanos:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/productos/[id]/tamanos
 * Crea un tamaño para el producto
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'carta')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const producto = await prisma.producto.findFirst({
      where: { id: params.id, categoria: { restauranteId: user.restauranteId } },
    })
    if (!producto) {
      return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const data = createTamanoSchema.parse(body)

    const tamano = await prisma.productoTamano.create({
      data: {
        productoId: params.id,
        nombre: data.nombre.trim(),
        precio: data.precio,
        orden: data.orden,
      },
    })

    return NextResponse.json({ success: true, data: tamano })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error en POST /api/productos/[id]/tamanos:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
