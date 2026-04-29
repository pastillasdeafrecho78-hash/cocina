import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'
import { evaluarAlertasInventario } from '@/lib/inventario/movimientos'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const prismaInventario = prisma as any

const articuloSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido'),
  unidad: z.string().trim().min(1, 'La unidad es requerida'),
  sku: z.string().trim().optional().nullable(),
  categoria: z.string().trim().optional().nullable(),
  stockActual: z.number().min(0).optional(),
  stockMinimo: z.number().min(0).optional(),
  fechaCaducidad: z.string().datetime().optional().nullable(),
})

const INVENTARIO_VIEW = ['inventory.view', 'inventory.manage', 'settings.manage', 'configuracion']
const INVENTARIO_MANAGE = ['inventory.manage', 'settings.manage', 'configuracion']

function withAlertas(articulo: any) {
  return {
    ...articulo,
    alertas: evaluarAlertasInventario({
      stockActual: articulo.stockActual,
      stockMinimo: articulo.stockMinimo,
      fechaCaducidad: articulo.fechaCaducidad,
    }),
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, INVENTARIO_VIEW)
    const tenant = requireActiveTenant(user)

    const { searchParams } = new URL(request.url)
    const activo = searchParams.get('activo')
    const where: Record<string, unknown> = { restauranteId: tenant.restauranteId }
    if (activo !== null) where.activo = activo === 'true'

    const articulos = await prismaInventario.inventarioArticulo.findMany({
      where,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      include: {
        movimientos: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: articulos.map(withAlertas),
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/inventario/articulos:')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, INVENTARIO_MANAGE)
    const tenant = requireActiveTenant(user)

    const data = articuloSchema.parse(await request.json())
    const articulo = await prismaInventario.inventarioArticulo.create({
      data: {
        restauranteId: tenant.restauranteId,
        nombre: data.nombre,
        unidad: data.unidad,
        sku: data.sku || null,
        categoria: data.categoria || null,
        stockActual: data.stockActual ?? 0,
        stockMinimo: data.stockMinimo ?? 0,
        fechaCaducidad: data.fechaCaducidad ? new Date(data.fechaCaducidad) : null,
      },
    })

    await prisma.auditoria
      .create({
        data: {
          restauranteId: tenant.restauranteId,
          usuarioId: user.id,
          accion: 'CREAR_INVENTARIO_ARTICULO',
          entidad: 'InventarioArticulo',
          entidadId: articulo.id,
          detalles: { nombre: articulo.nombre, unidad: articulo.unidad },
        },
      })
      .catch((error) => console.warn('No se pudo registrar auditoría de inventario:', error))

    return NextResponse.json({ success: true, data: withAlertas(articulo) }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/inventario/articulos:')
  }
}
