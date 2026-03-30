export function getPublicBaseUrl(): string {
  const configured = process.env.PUBLIC_BACKEND_BASE_URL?.trim()
  if (configured) {
    return configured.replace(/\/$/, '')
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000'
  }

  // Vercel inyecta VERCEL_URL (solo hostname, sin protocolo) en build y runtime.
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, '').replace(/\/$/, '')
    return `https://${host}`
  }

  throw new Error(
    'Sin URL pública para webhooks: define PUBLIC_BACKEND_BASE_URL en Vercel (ej. https://tu-dominio.com) o despliega en Vercel para usar VERCEL_URL automático.'
  )
}

