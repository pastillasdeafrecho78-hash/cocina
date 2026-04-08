import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { toErrorResponse } from '@/lib/authz/http'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { prisma } from '@/lib/prisma'
import { dashboardVistaSchema } from '@/lib/reportes/schemas'

async function clearDefaultViews(usuarioId: string, restauranteId: string) {
  await prisma.dashboardVista.updateMany({
    where: {
      usuarioId,
      restauranteId,
      modulo: 'reportes',
      scope: 'USER',
    },
    data: {
      esDefault: false,
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'reportes')
    const tenant = requireActiveTenant(user)

    const vistas = await prisma.dashboardVista.findMany({
      where: {
        modulo: 'reportes',
        activa: true,
        scope: 'USER',
        usuarioId: user.id,
        restauranteId: tenant.restauranteId,
      },
      orderBy: [{ esDefault: 'desc' }, { updatedAt: 'desc' }],
    })

    return NextResponse.json({
      success: true,
      data: vistas,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/reportes/vistas:')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'reportes')
    const tenant = requireActiveTenant(user)

    const body = await request.json()
    const data = dashboardVistaSchema.parse(body)

    if (data.esDefault) {
      await clearDefaultViews(user.id, tenant.restauranteId)
    }

    const vista = await prisma.dashboardVista.create({
      data: {
        restauranteId: tenant.restauranteId,
        nombre: data.nombre.trim(),
        descripcion: data.descripcion?.trim() || null,
        modulo: 'reportes',
        scope: 'USER',
        usuarioId: user.id,
        esDefault: data.esDefault,
        filtros: data.filtros as Prisma.InputJsonValue,
        widgets: data.widgets as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: vista,
      },
      { status: 201 }
    )
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/reportes/vistas:')
  }
}
