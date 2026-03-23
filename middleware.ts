import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken, getTokenFromRequest } from './lib/auth-jwt'

// Rutas públicas que no requieren autenticación
const publicRoutes = ['/login', '/api/auth/login', '/api/health']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Permitir rutas públicas
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }
  if (pathname.startsWith('/api/webhooks/')) {
    return NextResponse.next()
  }

  // Solo proteger rutas de API (las rutas del cliente manejan su propia autenticación)
  if (pathname.startsWith('/api/')) {
    // Verificar autenticación para rutas de API
    const token = getTokenFromRequest(request)

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Agregar información del usuario a los headers
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', payload.userId)
    requestHeaders.set('x-user-rol-id', payload.rolId)

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  // Permitir todas las demás rutas (el cliente maneja la autenticación)
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}








