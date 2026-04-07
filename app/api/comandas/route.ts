import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { generarNumeroComanda, calcularTotal, getDestinoFromCategoria } from '@/lib/comanda-helpers'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createComandaSchema = z.object({
  mesaId: z.string().optional(),
  clienteId: z.string().optional(),
  tipoPedido: z.enum(['EN_MESA', 'PARA_LLEVAR', 'A_DOMICILIO', 'WHATSAPP']),
  items: z.array(
    z.object({
      productoId: z.string(),
      tamanoId: z.string().optional(),
      cantidad: z.number().int().positive(),
      modificadores: z.array(z.string()).optional(),
      notas: z.string().optional(),
    })
  ),
  observaciones: z.string().optional(),
})

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')
    const mesaId = searchParams.get('mesaId')
    const numeroComanda = searchParams.get('numeroComanda')
    const fechaInicio = searchParams.get('fechaInicio')
    const fechaFin = searchParams.get('fechaFin')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const rid = user.restauranteId
    const where: any = { restauranteId: rid }
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
    
    // Filtros de fecha: para PAGADO usar fechaCompletado (fecha de pago); si no, fechaCreacion
    if (fechaInicio || fechaFin) {
      const inicio = fechaInicio ? new Date(fechaInicio) : null
      const fin = fechaFin ? new Date(fechaFin) : null
      const esPagado =
        estado === 'PAGADO' || (typeof estado === 'string' && estado.includes('PAGADO'))
      if (esPagado && (inicio || fin)) {
        const rango = {} as { gte?: Date; lte?: Date }
        if (inicio) rango.gte = inicio
        if (fin) rango.lte = fin
        where.OR = [
          { fechaCompletado: rango },
          { fechaCompletado: null, fechaCreacion: rango },
        ]
      } else {
        where.fechaCreacion = {}
        if (inicio) where.fechaCreacion.gte = inicio
        if (fin) where.fechaCreacion.lte = fin
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
          canceladoPor: {
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
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Error en GET /api/comandas:', error)
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
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Verificar permisos
    if (!tienePermiso(user, 'comandas')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = createComandaSchema.parse(body)
    const rid = user.restauranteId

    if (data.mesaId) {
      const mesaOk = await prisma.mesa.findFirst({
        where: { id: data.mesaId, restauranteId: rid, activa: true },
      })
      if (!mesaOk) {
        return NextResponse.json(
          { success: false, error: 'Mesa no válida' },
          { status: 400 }
        )
      }
    }
    if (data.clienteId) {
      const cli = await prisma.cliente.findFirst({
        where: { id: data.clienteId, restauranteId: rid },
      })
      if (!cli) {
        return NextResponse.json(
          { success: false, error: 'Cliente no válido' },
          { status: 400 }
        )
      }
    }

    const productos = await prisma.producto.findMany({
      where: {
        id: { in: data.items.map((item) => item.productoId) },
        activo: true,
        categoria: { restauranteId: rid },
      },
      include: {
        categoria: true,
        tamanos: true,
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

      const tieneTamanos = producto.tamanos && producto.tamanos.length > 0

      if (tieneTamanos && !itemData.tamanoId) {
        throw new Error(`El producto "${producto.nombre}" requiere selección de tamaño`)
      }
      if (!tieneTamanos && itemData.tamanoId) {
        throw new Error(`El producto "${producto.nombre}" no tiene tamaños configurados`)
      }

      let precioBase = producto.precio
      let tamanoId: string | undefined
      if (itemData.tamanoId) {
        const tamano = producto.tamanos.find((t) => t.id === itemData.tamanoId)
        if (!tamano) {
          throw new Error(`Tamaño no válido para el producto "${producto.nombre}"`)
        }
        precioBase = tamano.precio
        tamanoId = tamano.id
      }

      // Calcular precio de modificadores (excluyendo TAMANO, ya manejado por ProductoTamano)
      let precioModificadores = 0
      const itemModificadores = []
      if (itemData.modificadores && itemData.modificadores.length > 0) {
        for (const modificadorId of itemData.modificadores) {
          const modificador = await prisma.modificador.findFirst({
            where: { id: modificadorId, restauranteId: rid },
          })
          if (modificador && modificador.tipo !== 'TAMANO') {
            precioModificadores += modificador.precioExtra || 0
            itemModificadores.push({
              modificadorId: modificador.id,
              precioExtra: modificador.precioExtra || 0,
            })
          }
        }
      }

      const precioUnitario = precioBase + precioModificadores
      const subtotal = itemData.cantidad * precioUnitario
      const listoPorDefault = 'listoPorDefault' in producto && producto.listoPorDefault === true

      const item: {
        productoId: string
        tamanoId?: string
        cantidad: number
        precioUnitario: number
        subtotal: number
        notas?: string
        destino: 'COCINA' | 'BARRA'
        numeroRonda: number
        estado?: 'PENDIENTE' | 'LISTO'
        fechaListo?: Date
        modificadores: { create: { modificadorId: string; precioExtra: number }[] }
      } = {
        productoId: producto.id,
        tamanoId: tamanoId || undefined,
        cantidad: itemData.cantidad,
        precioUnitario,
        subtotal,
        notas: itemData.notas,
        destino: getDestinoFromCategoria(producto.categoria.tipo),
        numeroRonda: 1,
        modificadores: {
          create: itemModificadores,
        },
      }
      if (listoPorDefault) {
        item.estado = 'LISTO'
        item.fechaListo = new Date()
      }
      comandaItems.push(item)
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

    const numeroComanda = await generarNumeroComanda(rid)
    const comanda = await prisma.comanda.create({
      data: {
        restauranteId: rid,
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
        restauranteId: rid,
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
