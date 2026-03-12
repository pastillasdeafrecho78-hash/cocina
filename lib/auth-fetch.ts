/**
 * Fetch autenticado que maneja 401 de forma consistente.
 * Evita caché y asegura que el token se envíe correctamente.
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  if (typeof window === 'undefined') {
    throw new Error('authFetch solo puede usarse en el cliente')
  }

  const token = localStorage.getItem('token')?.trim()
  if (!token) {
    redirectToLogin()
    return new Response(null, { status: 401 })
  }

  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(url, {
    ...options,
    headers,
    cache: 'no-store',
    credentials: 'same-origin',
  })

  if (response.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    redirectToLogin()
  }

  return response
}

function redirectToLogin() {
  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
}
