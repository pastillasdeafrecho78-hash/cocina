'use client'

import type { MesaDashboard } from './types'

const MESAS_LAYOUT_AVANZADO =
  process.env.NEXT_PUBLIC_MESAS_LAYOUT_AVANZADO === '1' ||
  process.env.NEXT_PUBLIC_MESAS_LAYOUT_AVANZADO === 'true'

const estadoColors: Record<MesaDashboard['estado'], string> = {
  LIBRE: '#059669',
  OCUPADA: '#ea580c',
  CUENTA_PEDIDA: '#be123c',
  RESERVADA: '#0369a1',
}

interface MesasSpatialViewProps {
  mesas: MesaDashboard[]
  onMesaClick: (mesa: MesaDashboard) => void
}

function normalizedPosition(value: number | null | undefined, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(3, Math.min(92, value))
}

function dimensionToPx(value: number | null | undefined, fallback: number) {
  const normalized = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.max(52, Math.min(190, normalized * 58))
}

export default function MesasSpatialView({ mesas, onMesaClick }: MesasSpatialViewProps) {
  if (!MESAS_LAYOUT_AVANZADO) {
    return (
      <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-8 text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/35 dark:text-amber-100">
        Activa <code>NEXT_PUBLIC_MESAS_LAYOUT_AVANZADO=1</code> y redeploy para ver el plano
        espacial.
      </div>
    )
  }

  if (mesas.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-stone-300 bg-white/70 p-10 text-center text-stone-500 dark:border-stone-700 dark:bg-stone-900/70 dark:text-stone-300">
        No hay mesas activas para dibujar en el plano.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[32px] border border-stone-200 bg-[radial-gradient(circle_at_top_left,#fff7ed,transparent_35%),linear-gradient(135deg,#fafaf9,#e7e5e4)] p-4 shadow-sm dark:border-stone-700 dark:bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.16),transparent_35%),linear-gradient(135deg,#1c1917,#0c0a09)]">
      <div className="relative h-[560px] min-h-[460px] rounded-[24px] border border-stone-300 bg-white/55 dark:border-stone-700 dark:bg-stone-950/70">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(120,113,108,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(120,113,108,0.12)_1px,transparent_1px)] bg-[size:48px_48px] dark:bg-[linear-gradient(to_right,rgba(214,211,209,0.09)_1px,transparent_1px),linear-gradient(to_bottom,rgba(214,211,209,0.09)_1px,transparent_1px)]" />
        {mesas.map((mesa, index) => {
          const fallbackX = 10 + (index % 5) * 18
          const fallbackY = 12 + Math.floor(index / 5) * 22
          const left = normalizedPosition(mesa.posicionX, fallbackX)
          const top = normalizedPosition(mesa.posicionY, fallbackY)
          const width = dimensionToPx(mesa.ancho, 1.2)
          const height = mesa.forma === 'CIRCULAR' ? width : dimensionToPx(mesa.alto, 1)
          const isCircular = mesa.forma === 'CIRCULAR'
          const ocupado = Boolean(mesa.comandaActual)

          return (
            <button
              key={mesa.id}
              type="button"
              onClick={() => onMesaClick(mesa)}
              className="absolute flex flex-col items-center justify-center border-2 border-white text-center text-white shadow-lg transition hover:z-20 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-amber-300"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width,
                height,
                borderRadius: isCircular ? '9999px' : '18px',
                background: estadoColors[mesa.estado] || '#57534e',
                transform: `translate(-50%, -50%) rotate(${mesa.rotacion ?? 0}deg)`,
              }}
              title={`Mesa ${mesa.numero}`}
            >
              <span
                className="flex flex-col items-center"
                style={{ transform: `rotate(${-(mesa.rotacion ?? 0)}deg)` }}
              >
                <span className="text-sm font-bold">Mesa {mesa.numero}</span>
                <span className="text-xs opacity-90">Cap. {mesa.capacidad}</span>
                <span className="mt-1 rounded-full bg-black/25 px-2 py-0.5 text-[10px]">
                  {ocupado ? mesa.comandaActual?.numeroComanda : mesa.estado}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
