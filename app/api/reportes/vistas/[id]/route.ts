import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getSessionUser } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { tienePermiso } from '@/lib/permisos'
import { dashboardVistaSchema } from '@/lib/reportes/schemas'

interface RouteContext {
  params: {
    id: string
  }
}

async function getVistaOrThrow(id: string, usuarioId: string) {
  const vista = await prisma.dashboardVista.findFirst({
    where: {
      id,
      usuarioId,
      modulo: 'reportes',
      scope: 'USER',
      activa: true,
    },
  })

  return vista
}

async function clearDefaultViews(usuarioId: string, excludeId?: string) {
  await prisma.dashboardVista.updateMany({
    where: {
      usuarioId,
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
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'reportes')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const existente = await getVistaOrThrow(params.id, user.id)
    if (!existente) {
      return NextResponse.json({ success: false, error: 'Vista no encontrada' }, { status: 404 })
    }

    const body = await request.json()
    const data = dashboardVistaSchema.parse(body)

    if (data.esDefault) {
      await clearDefaultViews(user.id, existente.id)
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
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error en PUT /api/reportes/vistas/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'reportes')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const existente = await getVistaOrThrow(params.id, user.id)
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
    console.error('Error en DELETE /api/reportes/vistas/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
