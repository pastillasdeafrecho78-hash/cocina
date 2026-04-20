'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BackButton from '@/components/BackButton'
import { tieneAlgunPermiso, tienePermiso } from '@/lib/permisos'

export default function MesasConfiguracionHubPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ rol?: { permisos?: unknown } } | null>(null)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (!userStr) {
      router.replace('/login')
      return
    }
    setUser(JSON.parse(userStr))
  }, [router])

  if (!user) {
    return (
      <div className="app-loading-shell">
        <div className="app-card text-center">Cargando...</div>
      </div>
    )
  }

  const canReservas = tieneAlgunPermiso(user, [
    'tables.reservations',
    'reservations.view',
    'reservations.manage',
    'mesas',
  ])
  const canTiempos = tieneAlgunPermiso(user, [
    'tables.wait_times',
    'mesas',
    'configuracion',
    'settings.manage',
  ])
  const canPedidosCliente = tieneAlgunPermiso(user, ['tables.client_channel', 'mesas'])
  const canAgregarMesas = tieneAlgunPermiso(user, ['tables.manage', 'mesas'])
  const canVerMapa = tienePermiso(user, 'tables.view') || tienePermiso(user, 'mesas')

  if (!canVerMapa) {
    return (
      <div className="app-page">
        <div className="app-card text-center text-stone-600">No tienes permiso para ver la configuración de mesas.</div>
      </div>
    )
  }

  const cards: Array<{
    title: string
    desc: string
    href: string
    action: string
    ok: boolean
  }> = [
    {
      title: 'Reservaciones',
      desc: 'Calendario y reservas por horario.',
      href: '/dashboard/mesas/reservaciones',
      action: 'Abrir reservaciones',
      ok: canReservas,
    },
    {
      title: 'Tiempos de color',
      desc: 'Umbrales verde / amarillo / rojo del tablero de mesas.',
      href: '/dashboard/mesas/status',
      action: 'Ir a estado de mesas',
      ok: canTiempos,
    },
    {
      title: 'Pedido cliente y QR',
      desc: 'Habilitar solicitudes por link y generar QR por mesa.',
      href: '/dashboard/mesas/status',
      action: 'Ir a estado de mesas (QR)',
      ok: canPedidosCliente,
    },
    {
      title: 'Alta de mesas',
      desc: 'Agregar mesas y capacidad desde el tablero.',
      href: '/dashboard/mesas/status',
      action: 'Ir a estado de mesas',
      ok: canAgregarMesas,
    },
  ]

  return (
    <div className="app-page">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="app-card">
          <BackButton className="mb-4" fallbackHref="/dashboard/mesas/status" />
          <p className="app-kicker">Mesas</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-900 dark:text-stone-100">
            Configuración de mesas
          </h1>
          <p className="mt-2 text-stone-600 dark:text-stone-400">
            Accesos rápidos según tu rol. Si falta una tarjeta, pide al administrador el permiso correspondiente.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {cards.map((c) => (
            <div
              key={c.title}
              className={`app-card flex flex-col justify-between ${c.ok ? '' : 'opacity-60'}`}
            >
              <div>
                <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">{c.title}</h2>
                <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{c.desc}</p>
                {!c.ok && (
                  <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-200">
                    Tu rol no incluye este permiso.
                  </p>
                )}
              </div>
              <div className="mt-4">
                {c.ok ? (
                  <Link href={c.href} className="app-btn-primary inline-block text-center">
                    {c.action}
                  </Link>
                ) : (
                  <span className="app-btn-secondary inline-block cursor-not-allowed opacity-70">
                    {c.action}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
