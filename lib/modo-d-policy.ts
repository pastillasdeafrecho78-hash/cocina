import { prisma } from '@/lib/prisma'

type ConfigSnapshot = {
  modoDPedidosHabilitado: boolean
  queueEnabled: boolean
  maxComandasActivas: number | null
  tiempoEsperaSaturacionMin: number | null
  mensajeSaturacion: string | null
  autoAprobarSolicitudes: boolean
}

export type ModoDDecision =
  | {
      action: 'PENDING_REVIEW'
      state: 'PENDIENTE'
      reason: string
      source: 'AUTO'
      autoApprove: boolean
    }
  | {
      action: 'QUEUE'
      state: 'EN_COLA'
      reason: string
      source: 'AUTO_QUEUE'
      waitMinutes: number
      saturationMessage: string
    }
  | {
      action: 'REJECT'
      state: 'RECHAZADA'
      reason: string
      source: 'AUTO'
      saturationMessage: string
      waitMinutes: number
    }

function normalizeConfig(raw: Partial<ConfigSnapshot> | null | undefined): ConfigSnapshot {
  return {
    modoDPedidosHabilitado: Boolean(raw?.modoDPedidosHabilitado),
    queueEnabled: raw?.queueEnabled ?? true,
    maxComandasActivas: raw?.maxComandasActivas ?? 25,
    tiempoEsperaSaturacionMin: raw?.tiempoEsperaSaturacionMin ?? 15,
    mensajeSaturacion:
      raw?.mensajeSaturacion?.trim() ||
      'Ahorita estamos a tope. Tu pedido podría iniciar en unos minutos. ¿Deseas entrar a la cola?',
    autoAprobarSolicitudes: Boolean(raw?.autoAprobarSolicitudes),
  }
}

export async function evaluateModoDForPublicOrder(input: {
  restauranteId: string
  wantsQueue: boolean
}): Promise<ModoDDecision> {
  const configRow = await prisma.configuracionRestaurante.findUnique({
    where: { restauranteId: input.restauranteId },
    select: {
      modoDPedidosHabilitado: true,
      queueEnabled: true,
      maxComandasActivas: true,
      tiempoEsperaSaturacionMin: true,
      mensajeSaturacion: true,
      autoAprobarSolicitudes: true,
    },
  })

  const config = normalizeConfig(configRow)
  if (!config.modoDPedidosHabilitado) {
    return {
      action: 'PENDING_REVIEW',
      state: 'PENDIENTE',
      reason: 'modo_d_disabled',
      source: 'AUTO',
      autoApprove: false,
    }
  }

  const activeComandas = await prisma.comanda.count({
    where: {
      restauranteId: input.restauranteId,
      estado: {
        in: ['PENDIENTE', 'EN_PREPARACION', 'LISTO', 'SERVIDO'],
      },
    },
  })

  const max = config.maxComandasActivas && config.maxComandasActivas > 0 ? config.maxComandasActivas : null
  const isSaturated = max != null && activeComandas >= max

  if (isSaturated) {
    if (config.queueEnabled && input.wantsQueue) {
      return {
        action: 'QUEUE',
        state: 'EN_COLA',
        reason: 'saturated_queue',
        source: 'AUTO_QUEUE',
        waitMinutes: config.tiempoEsperaSaturacionMin ?? 15,
        saturationMessage: config.mensajeSaturacion!,
      }
    }

    return {
      action: 'REJECT',
      state: 'RECHAZADA',
      reason: 'saturated_declined_queue',
      source: 'AUTO',
      saturationMessage: config.mensajeSaturacion!,
      waitMinutes: config.tiempoEsperaSaturacionMin ?? 15,
    }
  }

  return {
    action: 'PENDING_REVIEW',
    state: 'PENDIENTE',
    reason: 'capacity_available',
    source: 'AUTO',
    autoApprove: config.autoAprobarSolicitudes,
  }
}

export async function isUserWithinWorkSchedule(input: {
  usuarioId: string
  restauranteId: string
  date?: Date
}): Promise<boolean> {
  const now = input.date ?? new Date()
  const weekday = now.getDay()
  const minuteOfDay = now.getHours() * 60 + now.getMinutes()

  const membership = await prisma.sucursalMiembro.findFirst({
    where: {
      usuarioId: input.usuarioId,
      restauranteId: input.restauranteId,
      activo: true,
    },
    select: {
      horarioInicioMin: true,
      horarioFinMin: true,
      diasLaborales: true,
    },
  })

  if (!membership) return false
  if (membership.horarioInicioMin == null || membership.horarioFinMin == null) return true

  const allowedDays = (membership.diasLaborales || '')
    .split(',')
    .map((d) => Number.parseInt(d.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)

  if (allowedDays.length > 0 && !allowedDays.includes(weekday)) return false

  return minuteOfDay >= membership.horarioInicioMin && minuteOfDay <= membership.horarioFinMin
}
