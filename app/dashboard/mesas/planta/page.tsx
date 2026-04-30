'use client'

import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import BackButton from '@/components/BackButton'
import toast from 'react-hot-toast'
import { apiFetch } from '@/lib/auth-fetch'
import { getMesaPixelSize, normalizeMesaLayout, type FormaMesaLayout } from '@/lib/mesas/layout'

const MESAS_LAYOUT_AVANZADO =
  process.env.NEXT_PUBLIC_MESAS_LAYOUT_AVANZADO === '1' ||
  process.env.NEXT_PUBLIC_MESAS_LAYOUT_AVANZADO === 'true'

interface Mesa {
  id: string
  numero: number
  estado: string
  capacidad: number
  ubicacion?: string | null
  posicionX?: number | null
  posicionY?: number | null
  rotacion?: number | null
  forma?: FormaMesaLayout | null
  ancho?: number | null
  alto?: number | null
  comandaActual?: {
    numeroComanda: string
    total: number
    fechaCreacion?: string
  } | null
}

interface MesaEnCanvas extends Mesa {
  x: number
  y: number
  rotation: number
  isDragging: boolean
  dragOffset: { x: number; y: number }
}

interface Planta {
  id: string
  nombre: string | null
  vertices: Array<{ x: number; y: number }>
  edges?: Array<{ from: number; to: number }>
  cellSizeM: number
  widthM: number | null
  heightM: number | null
}

const estadoColors = {
  LIBRE: '#10b981', // green
  OCUPADA: '#f59e0b', // yellow
  CUENTA_PEDIDA: '#ef4444', // red
  RESERVADA: '#3b82f6', // blue
}

const FIT_PADDING_PX = 96
const FIT_MIN_SCALE = 0.45
const FIT_MAX_SCALE = 1.35

export default function PlantaMesasPage() {
  const router = useRouter()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [mesas, setMesas] = useState<MesaEnCanvas[]>([])
  const [loading, setLoading] = useState(true)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [mesaSeleccionada, setMesaSeleccionada] = useState<string | null>(null)
  const [escala, setEscala] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [guardando, setGuardando] = useState(false)
  const [planta, setPlanta] = useState<Planta | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const didInitialFitRef = useRef(false)

  const touchStateRef = useRef<{
    active: boolean
    gesture: 'pan' | 'zoom' | null
    lastCX: number
    lastCY: number
    lastDist: number
    lastOffsetX: number
    lastOffsetY: number
    lastScale: number
  } | null>(null)
  const offsetScaleRef = useRef({ offset: { x: 0, y: 0 }, escala: 1 })

  // Tamaño de celda de la cuadrícula (en píxeles del canvas)
  const GRID_CELL_SIZE = 50 // píxeles por celda
  const CELL_SIZE_M = planta?.cellSizeM || 1.0 // metros por celda

  // Dimensiones del canvas basadas en planta, mesas y viewport. La grilla debe cubrir el área útil visible.
  const BASE_CANVAS_WIDTH = planta?.widthM ? (planta.widthM / CELL_SIZE_M) * GRID_CELL_SIZE : 1000
  const BASE_CANVAS_HEIGHT = planta?.heightM ? (planta.heightM / CELL_SIZE_M) * GRID_CELL_SIZE : 800
  const CANVAS_WIDTH = Math.max(
    BASE_CANVAS_WIDTH,
    containerSize.width / Math.max(escala, 0.1),
    ...mesas.map((mesa) => mesa.x + GRID_CELL_SIZE * 6)
  )
  const CANVAS_HEIGHT = Math.max(
    BASE_CANVAS_HEIGHT,
    containerSize.height / Math.max(escala, 0.1),
    ...mesas.map((mesa) => mesa.y + GRID_CELL_SIZE * 6)
  )

  // Origen (0,0) en el centro del viewport: plano cartesiano para navegar en todas direcciones
  const contentOriginX =
    containerSize.width > 0 ? containerSize.width / 2 - CANVAS_WIDTH / 2 + offset.x : offset.x
  const contentOriginY =
    containerSize.height > 0 ? containerSize.height / 2 - CANVAS_HEIGHT / 2 + offset.y : offset.y

  const getMesaRenderSize = useCallback(
    (mesa: Pick<MesaEnCanvas, 'ancho' | 'alto'>) =>
      MESAS_LAYOUT_AVANZADO
        ? getMesaPixelSize({ ancho: mesa.ancho, alto: mesa.alto, cellSize: GRID_CELL_SIZE })
        : { width: GRID_CELL_SIZE, height: GRID_CELL_SIZE },
    [GRID_CELL_SIZE]
  )

  const fitPlanoToMesas = useCallback(() => {
    if (containerSize.width <= 0 || containerSize.height <= 0 || mesas.length === 0) return false

    const bounds = mesas.reduce(
      (acc, mesa) => {
        const size = getMesaRenderSize(mesa)
        return {
          minX: Math.min(acc.minX, mesa.x),
          minY: Math.min(acc.minY, mesa.y),
          maxX: Math.max(acc.maxX, mesa.x + size.width),
          maxY: Math.max(acc.maxY, mesa.y + size.height),
        }
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    )

    const boundsWidth = Math.max(GRID_CELL_SIZE, bounds.maxX - bounds.minX)
    const boundsHeight = Math.max(GRID_CELL_SIZE, bounds.maxY - bounds.minY)
    const availableWidth = Math.max(GRID_CELL_SIZE, containerSize.width - FIT_PADDING_PX * 2)
    const availableHeight = Math.max(GRID_CELL_SIZE, containerSize.height - FIT_PADDING_PX * 2)
    const nextScale = Math.max(
      FIT_MIN_SCALE,
      Math.min(FIT_MAX_SCALE, availableWidth / boundsWidth, availableHeight / boundsHeight)
    )

    setEscala(nextScale)
    setOffset({
      x:
        FIT_PADDING_PX -
        (containerSize.width / 2 - CANVAS_WIDTH / 2) -
        bounds.minX * nextScale,
      y:
        FIT_PADDING_PX -
        (containerSize.height / 2 - CANVAS_HEIGHT / 2) -
        bounds.minY * nextScale,
    })
    return true
  }, [CANVAS_HEIGHT, CANVAS_WIDTH, GRID_CELL_SIZE, containerSize, getMesaRenderSize, mesas])

  useLayoutEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 }
      setContainerSize({ width, height })
    })
    ro.observe(el)
    const { width, height } = el.getBoundingClientRect()
    setContainerSize({ width, height })
    return () => ro.disconnect()
  }, [])

  const fetchMesas = async () => {
    try {
      const response = await apiFetch('/api/mesas')
      if (response.status === 401) {
        localStorage.removeItem('user')
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
        window.location.href = '/login'
        return
      }
      const data = await response.json()

      if (data.success) {
        const mesasConPosicion = data.data.map((mesa: Mesa) => {
          // Si tiene posición, alinearla a la cuadrícula
          let x = mesa.posicionX ?? Math.floor(Math.random() * (CANVAS_WIDTH / GRID_CELL_SIZE)) * GRID_CELL_SIZE
          let y = mesa.posicionY ?? Math.floor(Math.random() * (CANVAS_HEIGHT / GRID_CELL_SIZE)) * GRID_CELL_SIZE
          
          // Alinear a la cuadrícula
          x = Math.round(x / GRID_CELL_SIZE) * GRID_CELL_SIZE
          y = Math.round(y / GRID_CELL_SIZE) * GRID_CELL_SIZE
          
          return {
            ...mesa,
            ...normalizeMesaLayout({
              forma: mesa.forma,
              ancho: mesa.ancho,
              alto: mesa.alto,
            }),
            x,
            y,
            rotation: mesa.rotacion ?? 0,
            isDragging: false,
            dragOffset: { x: 0, y: 0 },
          }
        })
        setMesas(mesasConPosicion)
      } else {
        toast.error('Error al cargar mesas')
      }
    } catch (error) {
      toast.error('Error al cargar mesas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMesas()
    fetchPlanta()
  }, [])

  useEffect(() => {
    if (loading || didInitialFitRef.current) return
    didInitialFitRef.current = fitPlanoToMesas()
  }, [fitPlanoToMesas, loading])

  const fetchPlanta = async () => {
    try {
      const response = await apiFetch('/api/plantas')
      if (response.status === 401) {
        localStorage.removeItem('user')
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
        window.location.href = '/login'
        return
      }
      const data = await response.json()
      if (data.success && data.data && data.data.length > 0) {
        // Usar la primera planta activa
        setPlanta(data.data[0])
        // Ajustar dimensiones del canvas si hay planta
        if (data.data[0].widthM && data.data[0].heightM) {
          // El canvas se ajustará automáticamente al renderizar el polígono
        }
      }
    } catch (error) {
      console.error('Error al cargar planta:', error)
    }
  }

  // Guardar posición de una mesa
  const guardarPosicionMesa = async (mesaId: string, x: number, y: number, rotation: number) => {
    const mesa = mesas.find((m) => m.id === mesaId)
    try {
      const response = await apiFetch(`/api/mesas/${mesaId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          posicionX: x,
          posicionY: y,
          rotacion: rotation,
          ...(MESAS_LAYOUT_AVANZADO && mesa
            ? { forma: mesa.forma, ancho: mesa.ancho, alto: mesa.alto }
            : {}),
        }),
      })
      if (response.status === 401) {
        localStorage.removeItem('user')
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
        window.location.href = '/login'
        return
      }
      const data = await response.json()
      if (!data.success) {
        toast.error('Error al guardar posición')
      }
    } catch (error) {
      console.error('Error al guardar posición:', error)
    }
  }

  // Guardar todas las posiciones
  const guardarTodasLasPosiciones = async () => {
    setGuardando(true)
    try {
      await Promise.all(
        mesas.map((mesa) => guardarPosicionMesa(mesa.id, mesa.x, mesa.y, mesa.rotation))
      )
      toast.success('Posiciones guardadas correctamente')
      setModoEdicion(false)
    } catch (error) {
      toast.error('Error al guardar posiciones')
    } finally {
      setGuardando(false)
    }
  }

  // Manejo de arrastre de mesas
  const handleMesaMouseDown = (e: React.MouseEvent, mesaId: string) => {
    if (!modoEdicion) return

    e.stopPropagation()
    const mesa = mesas.find((m) => m.id === mesaId)
    if (!mesa) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const canvasX = (e.clientX - rect.left - contentOriginX) / escala
    const canvasY = (e.clientY - rect.top - contentOriginY) / escala

    setMesaSeleccionada(mesaId)
    setMesas((prev) =>
      prev.map((m) =>
        m.id === mesaId
          ? {
              ...m,
              isDragging: true,
              dragOffset: {
                x: canvasX - m.x,
                y: canvasY - m.y,
              },
            }
          : m
      )
    )
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!canvasRef.current) return

      const rect = canvasRef.current.getBoundingClientRect()
      const canvasX = (e.clientX - rect.left - contentOriginX) / escala
      const canvasY = (e.clientY - rect.top - contentOriginY) / escala

      // Arrastrar canvas (clic central ratón)
      if (isDraggingCanvas) {
        setOffset({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        })
        return
      }

      // Arrastrar mesa
      const mesaArrastrando = mesas.find((m) => m.isDragging)
      if (mesaArrastrando) {
        let newX = canvasX - mesaArrastrando.dragOffset.x
        let newY = canvasY - mesaArrastrando.dragOffset.y
        
        // Alinear a la cuadrícula (snap to grid)
        newX = Math.round(newX / GRID_CELL_SIZE) * GRID_CELL_SIZE
        newY = Math.round(newY / GRID_CELL_SIZE) * GRID_CELL_SIZE
        
        // Limitar dentro del canvas
        newX = Math.max(0, Math.min(CANVAS_WIDTH - GRID_CELL_SIZE, newX))
        newY = Math.max(0, Math.min(CANVAS_HEIGHT - GRID_CELL_SIZE, newY))
        
        setMesas((prev) =>
          prev.map((m) =>
            m.id === mesaArrastrando.id
              ? {
                  ...m,
                  x: newX,
                  y: newY,
                }
              : m
          )
        )
      }
    },
    [mesas, isDraggingCanvas, dragStart, offset, escala, contentOriginX, contentOriginY]
  )

  const handleMouseUp = useCallback(() => {
    setIsDraggingCanvas(false)
    setMesas((prev) =>
      prev.map((m) => ({
        ...m,
        isDragging: false,
        dragOffset: { x: 0, y: 0 },
      }))
    )
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  // Pan y zoom con dos dedos (touch)
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return

    const getCentroid = (touches: TouchList) => {
      const a = touches[0], b = touches[1]
      return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }
    }
    const getDist = (touches: TouchList) => {
      const a = touches[0], b = touches[1]
      return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY) || 1
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      e.preventDefault()
      e.stopPropagation()
      const { offset, escala } = offsetScaleRef.current
      const c = getCentroid(e.touches), d = getDist(e.touches)
      touchStateRef.current = {
        active: true,
        gesture: null,
        lastCX: c.x,
        lastCY: c.y,
        lastDist: d,
        lastOffsetX: offset.x,
        lastOffsetY: offset.y,
        lastScale: escala,
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      const ts = touchStateRef.current
      if (!ts?.active || e.touches.length !== 2) return
      e.preventDefault()
      const c = getCentroid(e.touches), d = getDist(e.touches)
      const dx = c.x - ts.lastCX
      const dy = c.y - ts.lastCY
      const moveDelta = Math.hypot(dx, dy)
      const distDelta = Math.abs(d - ts.lastDist)
      const distChangeRatio = ts.lastDist > 0 ? distDelta / ts.lastDist : 0

      let gesture = ts.gesture
      if (gesture === null) {
        const pinchDominant = distChangeRatio > 0.08 && distDelta > moveDelta * 1.5
        if (pinchDominant) {
          gesture = 'zoom'
        } else if (moveDelta > 2) {
          gesture = 'pan'
        } else {
          ts.lastCX = c.x
          ts.lastCY = c.y
          ts.lastDist = d
          return
        }
        ts.gesture = gesture
      }

      if (gesture === 'pan') {
        // Dirección natural: arrastrar a la derecha = mapa se mueve a la derecha (como agarrar el mapa)
        const newOx = ts.lastOffsetX - dx
        const newOy = ts.lastOffsetY - dy
        setOffset({ x: newOx, y: newOy })
        ts.lastCX = c.x
        ts.lastCY = c.y
        ts.lastOffsetX = newOx
        ts.lastOffsetY = newOy
      } else {
        const scaleFactor = d / ts.lastDist
        const newScale = Math.max(0.5, Math.min(3, ts.lastScale * scaleFactor))
        setEscala(newScale)
        ts.lastDist = d
        ts.lastScale = newScale
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) touchStateRef.current = null
    }

    const opts = { passive: false, capture: true }
    el.addEventListener('touchstart', onTouchStart, opts)
    el.addEventListener('touchmove', onTouchMove, opts)
    el.addEventListener('touchend', onTouchEnd, true)
    el.addEventListener('touchcancel', onTouchEnd, true)
    return () => {
      el.removeEventListener('touchstart', onTouchStart, true)
      el.removeEventListener('touchmove', onTouchMove, true)
      el.removeEventListener('touchend', onTouchEnd, true)
      el.removeEventListener('touchcancel', onTouchEnd, true)
    }
  }, [loading])

  // Manejo de touch para móviles (una mesa, modo edición)
  const handleTouchStart = (e: React.TouchEvent, mesaId: string) => {
    if (!modoEdicion) return

    e.stopPropagation()
    const touch = e.touches[0]
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const canvasX = (touch.clientX - rect.left - contentOriginX) / escala
    const canvasY = (touch.clientY - rect.top - contentOriginY) / escala

    setMesaSeleccionada(mesaId)
    setMesas((prev) =>
      prev.map((m) =>
        m.id === mesaId
          ? {
              ...m,
              isDragging: true,
              dragOffset: {
                x: canvasX - m.x,
                y: canvasY - m.y,
              },
            }
          : m
      )
    )
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!canvasRef.current) return

    const touch = e.touches[0]
    const rect = canvasRef.current.getBoundingClientRect()
    const canvasX = (touch.clientX - rect.left - contentOriginX) / escala
    const canvasY = (touch.clientY - rect.top - contentOriginY) / escala

    const mesaArrastrando = mesas.find((m) => m.isDragging)
    if (mesaArrastrando) {
      let newX = canvasX - mesaArrastrando.dragOffset.x
      let newY = canvasY - mesaArrastrando.dragOffset.y
      
      // Alinear a la cuadrícula (snap to grid)
      newX = Math.round(newX / GRID_CELL_SIZE) * GRID_CELL_SIZE
      newY = Math.round(newY / GRID_CELL_SIZE) * GRID_CELL_SIZE
      
      // Limitar dentro del canvas
      newX = Math.max(0, Math.min(CANVAS_WIDTH - GRID_CELL_SIZE, newX))
      newY = Math.max(0, Math.min(CANVAS_HEIGHT - GRID_CELL_SIZE, newY))
      
      setMesas((prev) =>
        prev.map((m) =>
          m.id === mesaArrastrando.id
            ? {
                ...m,
                x: newX,
                y: newY,
              }
            : m
        )
      )
    }
  }

  const handleTouchEnd = () => {
    setMesas((prev) =>
      prev.map((m) => ({
        ...m,
        isDragging: false,
        dragOffset: { x: 0, y: 0 },
      }))
    )
  }

  // Rotar mesa (doble clic o botón)
  const rotarMesa = (mesaId: string) => {
    setMesas((prev) =>
      prev.map((m) =>
        m.id === mesaId ? { ...m, rotation: (m.rotation + 90) % 360 } : m
      )
    )
  }

  const actualizarLayoutMesa = (
    mesaId: string,
    next: Partial<{ forma: FormaMesaLayout; ancho: number; alto: number }>
  ) => {
    setMesas((prev) =>
      prev.map((m) =>
        m.id === mesaId
          ? {
              ...m,
              ...normalizeMesaLayout({
                forma: next.forma ?? m.forma,
                ancho: next.ancho ?? m.ancho,
                alto: next.alto ?? m.alto,
              }),
            }
          : m
      )
    )
  }

  offsetScaleRef.current = { offset, escala }

  // Trackpad: solo pinch (ctrl/meta) = zoom. Dos dedos en cualquier dirección = pan.
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const isPinchZoom = e.ctrlKey || e.metaKey
    if (isPinchZoom) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setEscala((prev) => Math.max(0.5, Math.min(3, prev * delta)))
    } else {
      setOffset((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }))
    }
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Cargando planta del restaurante...</div>
      </div>
    )
  }

  return (
    <div className="app-shell relative h-screen w-full overflow-hidden text-black">
      {/* Canvas de la planta — pantalla completa */}
      <div className="absolute inset-0 overflow-hidden bg-white">
        <div
          ref={canvasRef}
          className="relative bg-gray-100 w-full h-full"
          style={{
            overflow: 'hidden',
            cursor: isDraggingCanvas ? 'grabbing' : 'grab',
          }}
          onWheel={handleWheel}
          onMouseDown={(e) => {
            // Botón central O botón izquierdo (para trackpads donde wheel diagonal falla en Chrome)
            if (e.button === 1 || e.button === 0) {
              if (e.button === 0) {
                // Solo pan con izquierdo si el click fue en el fondo (no en una mesa)
                const target = e.target as HTMLElement
                const clickedMesa = target.closest('[data-mesa-id]')
                if (clickedMesa) return // En una mesa: dejar que maneje drag de mesa o click
              }
              e.preventDefault()
              setIsDraggingCanvas(true)
              setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
            }
          }}
        >
          {/* Grid de fondo */}
          <svg
            className="absolute inset-0"
            style={{
              transform: `translate(${contentOriginX}px, ${contentOriginY}px) scale(${escala})`,
              transformOrigin: '0 0',
            }}
          >
            <defs>
              <pattern
                id="grid"
                width={GRID_CELL_SIZE}
                height={GRID_CELL_SIZE}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${GRID_CELL_SIZE} 0 L 0 0 0 ${GRID_CELL_SIZE}`}
                  fill="none"
                  stroke="#d1d5db"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#grid)" />

            {/* Contorno del cuarto (polígono) */}
            {planta && planta.vertices && planta.vertices.length >= 3 && (
              <g>
                {/* Convertir vértices de celda a píxeles */}
                {(() => {
                  const bounds = {
                    minX: Math.min(...planta.vertices.map(v => v.x)),
                    minY: Math.min(...planta.vertices.map(v => v.y)),
                  }
                  
                  const points = planta.vertices
                    .map(v => {
                      const x = (v.x - bounds.minX) * GRID_CELL_SIZE
                      const y = (v.y - bounds.minY) * GRID_CELL_SIZE
                      return `${x},${y}`
                    })
                    .join(' ')

                  return (
                    <>
                      {/* Polígono con borde más grueso para delimitar bien */}
                      <polygon
                        points={points}
                        fill="#dbeafe"
                        fillOpacity="0.2"
                        stroke="#1e40af"
                        strokeWidth="4"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      {/* Borde interior para mejor visibilidad */}
                      <polygon
                        points={points}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      {/* Vértices del polígono más visibles */}
                      {planta.vertices.map((vertex, index) => {
                        const x = (vertex.x - bounds.minX) * GRID_CELL_SIZE
                        const y = (vertex.y - bounds.minY) * GRID_CELL_SIZE
                        return (
                          <g key={index}>
                            <circle
                              cx={x}
                              cy={y}
                              r="6"
                              fill="#1e40af"
                              stroke="white"
                              strokeWidth="2"
                            />
                            <text
                              x={x}
                              y={y - 12}
                              textAnchor="middle"
                              className="text-xs font-bold fill-white"
                              style={{ fontSize: '10px' }}
                            >
                              {index + 1}
                            </text>
                          </g>
                        )
                      })}
                    </>
                  )
                })()}
              </g>
            )}
          </svg>

          {/* Mesas */}
          <div
            className="absolute"
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              transform: `translate(${contentOriginX}px, ${contentOriginY}px) scale(${escala})`,
              transformOrigin: '0 0',
            }}
          >
            {mesas.map((mesa) => {
              const size = getMesaRenderSize(mesa)
              const isCircular = MESAS_LAYOUT_AVANZADO && mesa.forma === 'CIRCULAR'

              return (
                <div
                  key={mesa.id}
                  data-mesa-id={mesa.id}
                  className={`absolute cursor-${modoEdicion ? 'move' : 'pointer'} transition-all ${
                    mesa.isDragging ? 'z-50 opacity-80' : 'z-10'
                  } ${mesaSeleccionada === mesa.id ? 'ring-2 ring-blue-500' : ''}`}
                  style={{
                    left: `${mesa.x}px`,
                    top: `${mesa.y}px`,
                    width: `${size.width}px`,
                    height: `${size.height}px`,
                    transform: `rotate(${mesa.rotation}deg)`,
                    transformOrigin: 'center center',
                  }}
                  onMouseDown={(e) => handleMesaMouseDown(e, mesa.id)}
                  onTouchStart={(e) => handleTouchStart(e, mesa.id)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onDoubleClick={() => modoEdicion && rotarMesa(mesa.id)}
                  onClick={() => {
                    if (!modoEdicion) {
                      if (mesa.comandaActual) {
                        router.push(`/dashboard/comandas/${mesa.comandaActual.numeroComanda}`)
                      } else {
                        router.push(`/dashboard/comandas/nueva?mesaId=${mesa.id}`)
                      }
                    }
                  }}
                  title={modoEdicion ? `Mesa ${mesa.numero} - Arrastra para mover` : `Mesa ${mesa.numero}`}
                >
                  <div
                    className="shadow-lg border-2 border-white flex flex-col items-center justify-center text-white font-bold text-sm"
                    style={{
                      width: `${size.width}px`,
                      height: `${size.height}px`,
                      borderRadius: isCircular ? '9999px' : '0.75rem',
                      backgroundColor: estadoColors[mesa.estado as keyof typeof estadoColors] || '#64748b',
                      transform: `rotate(${-mesa.rotation}deg)`,
                    }}
                  >
                    <div className="text-xs">M{mesa.numero}</div>
                    <div className="text-xs opacity-90">👥{mesa.capacidad}</div>
                  </div>

                {/* Etiqueta con número de mesa */}
                <div
                  className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-gray-700 whitespace-nowrap bg-white px-1 rounded"
                  style={{
                    transform: `translate(-50%, 0) rotate(${-mesa.rotation}deg)`,
                  }}
                >
                  Mesa {mesa.numero}
                </div>
                
                {/* Indicador de posición en cuadrícula */}
                {modoEdicion && (
                  <div
                    className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded"
                    style={{
                      transform: `translate(-50%, 0) rotate(${-mesa.rotation}deg)`,
                    }}
                  >
                    Celda: ({Math.round(mesa.x / GRID_CELL_SIZE)}, {Math.round(mesa.y / GRID_CELL_SIZE)})
                  </div>
                )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Header — transparente, solo botones visibles sobre el mapa */}
      <header className="absolute top-0 left-0 right-0 z-10 flex flex-wrap gap-2 items-center justify-between p-2 md:p-3 pointer-events-none">
        <div className="flex items-center gap-2 flex-wrap pointer-events-auto">
          <BackButton className="rounded-lg px-2.5 py-1.5 text-sm font-medium" />
          <button
            onClick={() => setModoEdicion(!modoEdicion)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-colors ${
              modoEdicion
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-white/90 text-gray-800 hover:bg-white'
            }`}
          >
            {modoEdicion ? '✓ Edición' : '✎ Editar'}
          </button>
          {modoEdicion && (
            <>
              <button
                onClick={guardarTodasLasPosiciones}
                disabled={guardando}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : '💾 Guardar'}
              </button>
              <button
                onClick={() => {
                  setModoEdicion(false)
                  fetchMesas()
                }}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm bg-white/90 text-gray-800 hover:bg-white"
              >
                ✕ Cancelar
              </button>
            </>
          )}
          {modoEdicion && mesaSeleccionada && (
            <div className="flex items-center gap-2 rounded-2xl bg-white/90 px-2 py-1.5 shadow-sm">
              {MESAS_LAYOUT_AVANZADO && (() => {
                const mesa = mesas.find((m) => m.id === mesaSeleccionada)
                if (!mesa) return null
                return (
                  <>
                    <select
                      value={mesa.forma ?? 'RECTANGULAR'}
                      onChange={(event) =>
                        actualizarLayoutMesa(mesaSeleccionada, {
                          forma: event.target.value as FormaMesaLayout,
                        })
                      }
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800"
                    >
                      <option value="RECTANGULAR">Rectangular</option>
                      <option value="CIRCULAR">Circular</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs text-gray-700">
                      Ancho
                      <input
                        type="number"
                        min="0.75"
                        max="6"
                        step="0.25"
                        value={mesa.ancho ?? 1}
                        onChange={(event) =>
                          actualizarLayoutMesa(mesaSeleccionada, {
                            ancho: Number(event.target.value),
                          })
                        }
                        className="w-16 rounded border border-gray-300 px-1 py-0.5 text-xs text-gray-800"
                      />
                    </label>
                    {mesa.forma !== 'CIRCULAR' && (
                      <label className="flex items-center gap-1 text-xs text-gray-700">
                        Alto
                        <input
                          type="number"
                          min="0.75"
                          max="6"
                          step="0.25"
                          value={mesa.alto ?? 1}
                          onChange={(event) =>
                            actualizarLayoutMesa(mesaSeleccionada, {
                              alto: Number(event.target.value),
                            })
                          }
                          className="w-16 rounded border border-gray-300 px-1 py-0.5 text-xs text-gray-800"
                        />
                      </label>
                    )}
                  </>
                )
              })()}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap pointer-events-auto">
          <span className="rounded-2xl bg-white/90 px-2.5 py-1.5 text-center text-sm text-gray-700 shadow-sm min-w-[44px]">
            {Math.round(escala * 100)}%
          </span>
          <button
            onClick={() => {
              if (!fitPlanoToMesas()) toast('No hay mesas activas para encuadrar')
            }}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm bg-white/90 text-gray-800 hover:bg-white"
          >
            ⛶ Encuadrar
          </button>
          <button
            onClick={() => router.push('/dashboard/mesas/status')}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm bg-white/90 text-gray-800 hover:bg-white"
          >
            📋 Estado
          </button>
        </div>
      </header>

      {/* Leyenda — overlay sobre el canvas */}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-lg">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: estadoColors.LIBRE }} />
            <span className="text-xs">Libre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: estadoColors.OCUPADA }} />
            <span className="text-xs">Ocupada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: estadoColors.CUENTA_PEDIDA }} />
            <span className="text-xs">Cuenta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: estadoColors.RESERVADA }} />
            <span className="text-xs">Reservada</span>
          </div>
        </div>
      </div>
    </div>
  )
}
