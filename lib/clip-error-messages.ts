/**
 * Mensajes legibles en español para errores frecuentes de la API PinPad de Clip.
 */
export function formatClipPaymentErrorForUser(clipMessage: string): string {
  const m = clipMessage.trim()
  const lower = m.toLowerCase()

  if (lower.includes('unable to connect to pinpad') || lower.includes('pinpad terminal')) {
    return (
      'Clip no puede llegar al PinPad con el serial que enviamos. Muy frecuente: el serial de la API no es el de la etiqueta ' +
      '(suele ser uno que empieza por P8 y lo ves en el panel de Clip o en “Ver terminales disponibles”). ' +
      'Revisa también Ultra con internet, misma cuenta que las claves API, y vuelve a guardar Clave API + secreta en Configuración.'
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
