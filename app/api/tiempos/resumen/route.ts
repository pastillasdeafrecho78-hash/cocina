import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'
import { resumirDuracionesPorClave, type EventoTiempoLite } from '@/lib/tiempos/eventos'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['reports.view', 'reportes', 'kitchen.view', 'bar.view', 'cocina', 'barra'])
    const tenant = requireActiveTenant(user)

    const { searchParams } = new URL(request.url)
    const groupBy = searchParams.get('groupBy') === 'producto' ? 'producto' : 'kds'
    const days = Math.min(90, Math.max(1, Number(searchParams.get('days') || 30)))
    const desde = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const eventos = await (prisma as any).itemTiempoEvento.findMany({
      where: {
        restauranteId: tenant.restauranteId,
        occurredAt: { gte: desde },
        tipo: { in: ['EN_PREPARACION', 'LISTO'] },
      },
      orderBy: [{ comandaItemId: 'asc' }, { occurredAt: 'asc' }],
      select: {
        comandaItemId: true,
        tipo: true,
        occurredAt: true,
        productoId: true,
        kdsSeccionId: true,
        producto: { select: { nombre: true } },
        kdsSeccion: { select: { nombre: true } },
      },
    })

    const byItem = new Map<string, { key: string; label: string; eventos: EventoTiempoLite[] }>()
    for (const evento of eventos) {
      if (!evento.comandaItemId) continue
      const key =
        groupBy === 'producto'
          ? evento.productoId ?? 'sin-producto'
          : evento.kdsSeccionId ?? 'legacy-destino'
      const label =
        groupBy === 'producto'
          ? evento.producto?.nombre ?? 'Sin producto'
          : evento.kdsSeccion?.nombre ?? 'Legacy cocina/barra'
      const current = byItem.get(evento.comandaItemId) ?? {
        key,
        label,
        eventos: [] as EventoTiempoLite[],
      }
      current.eventos.push({ tipo: evento.tipo, occurredAt: evento.occurredAt })
      byItem.set(evento.comandaItemId, current)
    }

    const labels = new Map([...byItem.values()].map((row) => [row.key, row.label]))
    const rows = resumirDuracionesPorClave([...byItem.values()]).map((row) => ({
      ...row,
      label: labels.get(row.key) ?? row.key,
    }))

    return NextResponse.json({
      success: true,
      data: { groupBy, days, rows },
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/tiempos/resumen:')
  }
}
