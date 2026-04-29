import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'
import { registrarEventoItemSeguro } from '@/lib/tiempos/eventos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Asigna la comanda al usuario actual si aún no está tomada.
 * Si otro usuario ya la tiene, responde 409.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['comandas', 'cocina', 'barra'])
    const tenant = requireActiveTenant(user)

    const comanda = await prisma.comanda.findFirst({
      where: { id: params.id, restauranteId: tenant.restauranteId },
      select: {
        id: true,
        estado: true,
        asignadoAId: true,
        asignadoA: { select: { id: true, nombre: true, apellido: true } },
        items: { select: { id: true, productoId: true } },
      },
    })

    if (!comanda) {
      return NextResponse.json({ success: false, error: 'Comanda no encontrada' }, { status: 404 })
    }

    if (comanda.estado === 'PAGADO' || comanda.estado === 'CANCELADO') {
      return NextResponse.json(
        { success: false, error: 'No se puede tomar una comanda cerrada o cancelada' },
        { status: 400 }
      )
    }

    if (comanda.asignadoAId && comanda.asignadoAId !== user.id) {
      const nombre = comanda.asignadoA
        ? `${comanda.asignadoA.nombre} ${comanda.asignadoA.apellido}`.trim()
        : 'otro usuario'
      return NextResponse.json(
        {
          success: false,
          error: `Esta comanda ya está tomada por ${nombre}.`,
          code: 'already_assigned',
        },
        { status: 409 }
      )
    }

    if (comanda.asignadoAId === user.id) {
      const full = await prisma.comanda.findFirst({
        where: { id: params.id },
        include: {
          asignadoA: { select: { id: true, nombre: true, apellido: true } },
        },
      })
      return NextResponse.json({ success: true, data: full, alreadyAssigned: true })
    }

    const updated = await prisma.comanda.update({
      where: { id: params.id },
      data: { asignadoAId: user.id },
      include: {
        mesa: true,
        cliente: true,
        asignadoA: { select: { id: true, nombre: true, apellido: true } },
      },
    })

    await prisma.comandaHistorial.create({
      data: {
        comandaId: params.id,
        accion: 'ASIGNADA_USUARIO',
        descripcion: `Comanda tomada por ${user.nombre} ${user.apellido}`.trim(),
        usuarioId: user.id,
      },
    })

    await Promise.all(
      comanda.items.map((item) =>
        registrarEventoItemSeguro({
          restauranteId: tenant.restauranteId,
          comandaId: comanda.id,
          comandaItemId: item.id,
          productoId: item.productoId,
          usuarioId: user.id,
          tipo: 'TOMADO',
        })
      )
    )

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/comandas/[id]/tomar:')
  }
}
