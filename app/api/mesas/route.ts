import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth'
import { tienePermiso } from '@/lib/permisos'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createMesaSchema = z.object({
  numero: z.number().int().positive(),
  capacidad: z.number().int().positive(),
  ubicacion: z.string().optional(),
  piso: z.string().optional(),
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

    const mesas = await prisma.mesa.findMany({
      where: {
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
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Error en GET /api/mesas:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        debug: msg,
      },
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
        { success: false, error: 'Sin permisos para crear mesas' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = createMesaSchema.parse(body)

    const mesaExistente = await prisma.mesa.findUnique({
      where: { numero: data.numero },
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error en POST /api/mesas:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}








