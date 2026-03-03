'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    const userStr = localStorage.getItem('user')
    if (userStr) {
      const userData = JSON.parse(userStr)
      setUser(userData)

      // ADMIN, CAJERO y GERENTE ven el panel; MESERO, COCINERO, BARTENDER van a mesas
      if (['ADMIN', 'CAJERO', 'GERENTE'].includes(userData.rol)) {
        verificarConfiguracion()
        if (userData.rol === 'ADMIN') cargarEstadisticas()
      } else {
        router.push('/dashboard/mesas')
      }
    }
    setLoading(false)
  }, [router])

  const verificarConfiguracion = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const response = await fetch('/api/configuracion/estado', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
        return
      }
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
      const token = localStorage.getItem('token')
      if (!token) return

      const res = await fetch('/api/dashboard/estadisticas', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
        return
      }

      const data = await res.json()
      if (data.success) {
        setEstadisticas(data.data)
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-black">
        <div className="text-center">
          <div className="text-gray-600">Cargando...</div>
        </div>
      </div>
    )
  }

  const esAdmin = user.rol === 'ADMIN'

  const cards = [
    {
      title: 'Mesas',
      icon: TableCellsIcon,
      href: '/dashboard/mesas',
      estadistica: `${estadisticas.mesasOcupadas}/${estadisticas.mesasTotal}`,
      descripcion: 'Ocupadas',
      color: estadisticas.mesasOcupadas > estadisticas.mesasTotal * 0.8 ? 'red' : 
             estadisticas.mesasOcupadas > estadisticas.mesasTotal * 0.5 ? 'yellow' : 'green',
    },
    {
      title: 'Comandas',
      icon: DocumentTextIcon,
      href: '/dashboard/comandas',
      estadistica: estadisticas.comandasActivas.toString(),
      descripcion: 'Activas',
      color: 'blue',
    },
    {
      title: 'Carta',
      icon: RectangleStackIcon,
      href: '/dashboard/carta',
      estadistica: '',
      descripcion: 'Gestionar productos',
      color: 'blue',
    },
    {
      title: 'Cocina',
      icon: FireIcon,
      href: '/dashboard/cocina',
      estadistica: estadisticas.itemsCocina.toString(),
      descripcion: 'Items pendientes',
      color: estadisticas.itemsCocina > 20 ? 'red' : 
             estadisticas.itemsCocina > 10 ? 'yellow' : 'green',
    },
    {
      title: 'Barra',
      icon: BeakerIcon,
      href: '/dashboard/barra',
      estadistica: estadisticas.itemsBarra.toString(),
      descripcion: 'Items pendientes',
      color: estadisticas.itemsBarra > 20 ? 'red' : 
             estadisticas.itemsBarra > 10 ? 'yellow' : 'green',
    },
    {
      title: 'Reportes',
      icon: ChartBarIcon,
      href: '/dashboard/reportes',
      estadistica: '',
      descripcion: 'Ver reportes',
      color: 'blue',
    },
    {
      title: 'Caja',
      icon: BanknotesIcon,
      href: '/dashboard/caja',
      estadistica: '',
      descripcion: 'Corte X y Corte Z',
      color: 'blue',
    },
    {
      title: 'Configuración',
      icon: Cog6ToothIcon,
      href: '/dashboard/configuracion',
      estadistica: estadoConfig?.configuracionCompleta ? '✓' : '!',
      descripcion: estadoConfig?.configuracionCompleta ? 'Completa' : 'Pendiente',
      color: estadoConfig?.configuracionCompleta ? 'green' : 'yellow',
    },
    ...(esAdmin
      ? [
          {
            title: 'Roles y Permisos',
            icon: ShieldCheckIcon,
            href: '/dashboard/admin/roles',
            estadistica: '',
            descripcion: 'Gestionar roles',
            color: 'blue' as const,
          },
        ]
      : []),
  ]

  return (
    <div className="p-8 text-black">
      {/* Perfil de Usuario en la parte principal */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-xl shadow-md">
              {user.nombre.charAt(0)}{user.apellido.charAt(0)}
            </div>
            {/* Información del usuario */}
            <div className="flex flex-col">
              <span className="text-xl font-semibold text-gray-900">
                {user.nombre} {user.apellido}
              </span>
              <span className="text-sm text-gray-500 capitalize">
                {user.rol.toLowerCase()}
              </span>
            </div>
          </div>
        </div>
        {/* Texto de cerrar sesión */}
        <button
          onClick={handleLogout}
          className="text-red-600 hover:text-red-800 cursor-pointer font-medium"
        >
          Cerrar Sesión
        </button>
      </div>

      {/* Alerta de configuración incompleta */}
      {estadoConfig && !estadoConfig.configuracionCompleta && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-yellow-800">
                Configuración incompleta
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Complete la configuración para habilitar facturación y pagos:</p>
                <ul className="list-disc list-inside mt-1">
                  {!estadoConfig.tieneDatosFiscales && <li>Datos fiscales</li>}
                  {!estadoConfig.tienePAC && <li>Configuración PAC (Facturación)</li>}
                  {!estadoConfig.tieneConekta && <li>Configuración de pagos (Conekta)</li>}
                  {!estadoConfig.tieneCSD && <li>Certificado de Sello Digital (CSD)</li>}
                </ul>
              </div>
              <div className="mt-3">
                <Link
                  href="/dashboard/configuracion"
                  className="text-sm font-medium text-yellow-800 hover:text-yellow-900 underline"
                >
                  Ir a configuración →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {cards.map((card) => {
          const Icon = card.icon
          const colorClasses = {
            green: 'bg-green-100 text-green-800 border-green-300',
            yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
            red: 'bg-red-100 text-red-800 border-red-300',
            blue: 'bg-blue-100 text-blue-800 border-blue-300',
          }

          return (
            <Link
              key={card.href}
              href={card.href}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-2 border-transparent hover:border-blue-300"
            >
              <div className="flex items-center justify-between mb-4">
                <Icon className="w-8 h-8 text-gray-600" />
                {card.estadistica && (
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${colorClasses[card.color as keyof typeof colorClasses]}`}>
                    {card.estadistica}
                  </span>
                )}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-1">
                {card.title}
              </h3>
              <p className="text-sm text-gray-600">{card.descripcion}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
