/** Utilidades compartidas para Mesas (tiempo de espera, colores progresivos). */

export function formatWaitTime(fechaCreacion: string): string {
  const now = Date.now()
  const t = new Date(fechaCreacion).getTime()
  const min = Math.floor((now - t) / 60000)
  if (min < 0) return '0 min'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export function minutosDesde(fechaCreacion: string): number {
  return Math.floor((Date.now() - new Date(fechaCreacion).getTime()) / 60000)
}

const COLOR_VERDE = '#22c55e'
const COLOR_AMARILLO = '#eab308'
const COLOR_ROJO = '#ef4444'

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')
}

function lerpColor(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  const r = a[0] + (b[0] - a[0]) * t
  const g = a[1] + (b[1] - a[1]) * t
  const bl = a[2] + (b[2] - a[2]) * t
  return rgbToHex(r, g, bl)
}

/** Devuelve color hex progresivo según minutos (verde → amarillo → rojo). */
export function colorProgresivoPorMinutos(
  min: number,
  tiempoAmarilloMinutos: number,
  tiempoRojoMinutos: number
): string {
  if (min >= tiempoRojoMinutos) return COLOR_ROJO
  if (min >= tiempoAmarilloMinutos) {
    const t = (min - tiempoAmarilloMinutos) / (tiempoRojoMinutos - tiempoAmarilloMinutos)
    return lerpColor(COLOR_AMARILLO, COLOR_ROJO, Math.min(1, t))
  }
  const t = tiempoAmarilloMinutos > 0 ? Math.min(1, min / tiempoAmarilloMinutos) : 1
  return lerpColor(COLOR_VERDE, COLOR_AMARILLO, t)
}
