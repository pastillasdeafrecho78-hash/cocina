'use client'

import MesaCard from '@/components/MesaCard'
import type { MesaDashboard } from './types'

interface MesasListViewProps {
  currentUserId?: string | null
  mesas: MesaDashboard[]
  onMesaClick: (mesa: MesaDashboard) => void
}

export default function MesasListView({ currentUserId, mesas, onMesaClick }: MesasListViewProps) {
  if (mesas.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-stone-300 bg-white/70 p-10 text-center text-stone-500">
        No hay mesas activas en esta sucursal.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {mesas.map((mesa) => (
        <MesaCard
          key={mesa.id}
          numero={mesa.numero}
          estado={mesa.estado}
          capacidad={mesa.capacidad}
          comandaActual={mesa.comandaActual}
          currentUserId={currentUserId}
          onClick={() => onMesaClick(mesa)}
          variant="status"
        />
      ))}
    </div>
  )
}
