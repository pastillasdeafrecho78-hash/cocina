import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth'
import { tienePermiso } from '@/lib/permisos'
import { z } from 'zod'

const updateTamanoSchema = z.object({
  nombre: z.string().min(1).optional(),
  precio: z.number().positive().optional(),
  orden: z.number().int().optional(),
})

/**
 * PATCH /api/productos/[id]/tamanos/[tamanoId]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; tamanoId: string } }
) {
  try {
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'carta')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const tamano = await prisma.productoTamano.findFirst({
      where: {
        id: params.tamanoId,
        productoId: params.id,
        producto: { categoria: { restauranteId: user.restauranteId } },
      },
    })
    if (!tamano) {
      return NextResponse.json({ success: false, error: 'Tamaño no encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const data = updateTamanoSchema.parse(body)

    const actualizado = await prisma.productoTamano.update({
      where: { id: params.tamanoId },
      data: {
        ...(data.nombre != null && { nombre: data.nombre.trim() }),
        ...(data.precio != null && { precio: data.precio }),
        ...(data.orden != null && { orden: data.orden }),
      },
    })

    return NextResponse.json({ success: true, data: actualizado })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error en PATCH /api/productos/[id]/tamanos/[tamanoId]:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/productos/[id]/tamanos/[tamanoId]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; tamanoId: string } }
) {
  try {
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'carta')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const tamano = await prisma.productoTamano.findFirst({
      where: {
        id: params.tamanoId,
        productoId: params.id,
        producto: { categoria: { restauranteId: user.restauranteId } },
      },
    })
    if (!tamano) {
      return NextResponse.json({ success: false, error: 'Tamaño no encontrado' }, { status: 404 })
    }

    await prisma.productoTamano.delete({
      where: { id: params.tamanoId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error en DELETE /api/productos/[id]/tamanos/[tamanoId]:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
