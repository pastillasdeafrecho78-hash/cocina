import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getTokenFromRequest, getUserFromToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso } from '@/lib/permisos'
import { dashboardVistaSchema } from '@/lib/reportes/schemas'

async function clearDefaultViews(usuarioId: string) {
  await prisma.dashboardVista.updateMany({
    where: {
      usuarioId,
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
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'reportes')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const vistas = await prisma.dashboardVista.findMany({
      where: {
        modulo: 'reportes',
        activa: true,
        scope: 'USER',
        usuarioId: user.id,
      },
      orderBy: [{ esDefault: 'desc' }, { updatedAt: 'desc' }],
    })

    return NextResponse.json({
      success: true,
      data: vistas,
    })
  } catch (error) {
    console.error('Error en GET /api/reportes/vistas:', error)
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
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'reportes')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const data = dashboardVistaSchema.parse(body)

    if (data.esDefault) {
      await clearDefaultViews(user.id)
    }

    const vista = await prisma.dashboardVista.create({
      data: {
        restauranteId: user.restauranteId,
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
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error en POST /api/reportes/vistas:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
