'use client'

import { EstadoMesa } from '@prisma/client'
import { useEffect, useState } from 'react'
import { formatWaitTime, minutosDesde, colorProgresivoPorMinutos } from '@/lib/mesa-utils'

interface MesaCardProps {
  numero: number
  estado: EstadoMesa
  capacidad: number
  comandaActual?: {
    numeroComanda: string
    total: number
    fechaCreacion?: string
  } | null
  onClick: () => void
  tiempoAmarilloMinutos?: number
  tiempoRojoMinutos?: number
  /** En modo status: sin comanda → gris; con comanda → tiempo de espera visible */
  variant?: 'default' | 'status'
  /** Botón borrar (solo en status). Recibe confirmación antes de llamar. */
  onDelete?: () => void
  /** Si el padre pasa estos valores, MesaCard no usa setInterval (optimización). */
  waitTime?: string
  colorProgresivo?: string | null
}

const estadoColors = {
  LIBRE: 'bg-green-500 hover:bg-green-600',
  OCUPADA: 'bg-yellow-500 hover:bg-yellow-600',
  CUENTA_PEDIDA: 'bg-red-500 hover:bg-red-600',
  RESERVADA: 'bg-blue-500 hover:bg-blue-600',
}

const estadoLabels = {
  LIBRE: 'Libre',
  OCUPADA: 'Ocupada',
  CUENTA_PEDIDA: 'Cuenta',
  RESERVADA: 'Reservada',
}

export default function MesaCard({
  numero,
  estado,
  capacidad,
  comandaActual,
  onClick,
  tiempoAmarilloMinutos = 30,
  tiempoRojoMinutos = 60,
  variant = 'default',
  onDelete,
  waitTime: waitTimeProp,
  colorProgresivo: colorProgresivoProp,
}: MesaCardProps) {
  const [colorClass, setColorClass] = useState(estadoColors[estado])
  const [colorProgresivoLocal, setColorProgresivoLocal] = useState<string | null>(null)
  const [waitTimeLocal, setWaitTimeLocal] = useState<string | null>(
    variant === 'status' && comandaActual?.fechaCreacion
      ? formatWaitTime(comandaActual.fechaCreacion)
      : null
  )

  const usarPropsDelPadre = waitTimeProp !== undefined && colorProgresivoProp !== undefined
  const waitTime = usarPropsDelPadre ? waitTimeProp : waitTimeLocal
  const colorProgresivo = usarPropsDelPadre ? colorProgresivoProp : colorProgresivoLocal

  useEffect(() => {
    if (usarPropsDelPadre) return

    const isStatus = variant === 'status'

    if (isStatus && !comandaActual) {
      setColorClass('bg-gray-400 hover:bg-gray-500')
      setColorProgresivoLocal(null)
      setWaitTimeLocal(null)
      return
    }

    if (isStatus && comandaActual?.fechaCreacion) {
      const update = () => {
        setWaitTimeLocal(formatWaitTime(comandaActual!.fechaCreacion!))
        const min = minutosDesde(comandaActual!.fechaCreacion!)
        setColorProgresivoLocal(colorProgresivoPorMinutos(min, tiempoAmarilloMinutos, tiempoRojoMinutos))
      }
      update()
      const interval = setInterval(update, 10000)
      return () => clearInterval(interval)
    }

    if (estado === 'LIBRE' || estado === 'RESERVADA') {
      setColorClass(estadoColors[estado])
      setColorProgresivoLocal(null)
      return
    }

    if (comandaActual?.fechaCreacion && estado === 'OCUPADA') {
      const update = () => {
        const min = minutosDesde(comandaActual!.fechaCreacion!)
        setColorProgresivoLocal(colorProgresivoPorMinutos(min, tiempoAmarilloMinutos, tiempoRojoMinutos))
      }
      update()
      const interval = setInterval(update, 60000)
      return () => clearInterval(interval)
    }

    setColorProgresivoLocal(null)
    setColorClass(estadoColors[estado])
  }, [estado, comandaActual, tiempoAmarilloMinutos, tiempoRojoMinutos, variant, usarPropsDelPadre])

  const isCompact = variant === 'status'
  const cardContent = isCompact ? (
    <>
      <div className="text-xl font-bold leading-tight">M{numero}</div>
      <div className="text-[10px] opacity-90 mt-0.5">👥{capacidad}</div>
      {!comandaActual ? (
        <div className="text-[10px] opacity-80 mt-0.5">Libre</div>
      ) : (
        <>
          <div className="text-[10px] font-medium bg-black/30 px-1.5 py-0.5 rounded mt-0.5">{waitTime ?? '—'}</div>
          <div className="text-[9px] opacity-90 truncate max-w-full">{comandaActual.numeroComanda}</div>
        </>
      )}
    </>
  ) : (
    <>
      <div className="text-3xl font-bold mb-2">Mesa {numero}</div>
      <div className="text-sm opacity-90">{estadoLabels[estado]}</div>
      <div className="text-xs mt-1 opacity-75">Cap: {capacidad}</div>
      {comandaActual && (
        <div className="mt-2 text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
          {comandaActual.numeroComanda}
        </div>
      )}
    </>
  )

  const baseClass = isCompact
    ? 'text-white p-2 rounded-lg shadow-md transition-all transform hover:scale-105 active:scale-95 flex flex-col items-center justify-center aspect-square min-h-0 w-full text-center'
    : 'text-white p-6 rounded-lg shadow-md transition-all transform hover:scale-105 active:scale-95 flex flex-col items-center justify-center min-h-[120px] w-full'
  const cardClass = colorProgresivo != null ? baseClass : `${colorClass} ${baseClass}`
  const cardStyle =
    colorProgresivo != null
      ? { backgroundColor: colorProgresivo, transition: 'background-color 1.2s ease' }
      : undefined

  if (onDelete) {
    return (
      <div className="relative">
        <button type="button" onClick={onClick} className={cardClass} style={cardStyle}>
          {cardContent}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/30 hover:bg-red-600 flex items-center justify-center text-white text-sm transition-colors z-10"
          title="Borrar mesa"
          aria-label="Borrar mesa"
        >
          🗑
        </button>
      </div>
    )
  }

  return (
    <button type="button" onClick={onClick} className={cardClass} style={cardStyle}>
      {cardContent}
    </button>
  )
}
