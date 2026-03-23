import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth'
import { tienePermiso } from '@/lib/permisos'
import { z } from 'zod'

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
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const plantas = await prisma.plantaRestaurante.findMany({
      where: {
        restauranteId: user.restauranteId,
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
    console.error('Error en GET /api/plantas:', error)
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

    if (!tienePermiso(user, 'mesas')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para crear plantas' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = createPlantaSchema.parse(body)

    // Validar que el polígono esté cerrado
    if (data.edges && data.edges.length < data.vertices.length) {
      return NextResponse.json(
        { success: false, error: 'El polígono debe estar cerrado' },
        { status: 400 }
      )
    }

    const planta = await prisma.plantaRestaurante.create({
      data: {
        restauranteId: user.restauranteId,
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
        restauranteId: user.restauranteId,
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error en POST /api/plantas:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
