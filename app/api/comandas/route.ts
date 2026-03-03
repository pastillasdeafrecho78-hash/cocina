import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth'
import { generarNumeroComanda, calcularTotal, getDestinoFromCategoria } from '@/lib/comanda-helpers'
import { z } from 'zod'

const createComandaSchema = z.object({
  mesaId: z.string().optional(),
  clienteId: z.string().optional(),
  tipoPedido: z.enum(['EN_MESA', 'PARA_LLEVAR', 'A_DOMICILIO', 'WHATSAPP']),
  items: z.array(
    z.object({
      productoId: z.string(),
      cantidad: z.number().int().positive(),
      modificadores: z.array(z.string()).optional(),
      notas: z.string().optional(),
    })
  ),
  observaciones: z.string().optional(),
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

    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')
    const mesaId = searchParams.get('mesaId')
    const numeroComanda = searchParams.get('numeroComanda')
    const fechaInicio = searchParams.get('fechaInicio')
    const fechaFin = searchParams.get('fechaFin')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = {}
    if (estado) {
      // Si hay múltiples estados separados por coma
      if (estado.includes(',')) {
        where.estado = { in: estado.split(',').map((e: string) => e.trim()) }
      } else {
        where.estado = estado
      }
    }
    if (mesaId) where.mesaId = mesaId
    if (numeroComanda) where.numeroComanda = numeroComanda
    
    // Filtros de fecha
    if (fechaInicio || fechaFin) {
      where.fechaCreacion = {}
      if (fechaInicio) {
        where.fechaCreacion.gte = new Date(fechaInicio)
      }
      if (fechaFin) {
        where.fechaCreacion.lte = new Date(fechaFin)
      }
    }

    const [comandas, total] = await Promise.all([
      prisma.comanda.findMany({
        where,
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
        },
        orderBy: { fechaCreacion: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.comanda.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: comandas,
      total,
      page,
      limit,
    })
  } catch (error) {
    console.error('Error en GET /api/comandas:', error)
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

    // Verificar permisos
    if (!['MESERO', 'ADMIN', 'GERENTE'].includes(user.rol)) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = createComandaSchema.parse(body)

    // Obtener productos con sus categorías
    const productos = await prisma.producto.findMany({
      where: {
        id: { in: data.items.map((item) => item.productoId) },
        activo: true,
      },
      include: {
        categoria: true,
        modificadores: {
          include: {
            modificador: true,
          },
        },
      },
    })

    // Crear items de comanda
    const comandaItems = []
    for (const itemData of data.items) {
      const producto = productos.find((p) => p.id === itemData.productoId)
      if (!producto) {
        throw new Error(`Producto ${itemData.productoId} no encontrado`)
      }

      // Calcular precio de modificadores
      let precioModificadores = 0
      const itemModificadores = []

      if (itemData.modificadores && itemData.modificadores.length > 0) {
        for (const modificadorId of itemData.modificadores) {
          const modificador = await prisma.modificador.findUnique({
            where: { id: modificadorId },
          })

          if (modificador) {
            precioModificadores += modificador.precioExtra || 0
            itemModificadores.push({
              modificadorId: modificador.id,
              precioExtra: modificador.precioExtra || 0,
            })
          }
        }
      }

      const precioUnitario = producto.precio
      const subtotal = itemData.cantidad * (precioUnitario + precioModificadores)

      comandaItems.push({
        productoId: producto.id,
        cantidad: itemData.cantidad,
        precioUnitario,
        subtotal,
        notas: itemData.notas,
        destino: getDestinoFromCategoria(producto.categoria.tipo),
        modificadores: {
          create: itemModificadores,
        },
      })
    }

    // Calcular total
    const total = calcularTotal(
      comandaItems.map((item) => ({
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        precioModificadores: 0, // Ya incluido en subtotal
      }))
    )

    // Actualizar estado de mesa si existe
    if (data.mesaId) {
      await prisma.mesa.update({
        where: { id: data.mesaId },
        data: { estado: 'OCUPADA' },
      })
    }

    // Crear comanda
    const numeroComanda = await generarNumeroComanda()
    const comanda = await prisma.comanda.create({
      data: {
        numeroComanda,
        mesaId: data.mesaId,
        clienteId: data.clienteId,
        tipoPedido: data.tipoPedido,
        total,
        observaciones: data.observaciones,
        creadoPorId: user.id,
        items: {
          create: comandaItems,
        },
        historial: {
          create: {
            accion: 'CREADA',
            descripcion: `Comanda creada por ${user.nombre} ${user.apellido}`,
            usuarioId: user.id,
          },
        },
      },
      include: {
        mesa: true,
        items: {
          include: {
            producto: {
              include: {
                categoria: true,
              },
            },
            modificadores: {
              include: {
                modificador: true,
              },
            },
          },
        },
      },
    })

    // Registrar auditoría
    await prisma.auditoria.create({
      data: {
        usuarioId: user.id,
        accion: 'CREAR_COMANDA',
        entidad: 'Comanda',
        entidadId: comanda.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: comanda,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error en POST /api/comandas:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
