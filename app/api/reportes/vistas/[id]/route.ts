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

interface RouteContext {
  params: {
    id: string
  }
}

async function getVistaOrThrow(id: string, usuarioId: string, restauranteId: string) {
  const vista = await prisma.dashboardVista.findFirst({
    where: {
      id,
      usuarioId,
      restauranteId,
      modulo: 'reportes',
      scope: 'USER',
      activa: true,
    },
  })

  return vista
}

async function clearDefaultViews(usuarioId: string, restauranteId: string, excludeId?: string) {
  await prisma.dashboardVista.updateMany({
    where: {
      usuarioId,
      restauranteId,
      modulo: 'reportes',
      scope: 'USER',
      NOT: excludeId ? { id: excludeId } : undefined,
    },
    data: {
      esDefault: false,
    },
  })
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'reportes')
    const tenant = requireActiveTenant(user)

    const existente = await getVistaOrThrow(params.id, user.id, tenant.restauranteId)
    if (!existente) {
      return NextResponse.json({ success: false, error: 'Vista no encontrada' }, { status: 404 })
    }

    const body = await request.json()
    const data = dashboardVistaSchema.parse(body)

    if (data.esDefault) {
      await clearDefaultViews(user.id, tenant.restauranteId, existente.id)
    }

    const vista = await prisma.dashboardVista.update({
      where: { id: existente.id },
      data: {
        nombre: data.nombre.trim(),
        descripcion: data.descripcion?.trim() || null,
        esDefault: data.esDefault,
        filtros: data.filtros as Prisma.InputJsonValue,
        widgets: data.widgets as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({
      success: true,
      data: vista,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en PUT /api/reportes/vistas/[id]:')
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'reportes')
    const tenant = requireActiveTenant(user)

    const existente = await getVistaOrThrow(params.id, user.id, tenant.restauranteId)
    if (!existente) {
      return NextResponse.json({ success: false, error: 'Vista no encontrada' }, { status: 404 })
    }

    await prisma.dashboardVista.update({
      where: { id: existente.id },
      data: {
        activa: false,
        esDefault: false,
      },
    })

    const nextDefault = await prisma.dashboardVista.findFirst({
      where: {
        usuarioId: user.id,
        restauranteId: tenant.restauranteId,
        modulo: 'reportes',
        scope: 'USER',
        activa: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (existente.esDefault && nextDefault) {
      await prisma.dashboardVista.update({
        where: { id: nextDefault.id },
        data: { esDefault: true },
      })
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en DELETE /api/reportes/vistas/[id]:')
  }
}
