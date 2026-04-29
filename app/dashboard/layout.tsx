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
const INVENTARIO_MVP =
  process.env.NEXT_PUBLIC_INVENTARIO_MVP === '1' ||
  process.env.NEXT_PUBLIC_INVENTARIO_MVP === 'true'

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
  const [tenantData, setTenantData] = useState<{
    activeOrganizacionId?: string | null
    activeRestauranteId?: string | null
    current: {
      restauranteId: string
      restauranteNombre: string
      restauranteSlug: string | null
      organizacionId: string | null
      organizacionNombre: string | null
    } | null
    branches: Array<{
      restauranteId: string
      restauranteNombre: string
      restauranteSlug: string | null
      organizacionId: string | null
      organizacionNombre: string | null
      esPrincipal: boolean
      isActive: boolean
    }>
    organizations: Array<{
      organizacionId: string
      organizacionNombre: string
      esOwner: boolean
    }>
    organizationBranches: Array<{
      organizacionId: string
      organizacionNombre: string
      branches: Array<{
        restauranteId: string
        restauranteNombre: string
        restauranteSlug: string | null
        esPrincipal: boolean
        isActive: boolean
      }>
    }>
  } | null>(null)
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [switchingBranch, setSwitchingBranch] = useState(false)
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
    const loadTenantData = async () => {
      try {
        const res = await fetch('/api/auth/tenancy', {
          cache: 'no-store',
          credentials: 'same-origin',
        })
        const data = (await res.json()) as {
          success?: boolean
          data?: {
            activeOrganizacionId?: string | null
            activeRestauranteId?: string | null
            current: {
              restauranteId: string
              restauranteNombre: string
              restauranteSlug: string | null
              organizacionId: string | null
              organizacionNombre: string | null
            } | null
            branches: Array<{
              restauranteId: string
              restauranteNombre: string
              restauranteSlug: string | null
              organizacionId: string | null
              organizacionNombre: string | null
              esPrincipal: boolean
              isActive: boolean
            }>
            organizations: Array<{
              organizacionId: string
              organizacionNombre: string
              esOwner: boolean
            }>
            organizationBranches: Array<{
              organizacionId: string
              organizacionNombre: string
              branches: Array<{
                restauranteId: string
                restauranteNombre: string
                restauranteSlug: string | null
                esPrincipal: boolean
                isActive: boolean
              }>
            }>
          }
        }
        if (data.success && data.data) {
          setTenantData(data.data)
          setSelectedOrgId(
            data.data.activeOrganizacionId ??
              data.data.current?.organizacionId ??
              data.data.organizations[0]?.organizacionId ??
              ''
          )
        }
      } catch {
        // no-op: no bloquea la operación principal del layout
      }
    }

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
        void loadTenantData()
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

  useEffect(() => {
    if (!checking && user && tenantData && tenantData.branches.length === 0) {
      router.replace('/acceso')
    }
  }, [checking, router, tenantData, user])

  const handleSwitchContext = async (payload: { restauranteId?: string; organizacionId?: string }) => {
    if (!tenantData || switchingBranch) return
    const currentId = tenantData.current?.restauranteId
    if (payload.restauranteId && payload.restauranteId === currentId) return
    setSwitchingBranch(true)
    try {
      const res = await fetch('/api/auth/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'No se pudo cambiar de sucursal')
      }

      const meRes = await fetch('/api/auth/me', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      const meData = (await meRes.json()) as { success?: boolean; data?: unknown }
      if (meData.success && meData.data) {
        localStorage.setItem('user', JSON.stringify(meData.data))
      }

      router.refresh()
      router.replace('/dashboard')
    } catch (error) {
      console.error('switch branch:', error)
    } finally {
      setSwitchingBranch(false)
    }
  }

  const visibleBranches =
    tenantData?.branches.filter((b) =>
      selectedOrgId ? (b.organizacionId ?? '__none__') === selectedOrgId : true
    ) ?? []

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
    { href: '/dashboard/solicitudes', label: 'Solicitudes', modulo: 'comandas' },
    { href: '/dashboard/cocina', label: 'Cocina', modulo: 'cocina' },
    { href: '/dashboard/barra', label: 'Barra', modulo: 'barra' },
    { href: '/dashboard/reportes', label: 'Reportes', modulo: 'reportes' },
    { href: '/dashboard/caja', label: 'Caja', modulo: 'caja' },
    ...(INVENTARIO_MVP
      ? [{ href: '/dashboard/inventario', label: 'Inventario', modulo: 'inventory.view' }]
      : []),
  ].filter((item) => {
    if (!item.modulo) return true
    if (item.href === '/dashboard/mesas') {
      return tienePermiso(user, 'mesas') || tienePermiso(user, 'tables.view')
    }
    return tienePermiso(user, item.modulo)
  })

  return (
    <div className="app-shell">
      <header className={`app-header-shell sticky top-0 z-20 transition-all duration-300 ease-out ${headerCompact ? 'xl:py-4' : ''}`}>
        <div
          className={`mx-auto flex max-w-7xl flex-col px-4 sm:px-6 lg:px-8 xl:flex-row xl:flex-wrap xl:items-center xl:justify-start xl:gap-x-6 xl:gap-y-3 transition-all duration-300 ${headerCompact ? 'gap-2 py-2 xl:gap-x-6 xl:gap-y-2 xl:py-4' : 'gap-4 py-4'}`}
        >
          <div
            className={`flex min-w-0 max-w-[min(100%,620px)] shrink-0 items-center transition-all duration-300`}
          >
            <div className="shrink-0">
              <BrandLogo
                size={headerCompact ? 'sm' : 'lg'}
                priority
                className={
                  headerCompact
                    ? 'h-11 w-40 xl:h-[84px] xl:w-[340px] xl:max-w-[min(46vw,360px)]'
                    : 'h-[88px] w-[340px] max-w-[min(46vw,360px)] xl:h-[96px] xl:w-[380px] xl:max-w-[min(50vw,400px)]'
                }
              />
            </div>
          </div>

          <div className="flex min-h-[44px] min-w-0 flex-1 flex-wrap items-center gap-2 justify-start">
            <ThemeToggle />
            {tenantData && tenantData.branches.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-3 py-1.5 text-xs text-stone-700 shadow-sm dark:border-stone-700 dark:bg-stone-900/70 dark:text-stone-200">
                {tenantData.organizations.length > 1 && (
                  <label className="flex items-center gap-2">
                    <span className="font-semibold">Organización</span>
                    <select
                      className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-800 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
                      value={selectedOrgId}
                      disabled={switchingBranch}
                      onChange={(e) => {
                        const nextOrgId = e.target.value
                        setSelectedOrgId(nextOrgId)
                        void handleSwitchContext({ organizacionId: nextOrgId })
                      }}
                    >
                      {tenantData.organizations.map((org) => (
                        <option key={org.organizacionId} value={org.organizacionId}>
                          {org.organizacionNombre}
                          {org.esOwner ? ' (owner)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="flex items-center gap-2">
                  <span className="font-semibold">Sucursal</span>
                  <select
                    className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-800 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
                    value={tenantData.current?.restauranteId ?? ''}
                    disabled={switchingBranch}
                    onChange={(e) => void handleSwitchContext({ restauranteId: e.target.value })}
                  >
                    {visibleBranches.map((branch) => (
                      <option key={branch.restauranteId} value={branch.restauranteId}>
                        {branch.restauranteNombre}
                        {branch.esPrincipal ? ' (principal)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
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







