import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth'
import { tienePermiso } from '@/lib/permisos'
import { z } from 'zod'

const updateMesaSchema = z.object({
  estado: z.enum(['LIBRE', 'OCUPADA', 'CUENTA_PEDIDA', 'RESERVADA']).optional(),
  piso: z.string().nullable().optional(),
  posicionX: z.number().min(0).max(10000).optional(),
  posicionY: z.number().min(0).max(10000).optional(),
  rotacion: z.number().min(0).max(360).optional(),
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

    const body = await request.json()
    const data = updateMesaSchema.parse(body)

    const mesa = await prisma.mesa.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json({
      success: true,
      data: mesa,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error en PATCH /api/mesas/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(getTokenFromRequest(_request))
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    if (!tienePermiso(user, 'mesas')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para eliminar mesas' },
        { status: 403 }
      )
    }

    const mesa = await prisma.mesa.findUnique({
      where: { id: params.id },
      include: {
        comandas: {
          where: { estado: { notIn: ['PAGADO', 'CANCELADO'] } },
          take: 1,
        },
      },
    })

    if (!mesa) {
      return NextResponse.json(
        { success: false, error: 'Mesa no encontrada' },
        { status: 404 }
      )
    }

    if (mesa.comandas.length > 0) {
      return NextResponse.json(
        { success: false, error: 'No se puede borrar: la mesa tiene una comanda activa. Cierra o cancela la comanda primero.' },
        { status: 400 }
      )
    }

    await prisma.mesa.update({
      where: { id: params.id },
      data: { activa: false },
    })

    await prisma.auditoria.create({
      data: {
        usuarioId: user.id,
        accion: 'ELIMINAR_MESA',
        entidad: 'Mesa',
        entidadId: params.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error en DELETE /api/mesas/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}








