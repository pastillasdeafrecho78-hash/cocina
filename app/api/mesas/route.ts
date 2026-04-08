import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

export const dynamic = 'force-dynamic'

const createMesaSchema = z.object({
  numero: z.number().int().positive(),
  capacidad: z.number().int().positive(),
  ubicacion: z.string().optional(),
  piso: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['mesas', 'comandas', 'reportes', 'caja'])
    const tenant = requireActiveTenant(user)

    const mesas = await prisma.mesa.findMany({
      where: {
        restauranteId: tenant.restauranteId,
        activa: true,
      },
      include: {
        comandas: {
          where: {
            estado: {
              notIn: ['PAGADO', 'CANCELADO'],
            },
          },
          orderBy: {
            fechaCreacion: 'desc',
          },
          take: 1,
          include: {
            items: {
              select: { estado: true, createdAt: true },
            },
          },
        },
      },
      orderBy: {
        numero: 'asc',
      },
    })

    // Agregar información de comanda actual a cada mesa
    const mesasConComanda = mesas.map((mesa) => {
      const comanda = mesa.comandas[0]
      if (!comanda) {
        return { ...mesa, comandaActual: null }
      }
      const items = comanda.items
      const totalItems = items.length
      const itemsEntregados = items.filter((i) => i.estado === 'ENTREGADO').length
      const allItemsEntregados = totalItems > 0 && itemsEntregados === totalItems
      const itemsPendientes = items.filter((i) => i.estado !== 'ENTREGADO')
      const waitStartFrom =
        itemsPendientes.length > 0
          ? new Date(
              Math.max(...itemsPendientes.map((i) => new Date(i.createdAt).getTime()))
            ).toISOString()
          : null
      return {
        ...mesa,
        comandaActual: {
          numeroComanda: comanda.numeroComanda,
          total: comanda.total,
          fechaCreacion: comanda.fechaCreacion,
          totalItems,
          itemsEntregados,
          allItemsEntregados,
          waitStartFrom,
        },
      }
    })

    return NextResponse.json({
      success: true,
      data: mesasConComanda,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/mesas:')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'mesas')
    const tenant = requireActiveTenant(user)

    const body = await request.json()
    const data = createMesaSchema.parse(body)

    const rid = tenant.restauranteId
    const mesaExistente = await prisma.mesa.findFirst({
      where: { restauranteId: rid, numero: data.numero },
    })

    if (mesaExistente?.activa) {
      return NextResponse.json(
        { success: false, error: 'Ya existe una mesa con ese número' },
        { status: 400 }
      )
    }

    let mesa
    if (mesaExistente) {
      // Reactivar mesa borrada (soft delete) con el mismo número
      mesa = await prisma.mesa.update({
        where: { id: mesaExistente.id },
        data: {
          capacidad: data.capacidad,
          ubicacion: data.ubicacion ?? null,
          piso: data.piso ?? null,
          estado: 'LIBRE',
          activa: true,
        },
      })
    } else {
      mesa = await prisma.mesa.create({
        data: {
          restauranteId: rid,
          numero: data.numero,
          capacidad: data.capacidad,
          ubicacion: data.ubicacion || null,
          piso: data.piso ?? null,
          estado: 'LIBRE',
          activa: true,
        },
      })
    }

    // Registrar auditoría
    await prisma.auditoria.create({
      data: {
        restauranteId: tenant.restauranteId,
        usuarioId: user.id,
        accion: 'CREAR_MESA',
        entidad: 'Mesa',
        entidadId: mesa.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: mesa,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/mesas:')
  }
}








