import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireCapability,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

const bodySchema = z.object({
  habilitado: z.boolean(),
  modoD: z.boolean().optional(),
  queueEnabled: z.boolean().optional(),
  qrMesaEnabled: z.boolean().optional(),
  maxComandasActivas: z.number().int().positive().max(500).optional(),
  tiempoEsperaSaturacionMin: z.number().int().positive().max(180).optional(),
  mensajeSaturacion: z.string().trim().max(240).optional(),
  autoAprobarSolicitudes: z.boolean().optional(),
})

export async function GET() {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'configuracion')
    const tenant = requireActiveTenant(user)

    const config = await prisma.configuracionRestaurante.findUnique({
      where: { restauranteId: tenant.restauranteId },
      select: {
        pedidosClienteSolicitudHabilitado: true,
        modoDPedidosHabilitado: true,
        queueEnabled: true,
        qrMesaEnabled: true,
        maxComandasActivas: true,
        tiempoEsperaSaturacionMin: true,
        mensajeSaturacion: true,
        autoAprobarSolicitudes: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        habilitado: config?.pedidosClienteSolicitudHabilitado ?? false,
        modoD: config?.modoDPedidosHabilitado ?? false,
        queueEnabled: config?.queueEnabled ?? true,
        qrMesaEnabled: config?.qrMesaEnabled ?? true,
        maxComandasActivas: config?.maxComandasActivas ?? 25,
        tiempoEsperaSaturacionMin: config?.tiempoEsperaSaturacionMin ?? 15,
        mensajeSaturacion:
          config?.mensajeSaturacion ??
          'Ahorita estamos a tope. Tu pedido podría iniciar en unos minutos. ¿Deseas entrar a la cola?',
        autoAprobarSolicitudes: config?.autoAprobarSolicitudes ?? false,
      },
    })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en GET /api/configuracion/pedidos-cliente:'
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'configuracion')
    const tenant = requireActiveTenant(user)
    const body = bodySchema.parse(await request.json())

    const config = await prisma.configuracionRestaurante.upsert({
      where: { restauranteId: tenant.restauranteId },
      create: {
        restauranteId: tenant.restauranteId,
        pedidosClienteSolicitudHabilitado: body.habilitado,
        modoDPedidosHabilitado: body.modoD ?? false,
        queueEnabled: body.queueEnabled ?? true,
        qrMesaEnabled: body.qrMesaEnabled ?? true,
        maxComandasActivas: body.maxComandasActivas ?? 25,
        tiempoEsperaSaturacionMin: body.tiempoEsperaSaturacionMin ?? 15,
        mensajeSaturacion:
          body.mensajeSaturacion ??
          'Ahorita estamos a tope. Tu pedido podría iniciar en unos minutos. ¿Deseas entrar a la cola?',
        autoAprobarSolicitudes: body.autoAprobarSolicitudes ?? false,
      },
      update: {
        pedidosClienteSolicitudHabilitado: body.habilitado,
        ...(body.modoD !== undefined ? { modoDPedidosHabilitado: body.modoD } : {}),
        ...(body.queueEnabled !== undefined ? { queueEnabled: body.queueEnabled } : {}),
        ...(body.qrMesaEnabled !== undefined ? { qrMesaEnabled: body.qrMesaEnabled } : {}),
        ...(body.maxComandasActivas !== undefined ? { maxComandasActivas: body.maxComandasActivas } : {}),
        ...(body.tiempoEsperaSaturacionMin !== undefined
          ? { tiempoEsperaSaturacionMin: body.tiempoEsperaSaturacionMin }
          : {}),
        ...(body.mensajeSaturacion !== undefined ? { mensajeSaturacion: body.mensajeSaturacion } : {}),
        ...(body.autoAprobarSolicitudes !== undefined
          ? { autoAprobarSolicitudes: body.autoAprobarSolicitudes }
          : {}),
      },
      select: {
        pedidosClienteSolicitudHabilitado: true,
        modoDPedidosHabilitado: true,
        queueEnabled: true,
        qrMesaEnabled: true,
        maxComandasActivas: true,
        tiempoEsperaSaturacionMin: true,
        mensajeSaturacion: true,
        autoAprobarSolicitudes: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        habilitado: config.pedidosClienteSolicitudHabilitado,
        modoD: config.modoDPedidosHabilitado,
        queueEnabled: config.queueEnabled,
        qrMesaEnabled: config.qrMesaEnabled,
        maxComandasActivas: config.maxComandasActivas,
        tiempoEsperaSaturacionMin: config.tiempoEsperaSaturacionMin,
        mensajeSaturacion: config.mensajeSaturacion,
        autoAprobarSolicitudes: config.autoAprobarSolicitudes,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Payload inválido' }, { status: 400 })
    }
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en POST /api/configuracion/pedidos-cliente:'
    )
  }
}
