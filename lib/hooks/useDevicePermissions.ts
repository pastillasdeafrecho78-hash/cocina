import { useState, useEffect, useCallback } from 'react'

interface PermissionsState {
  geolocation: PermissionState | null
  deviceMotion: PermissionState | null
  deviceOrientation: PermissionState | null
  requesting: boolean
}

/**
 * Hook para solicitar y verificar permisos del dispositivo
 */
export function useDevicePermissions() {
  const [permissions, setPermissions] = useState<PermissionsState>({
    geolocation: null,
    deviceMotion: null,
    deviceOrientation: null,
    requesting: false,
  })

  // Verificar permisos existentes
  const checkPermissions = useCallback(async () => {
    const newPermissions: PermissionsState = {
      geolocation: null,
      deviceMotion: null,
      deviceOrientation: null,
      requesting: false,
    }

    // Verificar geolocalización
    if ('geolocation' in navigator) {
      if ('permissions' in navigator) {
        try {
          const geoPermission = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
          newPermissions.geolocation = geoPermission.state
        } catch (error) {
          console.log('No se pudo verificar permiso de geolocalización:', error)
        }
      }
    }

    // Verificar DeviceMotion (iOS 13+ requiere permisos)
    if ('DeviceMotionEvent' in window && 'permissions' in navigator) {
      try {
        const motionPermission = await navigator.permissions.query({ name: 'accelerometer' as PermissionName })
        newPermissions.deviceMotion = motionPermission.state
      } catch (error) {
        // Algunos navegadores no soportan esta API
        console.log('No se pudo verificar permiso de DeviceMotion:', error)
      }
    }

    // Verificar DeviceOrientation (iOS 13+ requiere permisos)
    if ('DeviceOrientationEvent' in window && 'permissions' in navigator) {
      try {
        const orientationPermission = await navigator.permissions.query({ name: 'gyroscope' as PermissionName })
        newPermissions.deviceOrientation = orientationPermission.state
      } catch (error) {
        console.log('No se pudo verificar permiso de DeviceOrientation:', error)
      }
    }

    setPermissions(newPermissions)
  }, [])

  // Solicitar permiso de geolocalización
  const requestGeolocation = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        resolve(false)
        return
      }

      navigator.geolocation.getCurrentPosition(
        () => {
          setPermissions((prev) => ({ ...prev, geolocation: 'granted' }))
          resolve(true)
        },
        (error) => {
          console.error('Error al obtener geolocalización:', error)
          setPermissions((prev) => ({ ...prev, geolocation: 'denied' }))
          resolve(false)
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      )
    })
  }, [])

  // Solicitar permisos de sensores (requiere gesto del usuario en iOS)
  const requestSensorPermissions = useCallback(async (): Promise<boolean> => {
    setPermissions((prev) => ({ ...prev, requesting: true }))

    try {
      // Para iOS 13+, necesitamos un gesto del usuario
      // Intentamos activar los eventos directamente
      if ('DeviceMotionEvent' in window) {
        // Crear un evento temporal para solicitar permiso
        const requestPermission = () => {
          return new Promise<boolean>((resolve) => {
            const handler = (e: DeviceMotionEvent) => {
              window.removeEventListener('devicemotion', handler as any)
              resolve(true)
            }
            window.addEventListener('devicemotion', handler as any, { once: true })
            
            // Timeout después de 1 segundo
            setTimeout(() => {
              window.removeEventListener('devicemotion', handler as any)
              resolve(false)
            }, 1000)
          })
        }

        const granted = await requestPermission()
        
        if (granted) {
          setPermissions((prev) => ({
            ...prev,
            deviceMotion: 'granted',
            requesting: false,
          }))
          return true
        }
      }

      // Si no hay soporte para permisos explícitos, asumimos que están disponibles
      // (la mayoría de navegadores Android y desktop)
      setPermissions((prev) => ({
        ...prev,
        deviceMotion: 'prompt',
        deviceOrientation: 'prompt',
        requesting: false,
      }))
      return true
    } catch (error) {
      console.error('Error al solicitar permisos de sensores:', error)
      setPermissions((prev) => ({ ...prev, requesting: false }))
      return false
    }
  }, [])

  // Solicitar todos los permisos necesarios
  const requestAllPermissions = useCallback(async (): Promise<boolean> => {
    const geoGranted = await requestGeolocation()
    const sensorsGranted = await requestSensorPermissions()
    return geoGranted || sensorsGranted // Al menos uno debe funcionar
  }, [requestGeolocation, requestSensorPermissions])

  useEffect(() => {
    checkPermissions()
  }, [checkPermissions])

  return {
    permissions,
    checkPermissions,
    requestGeolocation,
    requestSensorPermissions,
    requestAllPermissions,
  }
}
