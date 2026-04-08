import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'

const createPlantaSchema = z.object({
  nombre: z.string().min(1),
  vertices: z.array(
    z.object({
      x: z.number(),
      y: z.number(),
    })
  ).min(3),
  edges: z.array(
    z.object({
      from: z.number(),
      to: z.number(),
    })
  ).optional(),
  cellSizeM: z.number().positive().default(1.0),
  originX: z.number().default(0),
  originY: z.number().default(0),
  widthM: z.number().optional(),
  heightM: z.number().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['mesas', 'comandas', 'reportes', 'caja'])
    const tenant = requireActiveTenant(user)

    const plantas = await prisma.plantaRestaurante.findMany({
      where: {
        restauranteId: tenant.restauranteId,
        activa: true,
      },
      include: {
        mesas: {
          where: {
            activa: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      data: plantas,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/plantas:')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'mesas')
    const tenant = requireActiveTenant(user)

    const body = await request.json()
    const data = createPlantaSchema.parse(body)

    // Validar que el polígono esté cerrado
    if (data.edges && data.edges.length < data.vertices.length) {
      raise(400, 'El polígono debe estar cerrado')
    }

    const planta = await prisma.plantaRestaurante.create({
      data: {
        restauranteId: tenant.restauranteId,
        nombre: data.nombre,
        vertices: data.vertices as any,
        edges: (data.edges || []) as any,
        cellSizeM: data.cellSizeM,
        originX: data.originX,
        originY: data.originY,
        widthM: data.widthM || null,
        heightM: data.heightM || null,
        activa: true,
      },
    })

    // Registrar auditoría
    await prisma.auditoria.create({
      data: {
        restauranteId: tenant.restauranteId,
        usuarioId: user.id,
        accion: 'CREAR_PLANTA',
        entidad: 'PlantaRestaurante',
        entidadId: planta.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: planta,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/plantas:')
  }
}
