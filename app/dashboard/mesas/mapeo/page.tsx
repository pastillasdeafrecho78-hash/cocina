'use client'

import { useState, useCallback, useEffect } from 'react'
import { apiFetch } from '@/lib/auth-fetch'
import { useRouter } from 'next/navigation'
import BackButton from '@/components/BackButton'
import toast from 'react-hot-toast'
import { useIMUTracking } from '@/lib/hooks/useIMUTracking'
import { useDevicePermissions } from '@/lib/hooks/useDevicePermissions'
import {
  quantize,
  dequantize,
  isSameCell,
  checkSelfIntersection,
  closePolygon,
  polygonBounds,
  type Point,
  type Edge,
} from '@/lib/utils/polygonUtils'

const CELL_SIZE_M = 1.0 // Tamaño de celda en metros

export default function MapeoPage() {
  const router = useRouter()
  const {
    isTracking,
    currentPosition,
    heading,
    stepCount,
    acceleration,
    startTracking,
    stopTracking,
    resetPosition,
  } = useIMUTracking()

  const [vertices, setVertices] = useState<Point[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [isMapping, setIsMapping] = useState(false)
  const [nombrePlanta, setNombrePlanta] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const [permisosSolicitados, setPermisosSolicitados] = useState(false)

  // Hook para permisos del dispositivo
  const {
    permissions,
    requestSensorPermissions,
  } = useDevicePermissions()

  // Solicitar solo sensores (acelerómetro) al cargar. Sin geolocalización.
  useEffect(() => {
    const solicitar = async () => {
      if (!permisosSolicitados) {
        const ok = await requestSensorPermissions()
        if (ok) {
          setPermisosSolicitados(true)
          toast.success('Sensores de movimiento activados')
        } else {
          toast.error('Permisos de sensores denegados. Necesarios para el mapeo.')
        }
      }
    }
    const t = setTimeout(solicitar, 500)
    return () => clearTimeout(t)
  }, [permisosSolicitados, requestSensorPermissions])

  // Iniciar mapeo (solo sensores: aceleración XYZ + orientación)
  const iniciarMapeo = useCallback(async () => {
    if (!permisosSolicitados) {
      const ok = await requestSensorPermissions()
      if (!ok) {
        toast.error('Se requieren permisos de sensores. Pulsa "Solicitar Sensores" y mueve el teléfono si hace falta.')
        return
      }
      setPermisosSolicitados(true)
    }

    if (!isTracking) {
      resetPosition()
      startTracking()
      toast.success('Sensores activados. Comprueba que veas X, Y, Z abajo. Camina hasta la primera esquina y "Marcar Punto".')
    }
    setIsMapping(true)
    setVertices([])
    setEdges([])
    setWarnings([])
  }, [isTracking, startTracking, resetPosition, permisosSolicitados, requestSensorPermissions])

  // Marcar vértice (esquina)
  const marcarPunto = useCallback(() => {
    if (!isMapping) {
      toast.error('Primero debes iniciar el mapeo')
      return
    }

    // Cuantizar posición actual a cuadrícula
    const cell = quantize(currentPosition, CELL_SIZE_M)

    // Si es el primer punto
    if (vertices.length === 0) {
      setVertices([cell])
      toast.success(`Punto 1 marcado en celda (${cell.x}, ${cell.y})`)
      return
    }

    // Verificar duplicados
    const lastVertex = vertices[vertices.length - 1]
    if (isSameCell(cell, lastVertex)) {
      toast.error('Estás en la misma celda que el punto anterior. Muévete más.')
      return
    }

    // Verificar auto-intersección
    const newVertices = [...vertices, cell]
    const newEdges = [...edges, { from: vertices.length - 1, to: vertices.length }]

    if (checkSelfIntersection(newVertices, newEdges, vertices.length)) {
      const warning = '⚠️ Advertencia: Este punto causaría una auto-intersección'
      setWarnings((prev) => [...prev, warning])
      toast.error(warning, { duration: 5000 })
      // Permitir pero advertir
    }

    setVertices(newVertices)
    setEdges(newEdges)
    toast.success(
      `Punto ${newVertices.length} marcado en celda (${cell.x}, ${cell.y}). Total: ${newVertices.length} puntos`
    )
  }, [isMapping, currentPosition, vertices, edges])

  // Finalizar y cerrar polígono
  const finalizarPoligono = useCallback(() => {
    if (vertices.length < 3) {
      toast.error('Se requieren al menos 3 puntos para cerrar el polígono')
      return
    }

    try {
      const closedEdges = closePolygon(vertices, edges)
      setEdges(closedEdges)
      toast.success('Polígono cerrado correctamente')
    } catch (error: any) {
      toast.error(error.message || 'Error al cerrar polígono')
    }
  }, [vertices, edges])

  // Guardar planta
  const guardarPlanta = useCallback(async () => {
    if (vertices.length < 3) {
      toast.error('Se requieren al menos 3 puntos para guardar la planta')
      return
    }

    if (!nombrePlanta.trim()) {
      toast.error('Ingresa un nombre para la planta')
      return
    }

    // Cerrar polígono si no está cerrado
    let finalEdges = edges
    if (edges.length < vertices.length) {
      try {
        finalEdges = closePolygon(vertices, edges)
      } catch (error) {
        toast.error('Error al cerrar polígono')
        return
      }
    }

    // Calcular dimensiones
    const bounds = polygonBounds(vertices)
    const widthM = bounds.width * CELL_SIZE_M
    const heightM = bounds.height * CELL_SIZE_M

    setGuardando(true)

    try {
      const response = await apiFetch('/api/plantas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: nombrePlanta,
          vertices,
          edges: finalEdges,
          cellSizeM: CELL_SIZE_M,
          originX: 0,
          originY: 0,
          widthM,
          heightM,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Planta guardada correctamente')
        router.push('/dashboard/mesas/planta')
      } else {
        toast.error(data.error || 'Error al guardar planta')
      }
    } catch (error) {
      toast.error('Error al guardar planta')
      console.error(error)
    } finally {
      setGuardando(false)
    }
  }, [vertices, edges, nombrePlanta, router])

  // Cancelar mapeo
  const cancelarMapeo = useCallback(() => {
    setIsMapping(false)
    stopTracking()
    setVertices([])
    setEdges([])
    setWarnings([])
    resetPosition()
  }, [stopTracking, resetPosition])

  // Convertir coordenadas de celda a píxeles para visualización
  const cellToPixel = useCallback((cell: Point, scale: number = 20): Point => {
    const bounds = polygonBounds(vertices.length > 0 ? vertices : [{ x: 0, y: 0 }])
    const offsetX = bounds.minX
    const offsetY = bounds.minY

    return {
      x: (cell.x - offsetX) * scale + 50,
      y: (cell.y - offsetY) * scale + 50,
    }
  }, [vertices])

  return (
    <div className="app-page min-h-screen bg-gray-50">
      <BackButton className="mb-4" />

      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          Mapeo del Contorno del Cuarto
        </h1>
        <p className="text-gray-600 mb-6">
          Usa los sensores de tu teléfono para mapear el contorno del cuarto caminando por las
          esquinas
        </p>

        {/* Instrucciones */}
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="font-semibold text-blue-900 mb-2">📋 Instrucciones:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>Pulsa &quot;Solicitar Sensores&quot; y acepta. Usamos solo aceleración XYZ (sin GPS).</li>
            <li>Pulsa &quot;Iniciar Mapeo&quot;. Comprueba que aparecen X, Y, Z abajo al mover el teléfono.</li>
            <li>Camina hasta la primera esquina del cuarto</li>
            <li>Pulsa &quot;Marcar Punto&quot; en cada esquina</li>
            <li>Pulsa &quot;Finalizar&quot; cuando hayas marcado todas las esquinas</li>
            <li>Pon nombre a la planta y guarda</li>
          </ol>
        </div>

        {/* Estado del tracking */}
        <div className="app-card mb-6 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Estado</div>
              <div className="text-lg font-semibold">
                {isTracking ? (
                  <span className="text-green-600">● Activo</span>
                ) : (
                  <span className="text-gray-400">○ Inactivo</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Posición (m)</div>
              <div className="text-lg font-semibold">
                ({currentPosition.x.toFixed(2)}, {currentPosition.y.toFixed(2)})
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Orientación</div>
              <div className="text-lg font-semibold">{Math.round(heading)}°</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Pasos</div>
              <div className="text-lg font-semibold">{stepCount}</div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm text-gray-600 mb-1">Celda actual (cuantizada)</div>
            <div className="text-lg font-semibold">
              ({quantize(currentPosition, CELL_SIZE_M).x},{' '}
              {quantize(currentPosition, CELL_SIZE_M).y})
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-sm font-medium text-gray-700 mb-2">Aceleración XYZ (m/s²)</div>
            <div className="font-mono text-lg font-semibold">
              {acceleration ? (
                <>
                  X: <span className="text-blue-600">{acceleration.x.toFixed(2)}</span>
                  {' · '}
                  Y: <span className="text-green-600">{acceleration.y.toFixed(2)}</span>
                  {' · '}
                  Z: <span className="text-purple-600">{acceleration.z.toFixed(2)}</span>
                </>
              ) : (
                <span className="text-gray-400">
                  {isTracking ? 'Esperando datos… Mueve el teléfono.' : 'Inicia el mapeo para ver datos.'}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              La posición se calcula con pasos detectados por la aceleración. Si XYZ no cambia, revisa permisos de sensores.
            </p>
          </div>
        </div>

        {/* Controles */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {!isMapping ? (
              <button
                onClick={iniciarMapeo}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
              >
                🚀 Iniciar Mapeo
              </button>
            ) : (
              <>
                <button
                  onClick={marcarPunto}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                >
                  📍 Marcar Punto ({vertices.length})
                </button>
                <button
                  onClick={finalizarPoligono}
                  disabled={vertices.length < 3}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✓ Finalizar Polígono
                </button>
                <button
                  onClick={cancelarMapeo}
                  className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
                >
                  ✕ Cancelar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Visualización del polígono */}
        {vertices.length > 0 && (
          <div className="app-card mb-6 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">
              Polígono ({vertices.length} puntos)
            </h3>
            <div className="relative border-2 border-gray-300 rounded bg-gray-50" style={{ height: '400px' }}>
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 800 400"
                className="absolute inset-0"
              >
                {/* Grid */}
                <defs>
                  <pattern
                    id="grid"
                    width={CELL_SIZE_M * 20}
                    height={CELL_SIZE_M * 20}
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d={`M ${CELL_SIZE_M * 20} 0 L 0 0 0 ${CELL_SIZE_M * 20}`}
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Polígono */}
                {vertices.length >= 2 && (
                  <polyline
                    points={vertices
                      .map((v, i) => {
                        const pixel = cellToPixel(v, 20)
                        return `${pixel.x},${pixel.y}`
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Cerrar polígono si está finalizado */}
                {edges.length >= vertices.length && vertices.length >= 3 && (
                  <line
                    x1={cellToPixel(vertices[vertices.length - 1], 20).x}
                    y1={cellToPixel(vertices[vertices.length - 1], 20).y}
                    x2={cellToPixel(vertices[0], 20).x}
                    y2={cellToPixel(vertices[0], 20).y}
                    stroke="#3b82f6"
                    strokeWidth="3"
                    strokeDasharray="5,5"
                  />
                )}

                {/* Vértices */}
                {vertices.map((vertex, index) => {
                  const pixel = cellToPixel(vertex, 20)
                  return (
                    <g key={index}>
                      <circle
                        cx={pixel.x}
                        cy={pixel.y}
                        r="8"
                        fill="#3b82f6"
                        stroke="white"
                        strokeWidth="2"
                      />
                      <text
                        x={pixel.x}
                        y={pixel.y - 15}
                        textAnchor="middle"
                        className="text-xs font-semibold fill-gray-700"
                      >
                        {index + 1}
                      </text>
                    </g>
                  )
                })}

                {/* Posición actual */}
                {isTracking && (
                  <g>
                    <circle
                      cx={cellToPixel(quantize(currentPosition, CELL_SIZE_M), 20).x}
                      cy={cellToPixel(quantize(currentPosition, CELL_SIZE_M), 20).y}
                      r="6"
                      fill="#10b981"
                      stroke="white"
                      strokeWidth="2"
                      opacity="0.7"
                    />
                  </g>
                )}
              </svg>
            </div>
          </div>
        )}

        {/* Advertencias */}
        {warnings.length > 0 && (
          <div className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Advertencias:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
              {warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Formulario para guardar */}
        {vertices.length >= 3 && edges.length >= vertices.length && (
          <div className="app-card mb-6 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Guardar Planta</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la Planta *
                </label>
                <input
                  type="text"
                  value={nombrePlanta}
                  onChange={(e) => setNombrePlanta(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                  placeholder="Ej: Salón Principal, Terraza, etc."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={guardarPlanta}
                  disabled={guardando || !nombrePlanta.trim()}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {guardando ? 'Guardando...' : '💾 Guardar Planta'}
                </button>
                <button
                  onClick={() => router.push('/dashboard/mesas/planta')}
                  className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Estado de permisos — solo sensores (aceleración), sin geolocalización */}
        <div className="app-card mb-6 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Permisos (solo sensores, sin GPS)</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">📱 Acelerómetro / Movimiento:</span>
              <span className={`text-sm font-semibold ${
                permissions.deviceMotion === 'granted' ? 'text-green-600' :
                permissions.deviceMotion === 'denied' ? 'text-red-600' :
                'text-yellow-600'
              }`}>
                {permissions.deviceMotion === 'granted' ? '✓ Concedido' :
                 permissions.deviceMotion === 'denied' ? '✗ Denegado' :
                 permissions.deviceMotion === 'prompt' ? '⏳ Pendiente' : '❓ No verificado'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">🧭 Orientación (brújula):</span>
              <span className={`text-sm font-semibold ${
                permissions.deviceOrientation === 'granted' ? 'text-green-600' :
                permissions.deviceOrientation === 'denied' ? 'text-red-600' :
                'text-yellow-600'
              }`}>
                {permissions.deviceOrientation === 'granted' ? '✓ Concedido' :
                 permissions.deviceOrientation === 'denied' ? '✗ Denegado' :
                 permissions.deviceOrientation === 'prompt' ? '⏳ Pendiente' : '❓ No verificado'}
              </span>
            </div>
            <div className="mt-4">
              <button
                onClick={async () => {
                  await requestSensorPermissions()
                  toast('Sensores solicitados. Mueve el teléfono si te lo pide.')
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700"
              >
                Solicitar Sensores
              </button>
            </div>
          </div>
        </div>

        {/* Nota sobre mapeo con aceleración */}
        <div className="rounded-2xl bg-gray-100 p-4 text-sm text-gray-600">
          <p className="font-semibold mb-1">ℹ️ Mapeo con aceleración XYZ (sin GPS):</p>
          <ul className="list-disc list-inside space-y-1">
            <li>El mapeo usa solo el acelerómetro y la orientación. No se usa geolocalización.</li>
            <li>Si no ves X, Y, Z arriba al mover el teléfono, da permiso a sensores y recarga si hace falta.</li>
            <li>En iOS: toca la pantalla tras &quot;Solicitar Sensores&quot; si te lo pide el sistema.</li>
            <li>HTTPS es necesario para los sensores.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
