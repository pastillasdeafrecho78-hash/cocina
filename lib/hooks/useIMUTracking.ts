import { useState, useEffect, useRef, useCallback } from 'react'

interface Position {
  x: number // metros
  y: number // metros
}

interface IMUTrackingState {
  isTracking: boolean
  currentPosition: Position
  heading: number // grados (0-360)
  stepCount: number
  lastStepTime: number | null
  velocity: number // m/s
  /** Aceleración XYZ (m/s²), incluida gravedad. null si no hay datos. */
  acceleration: { x: number; y: number; z: number } | null
}

const STEP_LENGTH_M = 0.7 // Longitud promedio de paso en metros
const STEP_THRESHOLD = 0.5 // Aceleración mínima para detectar paso (m/s²)
const HEADING_SMOOTHING = 0.8 // Factor de suavizado para heading (0-1)

export function useIMUTracking() {
  const [state, setState] = useState<IMUTrackingState>({
    isTracking: false,
    currentPosition: { x: 0, y: 0 },
    heading: 0,
    stepCount: 0,
    lastStepTime: null,
    velocity: 0,
    acceleration: null,
  })

  const lastAccelerationRef = useRef<{ x: number; y: number; z: number } | null>(null)
  const lastHeadingRef = useRef<number>(0)
  const lastUpdateTimeRef = useRef<number>(Date.now())
  const accelerationBufferRef = useRef<number[]>([])

  // Detectar paso basado en aceleración
  const detectStep = useCallback((acceleration: { x: number; y: number; z: number }) => {
    if (!lastAccelerationRef.current) {
      lastAccelerationRef.current = acceleration
      return false
    }

    // Calcular magnitud de aceleración
    const magnitude = Math.sqrt(
      acceleration.x ** 2 + acceleration.y ** 2 + acceleration.z ** 2
    )
    const lastMagnitude = Math.sqrt(
      lastAccelerationRef.current.x ** 2 +
      lastAccelerationRef.current.y ** 2 +
      lastAccelerationRef.current.z ** 2
    )

    // Detectar pico de aceleración (paso)
    const delta = magnitude - lastMagnitude
    accelerationBufferRef.current.push(magnitude)
    if (accelerationBufferRef.current.length > 10) {
      accelerationBufferRef.current.shift()
    }

    const avgAcceleration = accelerationBufferRef.current.reduce((a, b) => a + b, 0) / accelerationBufferRef.current.length

    // Detectar paso cuando hay un pico significativo
    if (delta > STEP_THRESHOLD && magnitude > avgAcceleration * 1.2) {
      const now = Date.now()
      const timeSinceLastStep = state.lastStepTime ? now - state.lastStepTime : 1000

      // Evitar detecciones muy cercanas (mínimo 300ms entre pasos)
      if (timeSinceLastStep > 300) {
        lastAccelerationRef.current = acceleration
        return true
      }
    }

    lastAccelerationRef.current = acceleration
    return false
  }, [state.lastStepTime])

  // Actualizar posición basado en paso detectado
  const updatePositionFromStep = useCallback((heading: number) => {
    setState((prev) => {
      const headingRad = (heading * Math.PI) / 180
      const newX = prev.currentPosition.x + STEP_LENGTH_M * Math.cos(headingRad)
      const newY = prev.currentPosition.y + STEP_LENGTH_M * Math.sin(headingRad)

      return {
        ...prev,
        currentPosition: { x: newX, y: newY },
        stepCount: prev.stepCount + 1,
        lastStepTime: Date.now(),
      }
    })
  }, [])

  // Manejar evento de orientación del dispositivo
  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    if (!state.isTracking) return

    // alpha: rotación alrededor del eje Z (0-360 grados)
    // beta: inclinación hacia adelante/atrás (-180 a 180)
    // gamma: inclinación izquierda/derecha (-90 a 90)

    let heading = e.alpha || 0

    // Normalizar heading a 0-360
    if (heading < 0) heading += 360
    if (heading > 360) heading -= 360

    // Suavizar heading para evitar saltos bruscos
    const smoothedHeading =
      lastHeadingRef.current * (1 - HEADING_SMOOTHING) + heading * HEADING_SMOOTHING

    lastHeadingRef.current = smoothedHeading

    setState((prev) => ({
      ...prev,
      heading: smoothedHeading,
    }))
  }, [state.isTracking])

  // Manejar evento de movimiento del dispositivo
  const handleMotion = useCallback((e: DeviceMotionEvent) => {
    if (!state.isTracking) return

    const acc = e.accelerationIncludingGravity
    if (!acc) return

    const ax = acc.x ?? 0
    const ay = acc.y ?? 0
    const az = acc.z ?? 0

    const now = Date.now()
    lastUpdateTimeRef.current = now

    const velocity = Math.sqrt(ax * ax + ay * ay + az * az)

    setState((prev) => ({
      ...prev,
      velocity,
      acceleration: { x: ax, y: ay, z: az },
    }))

    if (detectStep({ x: ax, y: ay, z: az })) {
      updatePositionFromStep(state.heading)
    }
  }, [state.isTracking, state.heading, detectStep, updatePositionFromStep])

  // Iniciar tracking
  const startTracking = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isTracking: true,
      currentPosition: { x: 0, y: 0 },
      stepCount: 0,
      lastStepTime: null,
      heading: 0,
      acceleration: null,
    }))
    lastAccelerationRef.current = null
    lastHeadingRef.current = 0
    lastUpdateTimeRef.current = Date.now()
    accelerationBufferRef.current = []
  }, [])

  // Detener tracking
  const stopTracking = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isTracking: false,
      acceleration: null,
    }))
  }, [])

  // Resetear posición (para marcar origen)
  const resetPosition = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentPosition: { x: 0, y: 0 },
      stepCount: 0,
      lastStepTime: null,
    }))
    lastAccelerationRef.current = null
    accelerationBufferRef.current = []
  }, [])

  // Suscribirse a eventos de sensores
  useEffect(() => {
    if (!state.isTracking) return

    // Solicitar permisos (algunos navegadores lo requieren)
    if (typeof DeviceOrientationEvent !== 'undefined') {
      // iOS 13+ requiere gestos del usuario, pero intentamos
      window.addEventListener('deviceorientation', handleOrientation as any, true)
    }

    if (typeof DeviceMotionEvent !== 'undefined') {
      window.addEventListener('devicemotion', handleMotion as any, true)
    }

    return () => {
      if (typeof DeviceOrientationEvent !== 'undefined') {
        window.removeEventListener('deviceorientation', handleOrientation as any, true)
      }
      if (typeof DeviceMotionEvent !== 'undefined') {
        window.removeEventListener('devicemotion', handleMotion as any, true)
      }
    }
  }, [state.isTracking, handleOrientation, handleMotion])

  return {
    ...state,
    startTracking,
    stopTracking,
    resetPosition,
  }
}
