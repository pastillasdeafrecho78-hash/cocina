import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { createExternalApiKey } from '@/lib/public-ordering'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'configuracion')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const config = await prisma.integracionPedidosApi.findUnique({
      where: { restauranteId: user.restauranteId },
      select: {
        id: true,
        activo: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        restauranteId: user.restauranteId,
        configurada: Boolean(config),
        ...config,
      },
    })
  } catch (error) {
    console.error('Error en GET /api/integraciones/pedidos/config:', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo consultar la configuración' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'configuracion')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const body = (await request.json().catch(() => ({}))) as { active?: boolean }
    const active = body.active ?? true
    const key = createExternalApiKey()

    await prisma.integracionPedidosApi.upsert({
      where: { restauranteId: user.restauranteId },
      create: {
        restauranteId: user.restauranteId,
        apiKeyHash: key.hash,
        activo: active,
      },
      update: {
        apiKeyHash: key.hash,
        activo: active,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        apiKey: key.raw,
        restauranteId: user.restauranteId,
      },
    })
  } catch (error) {
    console.error('Error en POST /api/integraciones/pedidos/config:', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo actualizar la configuración' },
      { status: 500 }
    )
  }
}
