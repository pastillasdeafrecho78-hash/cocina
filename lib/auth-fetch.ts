'use client'

import { signOut } from 'next-auth/react'

/**
 * Fetch a la API con cookie de sesión HttpOnly (sin Authorization manual).
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    cache: 'no-store',
    credentials: 'same-origin',
  })
}

/**
 * Fetch autenticado que maneja 401 de forma consistente.
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  if (typeof window === 'undefined') {
    throw new Error('authFetch solo puede usarse en el cliente')
  }

  const response = await apiFetch(url, options)

  if (response.status === 401) {
    localStorage.removeItem('user')
    await signOut({ redirect: false })
    redirectToLogin()
  }

  return response
}

function redirectToLogin() {
  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
}
