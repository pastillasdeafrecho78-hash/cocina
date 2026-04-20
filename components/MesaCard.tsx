'use client'

import { EstadoMesa } from '@prisma/client'
import { useEffect, useState } from 'react'
import { formatWaitTime, minutosDesde, colorProgresivoPorMinutos } from '@/lib/mesa-utils'
import { ComandaAsignacionIndicator } from '@/components/ComandaAsignacionIndicator'

interface MesaCardProps {
  numero: number
  estado: EstadoMesa
  capacidad: number
  comandaActual?: {
    numeroComanda: string
    total: number
    fechaCreacion?: string
    allItemsEntregados?: boolean
    asignadoA?: { id: string; nombre: string; apellido: string } | null
  } | null
  /** Usuario logueado (para badge «Contigo» vs nombre de quien tomó la comanda). */
  currentUserId?: string | null
  onClick: () => void
  tiempoAmarilloMinutos?: number
  tiempoRojoMinutos?: number
  /** En modo status: sin comanda → gris; con comanda → tiempo de espera visible */
  variant?: 'default' | 'status'
  /** Si el padre pasa estos valores, MesaCard no usa setInterval (optimización). */
  waitTime?: string
  colorProgresivo?: string | null
  /** Si todos los items están entregados, mesa muestra color azul/verde "Listo". */
  allItemsEntregados?: boolean
}

const estadoColors = {
  LIBRE: 'bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700',
  OCUPADA: 'bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700',
  CUENTA_PEDIDA: 'bg-gradient-to-br from-rose-500 to-rose-700 hover:from-rose-600 hover:to-rose-800',
  RESERVADA: 'bg-gradient-to-br from-sky-500 to-sky-700 hover:from-sky-600 hover:to-sky-800',
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
  currentUserId = null,
  onClick,
  tiempoAmarilloMinutos = 30,
  tiempoRojoMinutos = 60,
  variant = 'default',
  waitTime: waitTimeProp,
  colorProgresivo: colorProgresivoProp,
  allItemsEntregados: allItemsEntregadosProp,
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
  const allItemsEntregados = allItemsEntregadosProp ?? comandaActual?.allItemsEntregados

  useEffect(() => {
    if (usarPropsDelPadre) return

    const isStatus = variant === 'status'

    if (isStatus && !comandaActual) {
      setColorClass('bg-gradient-to-br from-stone-400 to-stone-500 hover:from-stone-500 hover:to-stone-600')
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
  const COLOR_LISTO = '#0ea5e9'
  const cardContent = isCompact ? (
    <>
      <div className="text-xl font-bold leading-tight">M{numero}</div>
      <div className="text-[10px] opacity-90 mt-0.5">👥{capacidad}</div>
      {!comandaActual ? (
        <div className="text-[10px] opacity-80 mt-0.5">Libre</div>
      ) : allItemsEntregados ? (
        <>
          <div className="text-[10px] font-medium bg-black/30 px-1.5 py-0.5 rounded mt-0.5">✓ Listo</div>
          <div className="text-[9px] opacity-90 truncate max-w-full">{comandaActual.numeroComanda}</div>
          <div className="mt-0.5 flex max-w-[100%] flex-col items-center gap-0.5 px-0.5">
            <ComandaAsignacionIndicator
              asignadoA={comandaActual.asignadoA ?? null}
              currentUserId={currentUserId}
            />
            {!comandaActual.asignadoA ? (
              <span
                className="text-[8px] font-medium text-white/90"
                title="Nadie ha tomado esta comanda en su perfil. Ábrela y usa «Tomar comanda»."
              >
                Sin mesero
              </span>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="text-[10px] font-medium bg-black/30 px-1.5 py-0.5 rounded mt-0.5">{waitTime ?? '—'}</div>
          <div className="text-[9px] opacity-90 truncate max-w-full">{comandaActual.numeroComanda}</div>
          <div className="mt-0.5 flex max-w-[100%] flex-col items-center gap-0.5 px-0.5">
            <ComandaAsignacionIndicator
              asignadoA={comandaActual.asignadoA ?? null}
              currentUserId={currentUserId}
            />
            {!comandaActual.asignadoA ? (
              <span
                className="text-[8px] font-medium text-white/90"
                title="Nadie ha tomado esta comanda en su perfil. Ábrela y usa «Tomar comanda»."
              >
                Sin mesero
              </span>
            ) : null}
          </div>
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
    ? 'text-white p-2 rounded-[24px] shadow-warm transition-all transform hover:-translate-y-0.5 active:scale-95 flex flex-col items-center justify-center aspect-square min-h-0 w-full text-center border border-white/20'
    : 'text-white p-6 rounded-[26px] shadow-warm transition-all transform hover:-translate-y-1 active:scale-95 flex flex-col items-center justify-center min-h-[120px] w-full border border-white/20'
  const cardClass = colorProgresivo != null || allItemsEntregados ? baseClass : `${colorClass} ${baseClass}`
  const cardStyle =
    allItemsEntregados
      ? { backgroundColor: COLOR_LISTO, transition: 'background-color 0.3s ease' }
      : colorProgresivo != null
        ? { backgroundColor: colorProgresivo, transition: 'background-color 1.2s ease' }
        : undefined

  return (
    <button type="button" onClick={onClick} className={cardClass} style={cardStyle}>
      {cardContent}
    </button>
  )
}
