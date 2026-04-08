import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createExternalApiKey } from '@/lib/public-ordering'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'configuracion')
    const tenant = requireActiveTenant(user)

    const config = await prisma.integracionPedidosApi.findUnique({
      where: { restauranteId: tenant.restauranteId },
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
        restauranteId: tenant.restauranteId,
        configurada: Boolean(config),
        ...config,
      },
    })
  } catch (error) {
    return toErrorResponse(
      error,
      'No se pudo consultar la configuración',
      'Error en GET /api/integraciones/pedidos/config:'
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'configuracion')
    const tenant = requireActiveTenant(user)

    const body = (await request.json().catch(() => ({}))) as { active?: boolean }
    const active = body.active ?? true
    const key = createExternalApiKey()

    await prisma.integracionPedidosApi.upsert({
      where: { restauranteId: tenant.restauranteId },
      create: {
        restauranteId: tenant.restauranteId,
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
        restauranteId: tenant.restauranteId,
      },
    })
  } catch (error) {
    return toErrorResponse(
      error,
      'No se pudo actualizar la configuración',
      'Error en POST /api/integraciones/pedidos/config:'
    )
  }
}
