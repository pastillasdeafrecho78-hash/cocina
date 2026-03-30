'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import BrandLogo from '@/components/BrandLogo'
import ThemeToggle from '@/components/ThemeToggle'
import { tienePermiso } from '@/lib/permisos'

const MOBILE_BREAKPOINT = 768
const SCROLL_THRESHOLD = 40
const COMPACT_ENTER_THRESHOLD = 64
const COMPACT_EXIT_THRESHOLD = 28
const SCROLL_JITTER_PX = 4
const TOGGLE_COOLDOWN_MS = 180

async function clearSession() {
  localStorage.removeItem('user')
  await signOut({ redirect: false })
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
  const lastScrollYRef = useRef(0)
  const headerCompactRef = useRef(false)
  const lastToggleAtRef = useRef(0)

  useEffect(() => {
    headerCompactRef.current = headerCompact
  }, [headerCompact])

  const checkScroll = useCallback(() => {
    if (typeof window === 'undefined') return
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT
    if (!isMobile) {
      setHeaderCompact(false)
      lastScrollYRef.current = window.scrollY ?? 0
      return
    }
    const scrollTop =
      window.scrollY ??
      window.pageYOffset ??
      document.documentElement?.scrollTop ??
      document.body?.scrollTop ??
      0

    const prev = lastScrollYRef.current
    lastScrollYRef.current = scrollTop
    const diff = scrollTop - prev
    const now = Date.now()
    const isCompact = headerCompactRef.current

    if (Math.abs(diff) < SCROLL_JITTER_PX) return
    if (now - lastToggleAtRef.current < TOGGLE_COOLDOWN_MS) return

    if (scrollTop <= SCROLL_THRESHOLD || (isCompact && (scrollTop <= COMPACT_EXIT_THRESHOLD || diff < -SCROLL_JITTER_PX))) {
      if (isCompact) {
        setHeaderCompact(false)
        lastToggleAtRef.current = now
      }
      return
    }

    if (!isCompact && scrollTop >= COMPACT_ENTER_THRESHOLD && diff > SCROLL_JITTER_PX) {
      setHeaderCompact(true)
      lastToggleAtRef.current = now
    }
  }, [])

  useEffect(() => {
    checkScroll()
    let raf: number | null = null
    const throttledScroll = () => {
      if (raf !== null) return
      raf = requestAnimationFrame(() => {
        checkScroll()
        raf = null
      })
    }
    window.addEventListener('scroll', throttledScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => {
      window.removeEventListener('scroll', throttledScroll)
      window.removeEventListener('resize', checkScroll)
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [checkScroll])

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me', {
      cache: 'no-store',
      credentials: 'same-origin',
    })
      .then((res) => {
        if (cancelled) return
        if (res.status === 401) {
          void clearSession()
          router.replace('/login')
          setChecking(false)
          return
        }
        return res.json()
      })
      .then((data) => {
        if (cancelled || !data) return
        if (!data.success || !data.data) {
          void clearSession()
          router.replace('/login')
          setChecking(false)
          return
        }
        const u = data.data
        if (!u.activo) {
          void clearSession()
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
          void clearSession()
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
        <div
          className={`mx-auto flex max-w-7xl flex-col px-4 sm:px-6 lg:px-8 xl:flex-row xl:flex-wrap xl:items-center xl:justify-start xl:gap-x-6 xl:gap-y-3 transition-all duration-300 ${headerCompact ? 'gap-2 py-2 xl:gap-x-6 xl:gap-y-2 xl:py-4' : 'gap-4 py-4'}`}
        >
          <div
            className={`flex min-w-0 max-w-[min(100%,520px)] shrink-0 items-center gap-5 transition-all duration-300 ${
              headerCompact ? 'gap-2 xl:gap-5' : ''
            }`}
          >
            <div className="shrink-0">
              <BrandLogo
                size={headerCompact ? 'sm' : 'lg'}
                priority
                className={
                  headerCompact
                    ? 'h-9 w-32 xl:h-[72px] xl:w-[280px] xl:max-w-[min(38vw,300px)]'
                    : 'h-[72px] w-[280px] max-w-[min(38vw,300px)] xl:h-[72px] xl:w-[280px]'
                }
              />
            </div>
            <div className={`min-w-0 ${headerCompact ? 'hidden xl:block' : 'block'}`}>
              <p className="app-kicker">Operación y servicio inteligente</p>
              <p className="text-lg font-semibold text-stone-900 dark:text-stone-50">
                {user.nombre} {user.apellido}
              </p>
              <p className="text-sm text-stone-500 dark:text-stone-400">{user.rol?.nombre || 'Sin rol'}</p>
            </div>
          </div>

          <div className="flex min-h-[44px] min-w-0 flex-1 flex-wrap items-center gap-2 justify-start">
            <ThemeToggle />
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="app-chip hover:border-amber-300 hover:bg-amber-50">
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                void clearSession().then(() => router.push('/login'))
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








