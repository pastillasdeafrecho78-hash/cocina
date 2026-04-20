import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireAnyCapability,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

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
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['tables.view', 'tables.manage', 'mesas', 'comandas', 'orders.manage'])
    const tenant = requireActiveTenant(user)

    const body = await request.json()
    const data = updateMesaSchema.parse(body)

    const existente = await prisma.mesa.findFirst({
      where: { id: params.id, restauranteId: tenant.restauranteId },
    })
    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Mesa no encontrada' },
        { status: 404 }
      )
    }

    const mesa = await prisma.mesa.update({
      where: { id: existente.id },
      data,
    })

    return NextResponse.json({
      success: true,
      data: mesa,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en PATCH /api/mesas/[id]:')
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['tables.manage', 'mesas'])
    const tenant = requireActiveTenant(user)

    const mesa = await prisma.mesa.findFirst({
      where: { id: params.id, restauranteId: tenant.restauranteId },
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
      where: { id: mesa.id },
      data: { activa: false },
    })

    await prisma.auditoria.create({
      data: {
        restauranteId: tenant.restauranteId,
        usuarioId: user.id,
        accion: 'ELIMINAR_MESA',
        entidad: 'Mesa',
        entidadId: params.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en DELETE /api/mesas/[id]:')
  }
}








