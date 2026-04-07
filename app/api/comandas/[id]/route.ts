import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { z } from 'zod'

const updateComandaSchema = z.object({
  estado: z.enum(['PENDIENTE', 'EN_PREPARACION', 'LISTO', 'SERVIDO', 'PAGADO', 'CANCELADO']).optional(),
  propina: z.number().optional(),
  descuento: z.number().optional(),
  observaciones: z.string().optional(),
  motivoCancelacion: z.string().trim().min(1).max(2000).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }
    if (!tienePermiso(user, 'comandas') && !tienePermiso(user, 'reportes')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos' },
        { status: 403 }
      )
    }

    const comanda = await prisma.comanda.findFirst({
      where: { id: params.id, restauranteId: user.restauranteId },
      include: {
        mesa: true,
        cliente: true,
        items: {
          include: {
            producto: {
              include: {
                categoria: true,
              },
            },
            tamano: true,
            modificadores: {
              include: {
                modificador: true,
              },
            },
          },
        },
        creadoPor: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
        asignadoA: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
        historial: {
          orderBy: { fechaAccion: 'desc' },
          include: {
            usuario: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
              },
            },
          },
        },
      },
    })

    if (!comanda) {
      return NextResponse.json(
        { success: false, error: 'Comanda no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: comanda,
    })
  } catch (error) {
    console.error('Error en GET /api/comandas/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }
    if (!tienePermiso(user, 'comandas')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = updateComandaSchema.parse(body)

    const comanda = await prisma.comanda.findFirst({
      where: { id: params.id, restauranteId: user.restauranteId },
      include: {
        items: {
          include: {
            producto: {
              select: {
                listoPorDefault: true,
              },
            },
          },
        },
      },
    })

    if (!comanda) {
      return NextResponse.json(
        { success: false, error: 'Comanda no encontrada' },
        { status: 404 }
      )
    }

    const updateData: any = {}
    const cambios: string[] = []

    if (data.estado !== undefined && data.estado !== comanda.estado) {
      if (data.estado === 'CANCELADO') {
        if (!data.motivoCancelacion) {
          return NextResponse.json(
            { success: false, error: 'Debes escribir el motivo de cancelación' },
            { status: 400 }
          )
        }

        const tieneItemsNoCancelables = comanda.items.some((item) => {
          if (item.estado === 'EN_PREPARACION' || item.estado === 'ENTREGADO') return true
          if (item.estado === 'LISTO' && !item.producto.listoPorDefault) return true
          return false
        })

        if (tieneItemsNoCancelables) {
          return NextResponse.json(
            {
              success: false,
              error: 'No se puede cancelar: ya hay productos en preparación o listos para servir',
            },
            { status: 400 }
          )
        }

        updateData.motivoCancelacion = data.motivoCancelacion
        updateData.fechaCancelacion = new Date()
      }

      updateData.estado = data.estado
      cambios.push(`Estado: ${comanda.estado} → ${data.estado}`)

      if ((data.estado === 'PAGADO' || data.estado === 'CANCELADO') && comanda.mesaId) {
        // Liberar mesa
        await prisma.mesa.update({
          where: { id: comanda.mesaId! },
          data: { estado: 'LIBRE' },
        })
      }

      if (data.estado === 'LISTO') {
        updateData.fechaCompletado = new Date()
      }
    }

    if (data.propina !== undefined) {
      updateData.propina = data.propina
      cambios.push(`Propina: ${data.propina}%`)
    }

    if (data.descuento !== undefined) {
      updateData.descuento = data.descuento
      cambios.push(`Descuento: $${data.descuento}`)
    }

    if (data.observaciones !== undefined) {
      updateData.observaciones = data.observaciones
    }
    if (data.motivoCancelacion !== undefined && data.estado !== 'CANCELADO') {
      updateData.motivoCancelacion = data.motivoCancelacion
    }

    const updated = await prisma.comanda.update({
      where: { id: params.id },
      data: updateData,
      include: {
        mesa: true,
        items: {
          include: {
            producto: true,
          },
        },
      },
    })

    // Registrar en historial
    if (cambios.length > 0) {
      await prisma.comandaHistorial.create({
        data: {
          comandaId: params.id,
          accion: data.estado === 'CANCELADO' ? 'COMANDA_CANCELADA' : 'ACTUALIZADA',
          descripcion:
            data.estado === 'CANCELADO'
              ? data.motivoCancelacion
              : cambios.join(', '),
          usuarioId: user.id,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error en PATCH /api/comandas/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}








