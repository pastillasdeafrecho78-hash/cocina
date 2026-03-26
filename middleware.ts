import { NextResponse } from 'next/server'
import { auth } from './auth'

function isPublicApi(pathname: string): boolean {
  if (pathname.startsWith('/api/auth/signin')) return true
  if (pathname.startsWith('/api/auth/callback')) return true
  if (pathname.startsWith('/api/auth/session')) return true
  if (pathname === '/api/auth/csrf') return true
  if (pathname === '/api/auth/providers') return true
  if (pathname === '/api/auth/error') return true
  if (pathname === '/api/auth/oauth-slug') return true
  if (pathname === '/api/auth/register') return true
  if (pathname === '/api/auth/invites/accept') return true
  if (pathname === '/api/auth/signout') return true
  if (pathname === '/api/health') return true
  if (pathname.startsWith('/api/webhooks/')) return true
  return false
}

export default auth((req) => {
  const pathname = req.nextUrl.pathname
  const isLoggedIn = !!req.auth

  if (pathname.startsWith('/dashboard') && !isLoggedIn) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (pathname.startsWith('/api') && !isPublicApi(pathname) && !isLoggedIn) {
    return NextResponse.json(
      { success: false, error: 'No autenticado' },
      { status: 401 }
    )
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
