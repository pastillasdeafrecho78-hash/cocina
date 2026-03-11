'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BrandLogo from '@/components/BrandLogo'
import ThemeToggle from '@/components/ThemeToggle'
import { tienePermiso } from '@/lib/permisos'

const MOBILE_BREAKPOINT = 1280
const SCROLL_THRESHOLD = 60

function clearSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [checking, setChecking] = useState(true)
  const [headerCompact, setHeaderCompact] = useState(false)

  const checkScroll = useCallback(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
    if (!isMobile) {
      setHeaderCompact(false)
      return
    }
    setHeaderCompact(window.scrollY > SCROLL_THRESHOLD)
  }, [])

  useEffect(() => {
    checkScroll()
    window.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => {
      window.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      clearSession()
      router.replace('/login')
      setChecking(false)
      return
    }

    let cancelled = false
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (cancelled) return
        if (res.status === 401) {
          clearSession()
          router.replace('/login')
          setChecking(false)
          return
        }
        return res.json()
      })
      .then((data) => {
        if (cancelled || !data) return
        if (!data.success || !data.data) {
          clearSession()
          router.replace('/login')
          setChecking(false)
          return
        }
        const u = data.data
        if (!u.activo) {
          clearSession()
          router.replace('/login')
          setChecking(false)
          return
        }
        localStorage.setItem('user', JSON.stringify(u))
        setUser(u)
        setChecking(false)
      })
      .catch(() => {
        if (!cancelled) {
          clearSession()
          router.replace('/login')
          setChecking(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [router])

  if (checking || !user) {
    return (
      <div className="app-loading-shell">
        <div className="app-card text-center">
          <p className="app-kicker">Acceso</p>
          <div className="mt-2 text-lg font-medium text-stone-700">Verificando sesión...</div>
        </div>
      </div>
    )
  }

  const navItems = [
    { href: '/dashboard', label: 'Inicio', modulo: null },
    { href: '/dashboard/mesas', label: 'Mesas', modulo: 'mesas' },
    { href: '/dashboard/comandas', label: 'Comandas', modulo: 'comandas' },
    { href: '/dashboard/cocina', label: 'Cocina', modulo: 'cocina' },
    { href: '/dashboard/barra', label: 'Barra', modulo: 'barra' },
    { href: '/dashboard/reportes', label: 'Reportes', modulo: 'reportes' },
    { href: '/dashboard/caja', label: 'Caja', modulo: 'caja' },
  ].filter((item) => !item.modulo || tienePermiso(user, item.modulo))

  return (
    <div className="app-shell">
      <header className={`app-header-shell sticky top-0 z-20 transition-all duration-300 ease-out ${headerCompact ? 'xl:py-4' : ''}`}>
        <div className={`mx-auto flex max-w-7xl flex-col px-4 sm:px-6 lg:px-8 xl:flex-row xl:items-center xl:justify-between transition-all duration-300 ${headerCompact ? 'gap-0 py-2 xl:gap-4 xl:py-4' : 'gap-4 py-4'}`}>
          <div
            className={`flex items-center gap-5 overflow-hidden transition-all duration-300 ease-out xl:min-w-[640px] xl:max-h-none xl:opacity-100 xl:py-0 ${
              headerCompact ? 'max-h-0 opacity-0 py-0' : 'max-h-64 opacity-100'
            }`}
          >
            <div className="shrink-0">
              <BrandLogo
                size="lg"
                priority
                className="h-[92px] w-[420px] max-w-[42vw]"
              />
            </div>
            <div className="min-w-0">
              <p className="app-kicker">Operación y servicio inteligente</p>
              <p className="text-lg font-semibold text-stone-900">
                {user.nombre} {user.apellido}
              </p>
              <p className="text-sm text-stone-500">{user.rol?.nombre || 'Sin rol'}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="app-chip hover:border-amber-300 hover:bg-amber-50">
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                clearSession()
                router.push('/login')
              }}
              className="app-btn-danger"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  )
}








