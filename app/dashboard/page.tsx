'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { tienePermiso } from '@/lib/permisos'
import {
  TableCellsIcon,
  DocumentTextIcon,
  FireIcon,
  BeakerIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  RectangleStackIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline'
import { authFetch } from '@/lib/auth-fetch'
import { signOut } from 'next-auth/react'

interface EstadoConfiguracion {
  configuracionCompleta: boolean
  tieneDatosFiscales: boolean
  tienePAC: boolean
  tieneConekta: boolean
  tieneCSD: boolean
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [estadoConfig, setEstadoConfig] = useState<EstadoConfiguracion | null>(null)
  const [loading, setLoading] = useState(true)
  const [estadisticas, setEstadisticas] = useState({
    mesasOcupadas: 0,
    mesasTotal: 0,
    comandasActivas: 0,
    itemsCocina: 0,
    itemsBarra: 0,
  })

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const userData = JSON.parse(userStr)
      setUser(userData)
      if (tienePermiso(userData, 'configuracion')) verificarConfiguracion()
      cargarEstadisticas()
    }
    setLoading(false)
  }, [router])

  const verificarConfiguracion = async () => {
    try {
      const response = await authFetch('/api/configuracion/estado')
      if (response.status === 401) return
      const data = await response.json()
      if (data.success) {
        setEstadoConfig(data.data)
      }
    } catch (error) {
      console.error('Error verificando configuración:', error)
    }
  }

  const cargarEstadisticas = async () => {
    try {
      const res = await authFetch('/api/dashboard/estadisticas')
      if (res.status === 401) return

      const data = await res.json()
      if (data.success) {
        setEstadisticas(data.data)
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    void signOut({ redirect: false }).then(() => router.push('/login'))
  }

  if (loading || !user) {
    return (
      <div className="app-loading-shell">
        <div className="app-card text-center">
          <div className="text-stone-600">Cargando dashboard...</div>
        </div>
      </div>
    )
  }

  const allCards = [
    {
      title: 'Mesas',
      modulo: 'mesas' as const,
      icon: TableCellsIcon,
      href: '/dashboard/mesas',
      estadistica: `${estadisticas.mesasOcupadas}/${estadisticas.mesasTotal}`,
      descripcion: 'Ocupadas',
      color: estadisticas.mesasOcupadas > estadisticas.mesasTotal * 0.8 ? 'red' : 
             estadisticas.mesasOcupadas > estadisticas.mesasTotal * 0.5 ? 'yellow' : 'green',
    },
    {
      title: 'Comandas',
      modulo: 'comandas' as const,
      icon: DocumentTextIcon,
      href: '/dashboard/comandas',
      estadistica: estadisticas.comandasActivas.toString(),
      descripcion: 'Activas',
      color: 'blue',
    },
    {
      title: 'Carta',
      modulo: 'carta' as const,
      icon: RectangleStackIcon,
      href: '/dashboard/carta',
      estadistica: '',
      descripcion: 'Gestionar productos',
      color: 'blue',
    },
    {
      title: 'Cocina',
      modulo: 'cocina' as const,
      icon: FireIcon,
      href: '/dashboard/cocina',
      estadistica: estadisticas.itemsCocina.toString(),
      descripcion: 'Items pendientes',
      color: estadisticas.itemsCocina > 20 ? 'red' : 
             estadisticas.itemsCocina > 10 ? 'yellow' : 'green',
    },
    {
      title: 'Barra',
      modulo: 'barra' as const,
      icon: BeakerIcon,
      href: '/dashboard/barra',
      estadistica: estadisticas.itemsBarra.toString(),
      descripcion: 'Items pendientes',
      color: estadisticas.itemsBarra > 20 ? 'red' : 
             estadisticas.itemsBarra > 10 ? 'yellow' : 'green',
    },
    {
      title: 'Reportes',
      modulo: 'reportes' as const,
      icon: ChartBarIcon,
      href: '/dashboard/reportes',
      estadistica: '',
      descripcion: 'Ver reportes',
      color: 'blue',
    },
    {
      title: 'Caja',
      modulo: 'caja' as const,
      icon: BanknotesIcon,
      href: '/dashboard/caja',
      estadistica: '',
      descripcion: 'Corte X y Corte Z',
      color: 'blue',
    },
    {
      title: 'Configuración',
      modulo: 'configuracion' as const,
      icon: Cog6ToothIcon,
      href: '/dashboard/configuracion',
      estadistica: estadoConfig?.configuracionCompleta ? '✓' : '!',
      descripcion: estadoConfig?.configuracionCompleta ? 'Completa' : 'Pendiente',
      color: estadoConfig?.configuracionCompleta ? 'green' : 'yellow',
    },
    {
      title: 'Roles y Permisos',
      modulo: 'usuarios_roles' as const,
      icon: ShieldCheckIcon,
      href: '/dashboard/admin/roles',
      estadistica: '',
      descripcion: 'Gestionar roles',
      color: 'blue' as const,
    },
  ]

  const cards = allCards.filter((c) => tienePermiso(user, c.modulo))

  return (
    <div className="app-page">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="app-brand-panel p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="app-kicker">Centro de operación</span>
                <span className="mt-1 text-3xl font-semibold text-stone-900">
                  {user.nombre} {user.apellido}
                </span>
                <span className="text-sm capitalize text-stone-500">
                  {user.rol?.nombre?.toLowerCase() ?? 'sin rol'}
                </span>
                <span className="mt-2 max-w-2xl text-sm text-stone-600">
                  Gestiona servicio, tiempos y flujo operativo con una interfaz inspirada en
                  el ritmo de sala, cocina y barra.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="app-card-muted min-w-[120px] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Mesas</p>
                <p className="mt-2 text-2xl font-semibold text-stone-900">
                  {estadisticas.mesasOcupadas}/{estadisticas.mesasTotal}
                </p>
              </div>
              <div className="app-card-muted min-w-[120px] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Comandas</p>
                <p className="mt-2 text-2xl font-semibold text-stone-900">
                  {estadisticas.comandasActivas}
                </p>
              </div>
              <div className="app-card-muted min-w-[120px] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Cocina</p>
                <p className="mt-2 text-2xl font-semibold text-stone-900">
                  {estadisticas.itemsCocina}
                </p>
              </div>
              <div className="app-card-muted min-w-[120px] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Barra</p>
                <p className="mt-2 text-2xl font-semibold text-stone-900">
                  {estadisticas.itemsBarra}
                </p>
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="mt-5 app-btn-danger">
            Cerrar sesión
          </button>
        </section>

        {estadoConfig && !estadoConfig.configuracionCompleta && (
          <div className="rounded-[28px] border border-yellow-200 bg-yellow-50/90 p-5 shadow-sm dark:border-amber-400/40 dark:bg-amber-950/55">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-600 dark:text-amber-300" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-yellow-950 dark:text-amber-50">Configuración incompleta</h3>
                <div className="mt-2 text-sm text-yellow-900 dark:text-amber-100">
                  <p>Completa la configuración para habilitar facturación y pagos:</p>
                  <ul className="mt-1 list-disc list-inside">
                    {!estadoConfig.tieneDatosFiscales && <li>Datos fiscales</li>}
                    {!estadoConfig.tienePAC && <li>Configuración PAC (Facturación)</li>}
                    {!estadoConfig.tieneConekta && <li>Configuración de pagos (Conekta)</li>}
                    {!estadoConfig.tieneCSD && <li>Certificado de Sello Digital (CSD)</li>}
                  </ul>
                </div>
                <div className="mt-3">
                  <Link href="/dashboard/configuracion" className="text-sm font-medium text-yellow-950 underline dark:text-amber-50">
                    Ir a configuración →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon
            const colorClasses = {
              green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
              yellow: 'border-yellow-200 bg-yellow-50 text-yellow-800',
              red: 'border-rose-200 bg-rose-50 text-rose-700',
              blue: 'border-sky-200 bg-sky-50 text-sky-700',
            }

            return (
              <Link
                key={card.href}
                href={card.href}
                className="app-card group p-6 hover:-translate-y-1 hover:border-amber-300 hover:shadow-warm"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="app-icon-shell h-14 w-14 transition group-hover:bg-amber-100 group-hover:text-amber-800">
                    <Icon className="h-7 w-7" />
                  </div>
                  {card.estadistica && (
                    <span className={`app-badge ${colorClasses[card.color as keyof typeof colorClasses]}`}>
                      {card.estadistica}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-semibold text-stone-900">{card.title}</h3>
                <p className="mt-1 text-sm text-stone-600">{card.descripcion}</p>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
