import { prisma } from '@/lib/prisma'

export type TipoEventoItem = 'ENTRADA' | 'TOMADO' | 'EN_PREPARACION' | 'LISTO' | 'ENTREGADO'
export type EstadoItemEvento = 'PENDIENTE' | 'EN_PREPARACION' | 'LISTO' | 'ENTREGADO'

export function eventosItemEnabled() {
  return (
    process.env.TIEMPOS_EVENTOS_ITEM === '1' ||
    process.env.TIEMPOS_EVENTOS_ITEM === 'true' ||
    process.env.NEXT_PUBLIC_TIEMPOS_EVENTOS_ITEM === '1' ||
    process.env.NEXT_PUBLIC_TIEMPOS_EVENTOS_ITEM === 'true'
  )
}

export function tipoEventoParaEstado(estado: EstadoItemEvento): TipoEventoItem {
  if (estado === 'EN_PREPARACION') return 'EN_PREPARACION'
  if (estado === 'LISTO') return 'LISTO'
  if (estado === 'ENTREGADO') return 'ENTREGADO'
  return 'ENTRADA'
}

export async function registrarEventoItemSeguro(input: {
  restauranteId: string
  comandaId: string
  comandaItemId?: string | null
  productoId?: string | null
  kdsSeccionId?: string | null
  usuarioId?: string | null
  tipo: TipoEventoItem
  estadoPrevio?: EstadoItemEvento | null
  estadoNuevo?: EstadoItemEvento | null
  metadata?: Record<string, unknown>
}) {
  if (!eventosItemEnabled()) return
  try {
    await (prisma as any).itemTiempoEvento.create({
      data: {
        restauranteId: input.restauranteId,
        comandaId: input.comandaId,
        comandaItemId: input.comandaItemId ?? null,
        productoId: input.productoId ?? null,
        kdsSeccionId: input.kdsSeccionId ?? null,
        usuarioId: input.usuarioId ?? null,
        tipo: input.tipo,
        estadoPrevio: input.estadoPrevio ?? null,
        estadoNuevo: input.estadoNuevo ?? null,
        metadata: input.metadata ?? undefined,
      },
    })
  } catch (error) {
    console.warn('No se pudo registrar evento de tiempo de item:', error)
  }
}

export type EventoTiempoLite = {
  tipo: TipoEventoItem
  occurredAt: Date | string
  productoId?: string | null
  kdsSeccionId?: string | null
}

export function calcularDuracionPreparacionMs(eventos: EventoTiempoLite[]) {
  const ordenados = [...eventos].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  )
  const inicio = ordenados.find((evento) => evento.tipo === 'EN_PREPARACION')
  const fin = ordenados.find(
    (evento) =>
      evento.tipo === 'LISTO' &&
      inicio &&
      new Date(evento.occurredAt).getTime() >= new Date(inicio.occurredAt).getTime()
  )
  if (!inicio || !fin) return null
  return new Date(fin.occurredAt).getTime() - new Date(inicio.occurredAt).getTime()
}

export function resumirDuracionesPorClave(
  eventosPorItem: Array<{ key: string; eventos: EventoTiempoLite[] }>
) {
  const acc = new Map<string, { key: string; count: number; totalMs: number }>()
  for (const row of eventosPorItem) {
    const duracion = calcularDuracionPreparacionMs(row.eventos)
    if (duracion === null) continue
    const current = acc.get(row.key) ?? { key: row.key, count: 0, totalMs: 0 }
    current.count += 1
    current.totalMs += duracion
    acc.set(row.key, current)
  }
  return [...acc.values()].map((row) => ({
    key: row.key,
    count: row.count,
    promedioMs: Math.round(row.totalMs / row.count),
    promedioMinutos: Math.round((row.totalMs / row.count / 60000) * 10) / 10,
  }))
}
