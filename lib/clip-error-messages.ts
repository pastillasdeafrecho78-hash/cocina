/**
 * Mensajes legibles en español para errores frecuentes de la API PinPad de Clip.
 */
export function formatClipPaymentErrorForUser(clipMessage: string): string {
  const m = clipMessage.trim()
  const lower = m.toLowerCase()

  if (lower.includes('unable to connect to pinpad') || lower.includes('pinpad terminal')) {
    return (
      'Clip no puede llegar a la terminal con ese número de serie. Revisa: (1) la Ultra encendida y con internet; ' +
      '(2) que la terminal esté vinculada a la misma cuenta de Clip que las claves API; ' +
      '(3) que el serial sea exactamente el que muestra el panel de Clip (Ajustes / dispositivos), no solo el de la etiqueta si difiere; ' +
      '(4) credenciales Clave API + secreta guardadas de nuevo en Configuración.'
    )
  }

  if (lower.includes('unauthorized') || lower.includes('401')) {
    return 'Clip rechazó las credenciales. Vuelve a guardar Clave API y Clave secreta en Configuración.'
  }

  if (lower.includes('invalid') && lower.includes('serial')) {
    return 'Clip no reconoce ese número de serie. Cópialo del dashboard de Clip o de la app de la terminal.'
  }

  return m.length > 400 ? `${m.slice(0, 400)}…` : m
}
