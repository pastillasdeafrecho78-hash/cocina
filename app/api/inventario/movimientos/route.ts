import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'
import { calcularMovimientoInventario } from '@/lib/inventario/movimientos'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const prismaInventario = prisma as any
const INVENTARIO_VIEW = ['inventory.view', 'inventory.manage', 'settings.manage', 'configuracion']
const INVENTARIO_MANAGE = ['inventory.manage', 'settings.manage', 'configuracion']

const movimientoSchema = z.object({
  articuloId: z.string().min(1),
  tipo: z.enum(['ENTRADA', 'AJUSTE_ABSOLUTO']),
  cantidad: z.number().optional(),
  stockFinal: z.number().optional(),
  costoUnitario: z.number().min(0).optional().nullable(),
  proveedor: z.string().trim().optional().nullable(),
  referencia: z.string().trim().optional().nullable(),
  notas: z.string().trim().optional().nullable(),
  fechaCaducidad: z.string().datetime().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, INVENTARIO_VIEW)
    const tenant = requireActiveTenant(user)

    const { searchParams } = new URL(request.url)
    const articuloId = searchParams.get('articuloId')

    const movimientos = await prismaInventario.inventarioMovimiento.findMany({
      where: {
        restauranteId: tenant.restauranteId,
        ...(articuloId && { articuloId }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        articulo: true,
        usuario: {
          select: { id: true, nombre: true, apellido: true },
        },
      },
    })

    return NextResponse.json({ success: true, data: movimientos })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/inventario/movimientos:')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, INVENTARIO_MANAGE)
    const tenant = requireActiveTenant(user)
    const data = movimientoSchema.parse(await request.json())

    const result = await prisma.$transaction(async (tx) => {
      const db = tx as any
      const articulo = await db.inventarioArticulo.findFirst({
        where: { id: data.articuloId, restauranteId: tenant.restauranteId, activo: true },
      })
      if (!articulo) raise(404, 'Artículo de inventario no encontrado')

      const calculado = calcularMovimientoInventario({
        tipo: data.tipo,
        stockActual: articulo.stockActual,
        cantidad: data.cantidad,
        stockFinal: data.stockFinal,
      })

      const movimiento = await db.inventarioMovimiento.create({
        data: {
          restauranteId: tenant.restauranteId,
          articuloId: articulo.id,
          tipo: calculado.tipo,
          cantidad: calculado.cantidad,
          stockAntes: calculado.stockAntes,
          stockDespues: calculado.stockDespues,
          costoUnitario: data.costoUnitario ?? null,
          proveedor: data.proveedor || null,
          referencia: data.referencia || null,
          notas: data.notas || null,
          usuarioId: user.id,
        },
      })

      const articuloActualizado = await db.inventarioArticulo.update({
        where: { id: articulo.id },
        data: {
          stockActual: calculado.stockDespues,
          ...(data.fechaCaducidad !== undefined && {
            fechaCaducidad: data.fechaCaducidad ? new Date(data.fechaCaducidad) : null,
          }),
        },
      })

      return { movimiento, articulo: articuloActualizado }
    })

    await prisma.auditoria
      .create({
        data: {
          restauranteId: tenant.restauranteId,
          usuarioId: user.id,
          accion: 'CREAR_INVENTARIO_MOVIMIENTO',
          entidad: 'InventarioMovimiento',
          entidadId: result.movimiento.id,
          detalles: {
            articuloId: result.articulo.id,
            tipo: result.movimiento.tipo,
            stockAntes: result.movimiento.stockAntes,
            stockDespues: result.movimiento.stockDespues,
          },
        },
      })
      .catch((error) => console.warn('No se pudo registrar auditoría de inventario:', error))

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/inventario/movimientos:')
  }
}
