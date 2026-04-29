import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'
import { evaluarAlertasInventario } from '@/lib/inventario/movimientos'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const prismaInventario = prisma as any
const INVENTARIO_MANAGE = ['inventory.manage', 'settings.manage', 'configuracion']

const updateArticuloSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  unidad: z.string().trim().min(1).optional(),
  sku: z.string().trim().optional().nullable(),
  categoria: z.string().trim().optional().nullable(),
  stockMinimo: z.number().min(0).optional(),
  fechaCaducidad: z.string().datetime().optional().nullable(),
  activo: z.boolean().optional(),
})

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, INVENTARIO_MANAGE)
    const tenant = requireActiveTenant(user)
    const data = updateArticuloSchema.parse(await request.json())

    const exists = await prismaInventario.inventarioArticulo.findFirst({
      where: { id: params.id, restauranteId: tenant.restauranteId },
      select: { id: true },
    })
    if (!exists) raise(404, 'Artículo de inventario no encontrado')

    const articulo = await prismaInventario.inventarioArticulo.update({
      where: { id: params.id },
      data: {
        ...(data.nombre !== undefined && { nombre: data.nombre }),
        ...(data.unidad !== undefined && { unidad: data.unidad }),
        ...(data.sku !== undefined && { sku: data.sku || null }),
        ...(data.categoria !== undefined && { categoria: data.categoria || null }),
        ...(data.stockMinimo !== undefined && { stockMinimo: data.stockMinimo }),
        ...(data.fechaCaducidad !== undefined && {
          fechaCaducidad: data.fechaCaducidad ? new Date(data.fechaCaducidad) : null,
        }),
        ...(data.activo !== undefined && { activo: data.activo }),
      },
    })

    return NextResponse.json({ success: true, data: withAlertas(articulo) })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en PATCH /api/inventario/articulos/[id]:')
  }
}
