export function getPublicBaseUrl(): string {
  const configured = process.env.PUBLIC_BACKEND_BASE_URL?.trim()
  if (configured) {
    return configured.replace(/\/$/, '')
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000'
  }

  throw new Error(
    'PUBLIC_BACKEND_BASE_URL no está configurada. Define una URL pública HTTPS para webhooks de Clip.'
  )
}

