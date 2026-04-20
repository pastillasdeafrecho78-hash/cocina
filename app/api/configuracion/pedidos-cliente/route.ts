import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireAnyCapability,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

const bodySchema = z.object({
  habilitado: z.boolean(),
  /** Control de carga automático para pedidos por link/QR (nombre legible en API). */
  controlCargaAutomaticaPedidos: z.boolean().optional(),
  /** @deprecated Usar controlCargaAutomaticaPedidos; se acepta por compatibilidad con clientes antiguos. */
  modoD: z.boolean().optional(),
  queueEnabled: z.boolean().optional(),
  qrMesaEnabled: z.boolean().optional(),
  maxComandasActivas: z.number().int().positive().max(500).optional(),
  maxItemsPreparacion: z.number().int().positive().max(5000).nullable().optional(),
  tiempoEsperaSaturacionMin: z.number().int().positive().max(180).optional(),
  mensajeSaturacion: z.string().trim().max(240).optional(),
  autoAprobarSolicitudes: z.boolean().optional(),
  clienteEtaMinMinutos: z.number().int().positive().max(240).optional(),
  clienteEtaMaxMinutos: z.number().int().positive().max(480).optional(),
})

function resolveControlCargaAutomaticaPedidos(
  body: z.infer<typeof bodySchema>
): boolean | undefined {
  if (body.controlCargaAutomaticaPedidos !== undefined) return body.controlCargaAutomaticaPedidos
  if (body.modoD !== undefined) return body.modoD
  return undefined
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, [
      'tables.view',
      'tables.client_channel',
      'settings.view',
      'settings.manage',
      'configuracion',
    ])
    const tenant = requireActiveTenant(user)

    const config = await prisma.configuracionRestaurante.findUnique({
      where: { restauranteId: tenant.restauranteId },
      select: {
        pedidosClienteSolicitudHabilitado: true,
        modoDPedidosHabilitado: true,
        queueEnabled: true,
        qrMesaEnabled: true,
        maxComandasActivas: true,
        maxItemsPreparacion: true,
        tiempoEsperaSaturacionMin: true,
        mensajeSaturacion: true,
        autoAprobarSolicitudes: true,
        clienteEtaMinMinutos: true,
        clienteEtaMaxMinutos: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        habilitado: config?.pedidosClienteSolicitudHabilitado ?? false,
        controlCargaAutomaticaPedidos: config?.modoDPedidosHabilitado ?? false,
        queueEnabled: config?.queueEnabled ?? true,
        qrMesaEnabled: config?.qrMesaEnabled ?? true,
        maxComandasActivas: config?.maxComandasActivas ?? 25,
        maxItemsPreparacion: config?.maxItemsPreparacion ?? null,
        tiempoEsperaSaturacionMin: config?.tiempoEsperaSaturacionMin ?? 15,
        mensajeSaturacion:
          config?.mensajeSaturacion ??
          'Ahorita estamos a tope. Tu pedido podría iniciar en unos minutos. ¿Deseas entrar a la cola?',
        autoAprobarSolicitudes: config?.autoAprobarSolicitudes ?? false,
        clienteEtaMinMinutos: config?.clienteEtaMinMinutos ?? 45,
        clienteEtaMaxMinutos: config?.clienteEtaMaxMinutos ?? 60,
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
    requireAnyCapability(user, ['tables.client_channel', 'settings.manage', 'configuracion'])
    const tenant = requireActiveTenant(user)
    const body = bodySchema.parse(await request.json())
    const controlCarga = resolveControlCargaAutomaticaPedidos(body)

    const config = await prisma.configuracionRestaurante.upsert({
      where: { restauranteId: tenant.restauranteId },
      create: {
        restauranteId: tenant.restauranteId,
        pedidosClienteSolicitudHabilitado: body.habilitado,
        modoDPedidosHabilitado: controlCarga ?? false,
        queueEnabled: body.queueEnabled ?? true,
        qrMesaEnabled: body.qrMesaEnabled ?? true,
        maxComandasActivas: body.maxComandasActivas ?? 25,
        maxItemsPreparacion: body.maxItemsPreparacion === undefined ? null : body.maxItemsPreparacion,
        tiempoEsperaSaturacionMin: body.tiempoEsperaSaturacionMin ?? 15,
        mensajeSaturacion:
          body.mensajeSaturacion ??
          'Ahorita estamos a tope. Tu pedido podría iniciar en unos minutos. ¿Deseas entrar a la cola?',
        autoAprobarSolicitudes: body.autoAprobarSolicitudes ?? false,
        clienteEtaMinMinutos: body.clienteEtaMinMinutos ?? 45,
        clienteEtaMaxMinutos: body.clienteEtaMaxMinutos ?? 60,
      },
      update: {
        pedidosClienteSolicitudHabilitado: body.habilitado,
        ...(controlCarga !== undefined ? { modoDPedidosHabilitado: controlCarga } : {}),
        ...(body.queueEnabled !== undefined ? { queueEnabled: body.queueEnabled } : {}),
        ...(body.qrMesaEnabled !== undefined ? { qrMesaEnabled: body.qrMesaEnabled } : {}),
        ...(body.maxComandasActivas !== undefined ? { maxComandasActivas: body.maxComandasActivas } : {}),
        ...(body.maxItemsPreparacion !== undefined
          ? { maxItemsPreparacion: body.maxItemsPreparacion }
          : {}),
        ...(body.tiempoEsperaSaturacionMin !== undefined
          ? { tiempoEsperaSaturacionMin: body.tiempoEsperaSaturacionMin }
          : {}),
        ...(body.mensajeSaturacion !== undefined ? { mensajeSaturacion: body.mensajeSaturacion } : {}),
        ...(body.autoAprobarSolicitudes !== undefined
          ? { autoAprobarSolicitudes: body.autoAprobarSolicitudes }
          : {}),
        ...(body.clienteEtaMinMinutos !== undefined
          ? { clienteEtaMinMinutos: body.clienteEtaMinMinutos }
          : {}),
        ...(body.clienteEtaMaxMinutos !== undefined
          ? { clienteEtaMaxMinutos: body.clienteEtaMaxMinutos }
          : {}),
      },
      select: {
        pedidosClienteSolicitudHabilitado: true,
        modoDPedidosHabilitado: true,
        queueEnabled: true,
        qrMesaEnabled: true,
        maxComandasActivas: true,
        maxItemsPreparacion: true,
        tiempoEsperaSaturacionMin: true,
        mensajeSaturacion: true,
        autoAprobarSolicitudes: true,
        clienteEtaMinMinutos: true,
        clienteEtaMaxMinutos: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        habilitado: config.pedidosClienteSolicitudHabilitado,
        controlCargaAutomaticaPedidos: config.modoDPedidosHabilitado,
        queueEnabled: config.queueEnabled,
        qrMesaEnabled: config.qrMesaEnabled,
        maxComandasActivas: config.maxComandasActivas,
        maxItemsPreparacion: config.maxItemsPreparacion,
        tiempoEsperaSaturacionMin: config.tiempoEsperaSaturacionMin,
        mensajeSaturacion: config.mensajeSaturacion,
        autoAprobarSolicitudes: config.autoAprobarSolicitudes,
        clienteEtaMinMinutos: config.clienteEtaMinMinutos ?? 45,
        clienteEtaMaxMinutos: config.clienteEtaMaxMinutos ?? 60,
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
