import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'
import { normalizeMesaLayout } from '@/lib/mesas/layout'
import {
  findMesaByNumeroForTenant,
  mesaNumeroConflictMessage,
} from '@/lib/mesas/tenant'

export const dynamic = 'force-dynamic'
const prismaMesas = prisma as any

const createMesaSchema = z.object({
  numero: z.number().int().positive(),
  capacidad: z.number().int().positive(),
  ubicacion: z.string().optional(),
  piso: z.string().optional(),
  forma: z.enum(['RECTANGULAR', 'CIRCULAR']).optional(),
  ancho: z.number().min(0.75).max(6).optional(),
  alto: z.number().min(0.75).max(6).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['tables.view', 'mesas', 'comandas', 'reportes', 'caja'])
    const tenant = requireActiveTenant(user)

    const mesas = await prisma.mesa.findMany({
      where: {
        restauranteId: tenant.restauranteId,
        activa: true,
      },
      include: {
        publicLink: {
          select: {
            id: true,
            activa: true,
            updatedAt: true,
          },
        },
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
            asignadoA: {
              select: { id: true, nombre: true, apellido: true },
            },
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
        hasPublicLink: Boolean(mesa.publicLink?.activa),
        comandaActual: {
          numeroComanda: comanda.numeroComanda,
          total: comanda.total,
          fechaCreacion: comanda.fechaCreacion,
          totalItems,
          itemsEntregados,
          allItemsEntregados,
          waitStartFrom,
          asignadoA: comanda.asignadoA
            ? {
                id: comanda.asignadoA.id,
                nombre: comanda.asignadoA.nombre,
                apellido: comanda.asignadoA.apellido,
              }
            : null,
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
    requireAnyCapability(user, ['tables.manage', 'mesas'])
    const tenant = requireActiveTenant(user)

    const body = await request.json()
    const data = createMesaSchema.parse(body)
    const layout = normalizeMesaLayout({
      forma: data.forma,
      ancho: data.ancho,
      alto: data.alto,
    })

    const rid = tenant.restauranteId
    const mesaExistente = await findMesaByNumeroForTenant(prisma, {
      restauranteId: rid,
      numero: data.numero,
    })

    if (mesaExistente?.activa) {
      return NextResponse.json(
        { success: false, error: mesaNumeroConflictMessage(data.numero) },
        { status: 409 }
      )
    }

    let mesa
    if (mesaExistente) {
      // Reactivar mesa borrada (soft delete) con el mismo número
      mesa = await prismaMesas.mesa.update({
        where: { id: mesaExistente.id },
        data: {
          capacidad: data.capacidad,
          ubicacion: data.ubicacion ?? null,
          piso: data.piso ?? null,
          forma: layout.forma,
          ancho: layout.ancho,
          alto: layout.alto,
          estado: 'LIBRE',
          activa: true,
        },
      })
    } else {
      mesa = await prismaMesas.mesa.create({
        data: {
          restauranteId: rid,
          numero: data.numero,
          capacidad: data.capacidad,
          ubicacion: data.ubicacion || null,
          piso: data.piso ?? null,
          forma: layout.forma,
          ancho: layout.ancho,
          alto: layout.alto,
          estado: 'LIBRE',
          activa: true,
        },
      })
    }

    // La mesa no debe fallar por una auditoría incidental.
    try {
      await prisma.auditoria.create({
        data: {
          restauranteId: tenant.restauranteId,
          usuarioId: user.id,
          accion: 'CREAR_MESA',
          entidad: 'Mesa',
          entidadId: mesa.id,
        },
      })
    } catch (auditError) {
      console.error('Warning auditoría POST /api/mesas:', auditError)
    }

    return NextResponse.json({
      success: true,
      data: mesa,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error('Error en POST /api/mesas [Prisma]', error.code, error.meta)
      if (error.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'Ya existe una mesa con ese número en esta sucursal' },
          { status: 409 }
        )
      }
      if (error.code === 'P2003') {
        return NextResponse.json(
          { success: false, error: 'No se pudo validar la sucursal o el usuario activo' },
          { status: 409 }
        )
      }
    }
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/mesas:')
  }
}





