'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MesaCard from '@/components/MesaCard'
import BackButton from '@/components/BackButton'
import toast from 'react-hot-toast'
import { formatWaitTime, minutosDesde, colorProgresivoPorMinutos } from '@/lib/mesa-utils'
import { authFetch, apiFetch } from '@/lib/auth-fetch'
import { tieneAlgunPermiso, tienePermiso } from '@/lib/permisos'
import { readMesaPublicUrl, writeMesaPublicUrl } from '@/lib/mesa-public-url-storage'

interface Mesa {
  id: string
  numero: number
  estado: string
  capacidad: number
  ubicacion?: string | null
  piso?: string | null
  hasPublicLink?: boolean
  comandaActual?: {
    numeroComanda: string
    total: number
    fechaCreacion?: string
    totalItems?: number
    itemsEntregados?: number
    allItemsEntregados?: boolean
    waitStartFrom?: string | null
  } | null
}

function readSessionUserSync() {
  try {
    const s = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    return s ? (JSON.parse(s) as { rol?: { permisos?: unknown } }) : null
  } catch {
    return null
  }
}

export default function MesasStatusPage() {
  const router = useRouter()
  const [sessionUser, setSessionUser] = useState<{ rol?: { permisos?: unknown } } | null>(() =>
    typeof window !== 'undefined' ? readSessionUserSync() : null
  )
  const [restauranteId, setRestauranteId] = useState<string | null>(null)
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [formData, setFormData] = useState({
    numero: '',
    capacidad: '',
    ubicacion: '',
    piso: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [tiempoAmarilloMinutos, setTiempoAmarilloMinutos] = useState(30)
  const [tiempoRojoMinutos, setTiempoRojoMinutos] = useState(60)
  const [mostrarConfigTiempos, setMostrarConfigTiempos] = useState(false)
  const [editTiempoAmarillo, setEditTiempoAmarillo] = useState('30')
  const [editTiempoRojo, setEditTiempoRojo] = useState('60')
  const [guardandoTiempos, setGuardandoTiempos] = useState(false)
  const [tick, setTick] = useState(0)
  const [pedidosClienteHabilitado, setPedidosClienteHabilitado] = useState(false)
  const [guardandoPedidosCliente, setGuardandoPedidosCliente] = useState(false)
  const [mostrarPedidosCliente, setMostrarPedidosCliente] = useState(false)
  const [restauranteSlug, setRestauranteSlug] = useState<string | null>(null)
  const [publicOrigin, setPublicOrigin] = useState('')
  const [mesaLinkGenerado, setMesaLinkGenerado] = useState<Record<string, string>>({})
  const [generandoMesaLinkId, setGenerandoMesaLinkId] = useState<string | null>(null)
  const [mesaQrVisible, setMesaQrVisible] = useState<Record<string, boolean>>({})
  const [mesaQrSizePx, setMesaQrSizePx] = useState<Record<string, number>>({})

  const QR_SIZE_STEPS = [120, 160, 200, 240, 280, 320, 360] as const

  const clampQrSize = (size: number) => {
    const min = QR_SIZE_STEPS[0]
    const max = QR_SIZE_STEPS[QR_SIZE_STEPS.length - 1]
    return Math.min(max, Math.max(min, size))
  }

  const nearestQrStep = (size: number) => {
    const clamped = clampQrSize(size)
    return QR_SIZE_STEPS.reduce((best, cur) => {
      return Math.abs(cur - clamped) < Math.abs(best - clamped) ? cur : best
    }, QR_SIZE_STEPS[0])
  }

  const bumpQrSize = (mesaId: string, delta: number) => {
    setMesaQrSizePx((prev) => {
      const current = prev[mesaId] ?? 160
      const currentStep = nearestQrStep(current)
      const idx = QR_SIZE_STEPS.findIndex((s) => s === currentStep)
      const baseIdx = idx === -1 ? 1 : idx
      const clampedIdx = Math.min(QR_SIZE_STEPS.length - 1, Math.max(0, baseIdx + delta))
      return { ...prev, [mesaId]: QR_SIZE_STEPS[clampedIdx] }
    })
  }

  const fetchMesas = async () => {
    try {
      const response = await authFetch('/api/mesas')
      if (response.status === 401) return

      const data = await response.json()

      if (data.success) {
        setMesas(data.data)
      } else {
        toast.error(data.debug ? `Error: ${data.debug}` : 'Error al cargar mesas')
      }
    } catch (error) {
      toast.error('Error al cargar mesas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPublicOrigin(window.location.origin)
    void (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' })
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data) setSessionUser(data.data)
        }
      } catch {
        // noop
      }
    })()
    fetchMesas()
    fetchTenantInfo()
    const interval = setInterval(() => {
      fetchMesas()
      setTick((t) => t + 1)
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const u = readSessionUserSync()
    if (u) setSessionUser(u)
  }, [])

  useEffect(() => {
    if (!sessionUser) return
    if (tieneAlgunPermiso(sessionUser, ['tables.wait_times', 'mesas', 'configuracion', 'settings.manage'])) {
      void fetchConfiguracionTiempos()
    }
  }, [sessionUser])

  useEffect(() => {
    if (!sessionUser) return
    if (tieneAlgunPermiso(sessionUser, ['tables.client_channel', 'mesas'])) {
      void fetchPedidosClienteConfig()
    }
  }, [sessionUser])

  useEffect(() => {
    if (!restauranteId || mesas.length === 0) return
    setMesaLinkGenerado((prev) => {
      const next = { ...prev }
      for (const m of mesas) {
        if (m.hasPublicLink && !next[m.id]) {
          const stored = readMesaPublicUrl(restauranteId, m.id)
          if (stored) next[m.id] = stored
        }
      }
      return next
    })
  }, [restauranteId, mesas])

  const fetchConfiguracionTiempos = async () => {
    try {
      const response = await authFetch('/api/configuracion/tiempos')
      if (response.status === 401) return

      const data = await response.json()
      if (data.success && data.data) {
        const amarillo = data.data.tiempoAmarilloMinutos ?? 30
        const rojo = data.data.tiempoRojoMinutos ?? 60
        setTiempoAmarilloMinutos(amarillo)
        setTiempoRojoMinutos(rojo)
        setEditTiempoAmarillo(String(amarillo))
        setEditTiempoRojo(String(rojo))
      }
    } catch (error) {
      console.error('Error al cargar configuración de tiempos:', error)
    }
  }

  const fetchTenantInfo = async () => {
    try {
      const response = await authFetch('/api/auth/tenancy')
      if (response.status === 401) return
      const data = await response.json()
      if (data.success && data.data?.current) {
        if (data.data.current.restauranteSlug) {
          setRestauranteSlug(data.data.current.restauranteSlug)
        }
        if (data.data.current.restauranteId) {
          setRestauranteId(data.data.current.restauranteId)
        }
      }
    } catch {
      // noop
    }
  }

  const fetchPedidosClienteConfig = async () => {
    try {
      const response = await authFetch('/api/configuracion/pedidos-cliente')
      if (response.status === 401) return
      const data = await response.json()
      if (data.success && data.data) {
        setPedidosClienteHabilitado(Boolean(data.data.habilitado))
      }
    } catch {
      // noop
    }
  }

  const togglePedidosCliente = async () => {
    setGuardandoPedidosCliente(true)
    try {
      const next = !pedidosClienteHabilitado
      const response = await apiFetch('/api/configuracion/pedidos-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habilitado: next }),
      })
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'No se pudo actualizar la configuración')
      }
      setPedidosClienteHabilitado(Boolean(data.data?.habilitado))
      toast.success(next ? 'Pedidos cliente habilitados' : 'Pedidos cliente deshabilitados')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la configuración')
    } finally {
      setGuardandoPedidosCliente(false)
    }
  }

  const generarLinkMesa = async (mesaId: string) => {
    setGenerandoMesaLinkId(mesaId)
    try {
      const response = await apiFetch(`/api/mesas/${mesaId}/public-link`, { method: 'POST' })
      const data = await response.json()
      if (!data.success || !data.data) {
        throw new Error(data.error || 'No se pudo generar link de mesa')
      }
      const slug = data.data.restauranteSlug || restauranteSlug
      if (!slug) throw new Error('No se encontró slug de sucursal para generar el link')
      const url = `${window.location.origin}/p/${slug}?mesa=${encodeURIComponent(data.data.mesaCode)}`
      setMesaLinkGenerado((prev) => ({ ...prev, [mesaId]: url }))
      let rid = restauranteId
      if (!rid) {
        try {
          const tr = await authFetch('/api/auth/tenancy')
          const td = await tr.json()
          rid = td.success && td.data?.current?.restauranteId ? td.data.current.restauranteId : null
          if (rid) setRestauranteId(rid)
        } catch {
          // noop
        }
      }
      if (rid) {
        writeMesaPublicUrl(rid, mesaId, url)
      }
      setMesaQrVisible((prev) => ({ ...prev, [mesaId]: true }))
      setMesaQrSizePx((prev) => ({ ...prev, [mesaId]: nearestQrStep(prev[mesaId] ?? 160) }))
      await navigator.clipboard.writeText(url)
      toast.success('Link de mesa generado y copiado')
      await fetchMesas()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo generar el link de mesa')
    } finally {
      setGenerandoMesaLinkId(null)
    }
  }

  const copiarLinkMesa = async (mesaId: string) => {
    const link = mesaLinkGenerado[mesaId]
    if (!link) {
      toast.error('Primero genera el link de la mesa')
      return
    }
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link copiado')
    } catch {
      toast.error('No se pudo copiar el link')
    }
  }

  const guardarTiemposColor = async (e: React.FormEvent) => {
    e.preventDefault()
    const amarillo = parseInt(editTiempoAmarillo, 10)
    const rojo = parseInt(editTiempoRojo, 10)
    if (Number.isNaN(amarillo) || Number.isNaN(rojo) || amarillo < 1 || rojo < 1) {
      toast.error('Introduce minutos válidos (números positivos)')
      return
    }
    if (rojo <= amarillo) {
      toast.error('El tiempo para rojo debe ser mayor que el tiempo para amarillo')
      return
    }
    setGuardandoTiempos(true)
    try {
      const response = await apiFetch('/api/configuracion/tiempos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tiempoAmarilloMinutos: amarillo,
          tiempoRojoMinutos: rojo,
        }),
      })
      const data = await response.json()
      if (data.success && data.data) {
        setTiempoAmarilloMinutos(data.data.tiempoAmarilloMinutos)
        setTiempoRojoMinutos(data.data.tiempoRojoMinutos)
        setEditTiempoAmarillo(String(data.data.tiempoAmarilloMinutos))
        setEditTiempoRojo(String(data.data.tiempoRojoMinutos))
        toast.success('Tiempos de color guardados')
      } else {
        toast.error(data.error || 'Error al guardar tiempos')
      }
    } catch {
      toast.error('Error al guardar tiempos')
    } finally {
      setGuardandoTiempos(false)
    }
  }

  const handleMesaClick = (mesa: Mesa) => {
    if (mesa.comandaActual) {
      router.push(`/dashboard/comandas/${mesa.comandaActual.numeroComanda}`)
    } else {
      router.push(`/dashboard/comandas/nueva?mesaId=${mesa.id}`)
    }
  }

  const handleAgregarMesa = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.numero || !formData.capacidad) {
      toast.error('Completa todos los campos requeridos')
      return
    }

    setGuardando(true)

    try {
      const response = await apiFetch('/api/mesas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          numero: parseInt(formData.numero),
          capacidad: parseInt(formData.capacidad),
          ubicacion: formData.ubicacion || undefined,
          piso: formData.piso || undefined,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Mesa agregada exitosamente')
        setFormData({ numero: '', capacidad: '', ubicacion: '', piso: '' })
        setMostrarFormulario(false)
        fetchMesas()
      } else {
        toast.error(data.error || 'Error al agregar mesa')
      }
    } catch (error) {
      toast.error('Error al agregar mesa')
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return (
      <div className="app-page">
        <div className="app-card text-center text-stone-600">Cargando mesas...</div>
      </div>
    )
  }

  const u = sessionUser
  const canReservaciones =
    !u ||
    tieneAlgunPermiso(u, ['tables.reservations', 'reservations.view', 'reservations.manage', 'mesas'])
  const canTiempos =
    !u || tieneAlgunPermiso(u, ['tables.wait_times', 'mesas', 'configuracion', 'settings.manage'])
  const canPedidosCliente = !u || tieneAlgunPermiso(u, ['tables.client_channel', 'mesas'])
  const canAgregarMesa = !u || tieneAlgunPermiso(u, ['tables.manage', 'mesas'])
  const canVerConfigHub =
    !u || tienePermiso(u, 'tables.view') || tienePermiso(u, 'mesas')

  return (
    <div className="app-page">
      <div className="mx-auto max-w-7xl space-y-6">
      <div className="app-card">
        <BackButton className="mb-4" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="app-kicker">Mesas</p>
            <h1 className="mt-2 text-3xl font-semibold text-stone-900">Estado de Mesas</h1>
            <p className="mt-2 text-stone-600">Tiempo de espera desde que se generó la comanda.</p>
          </div>
          <div className="flex flex-wrap gap-2">
          {canVerConfigHub && (
            <button
              type="button"
              onClick={() => router.push('/dashboard/mesas/configuracion')}
              className="app-btn-secondary"
            >
              Configuración de mesas
            </button>
          )}
          {canReservaciones && (
            <button
              type="button"
              onClick={() => router.push('/dashboard/mesas/reservaciones')}
              className="app-btn-secondary"
            >
              Reservaciones
            </button>
          )}
          {canTiempos && (
            <button
              type="button"
              onClick={() => setMostrarConfigTiempos(!mostrarConfigTiempos)}
              className="app-btn-secondary"
            >
              {mostrarConfigTiempos ? 'Ocultar tiempos' : '⏱️ Tiempos de color'}
            </button>
          )}
          {canPedidosCliente && (
            <button
              type="button"
              onClick={() => setMostrarPedidosCliente((v) => !v)}
              className="app-btn-secondary"
            >
              {mostrarPedidosCliente ? 'Ocultar pedidos cliente' : '📱 Pedidos cliente / QR'}
            </button>
          )}
          {canAgregarMesa && (
            <button
              type="button"
              onClick={() => setMostrarFormulario(!mostrarFormulario)}
              className="app-btn-primary"
            >
              {mostrarFormulario ? 'Cancelar' : '+ Agregar Mesa'}
            </button>
          )}
          </div>
        </div>
      </div>

      {canTiempos && mostrarConfigTiempos && (
        <div className="app-card border-amber-100">
          <h2 className="text-xl font-semibold text-stone-900 mb-2">Tiempos de color de las mesas</h2>
          <p className="text-sm text-stone-600 mb-4">
            Los colores verde → amarillo → rojo cambian de forma progresiva según el tiempo desde que se creó la comanda.
            Para el primer uso puedes configurarlo en <strong>Configuración</strong>; aquí puedes cambiarlo cuando quieras.
          </p>
          <form onSubmit={guardarTiemposColor} className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Tiempo para amarillo (min)</label>
              <input
                type="number"
                min={1}
                value={editTiempoAmarillo}
                onChange={(e) => setEditTiempoAmarillo(e.target.value)}
                className="app-input w-24"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Tiempo para rojo (min)</label>
              <input
                type="number"
                min={1}
                value={editTiempoRojo}
                onChange={(e) => setEditTiempoRojo(e.target.value)}
                className="app-input w-24"
              />
            </div>
            <button
              type="submit"
              disabled={guardandoTiempos}
              className="app-btn-primary"
            >
              {guardandoTiempos ? 'Guardando...' : 'Guardar tiempos'}
            </button>
          </form>
          <p className="text-xs text-stone-500 mt-2">
            Verde: 0–{tiempoAmarilloMinutos} min · Amarillo→Rojo: {tiempoAmarilloMinutos}–{tiempoRojoMinutos} min · Rojo: +{tiempoRojoMinutos} min · Azul: todos los pedidos entregados
          </p>
        </div>
      )}

      {mesas.length > 0 ? (
        <div className="space-y-8">
          {(() => {
            const porPiso = mesas.reduce<Record<string, Mesa[]>>((acc, m) => {
              const key = m.piso?.trim() || '__sin_piso__'
              if (!acc[key]) acc[key] = []
              acc[key].push(m)
              return acc
            }, {})
            const ordenPisos = Object.keys(porPiso).sort((a, b) => {
              if (a === '__sin_piso__') return 1
              if (b === '__sin_piso__') return -1
              return a.localeCompare(b, undefined, { numeric: true })
            })
            return ordenPisos.map((pisoKey) => {
              const lista = porPiso[pisoKey]
              const tituloPiso = pisoKey === '__sin_piso__' ? 'Sin piso' : `Piso ${pisoKey}`
              return (
                <div key={pisoKey}>
                  <h2 className="mb-3 border-b border-stone-200 pb-2 text-lg font-semibold text-stone-800">
                    {tituloPiso}
                  </h2>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                    {lista.map((mesa) => {
                      const comanda = mesa.comandaActual
                      const allEntregados = comanda?.allItemsEntregados
                      const fechaBase = comanda?.waitStartFrom ?? comanda?.fechaCreacion
                      const waitTime = fechaBase ? formatWaitTime(fechaBase) : undefined
                      const colorProgresivo = allEntregados
                        ? undefined
                        : fechaBase
                          ? colorProgresivoPorMinutos(
                              minutosDesde(fechaBase),
                              tiempoAmarilloMinutos,
                              tiempoRojoMinutos
                            )
                          : undefined
                      return (
                        <MesaCard
                          key={mesa.id}
                          numero={mesa.numero}
                          estado={mesa.estado as any}
                          capacidad={mesa.capacidad}
                          comandaActual={mesa.comandaActual}
                          onClick={() => handleMesaClick(mesa)}
                          tiempoAmarilloMinutos={tiempoAmarilloMinutos}
                          tiempoRojoMinutos={tiempoRojoMinutos}
                          variant="status"
                          waitTime={waitTime}
                          colorProgresivo={colorProgresivo}
                          allItemsEntregados={allEntregados}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })
          })()}
        </div>
      ) : (
        <div className="app-card text-center">
          <p className="mb-2 text-lg text-stone-500">No hay mesas configuradas</p>
          <p className="text-sm text-stone-400">
            Haz clic en &quot;Agregar Mesa&quot; para comenzar
          </p>
        </div>
      )}

      {canAgregarMesa && mostrarFormulario && (
        <div className="app-card">
          <h2 className="text-xl font-semibold text-stone-900 mb-4">Nueva Mesa</h2>
          <form onSubmit={handleAgregarMesa} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Número de Mesa *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  className="app-input"
                  placeholder="Ej: 1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Capacidad *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.capacidad}
                  onChange={(e) => setFormData({ ...formData, capacidad: e.target.value })}
                  className="app-input"
                  placeholder="Ej: 4"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Piso (opcional)
                </label>
                <input
                  type="text"
                  value={formData.piso}
                  onChange={(e) => setFormData({ ...formData, piso: e.target.value })}
                  className="app-input"
                  placeholder="Ej: 1, 2, Terraza"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Ubicación (opcional)
                </label>
                <input
                  type="text"
                  value={formData.ubicacion}
                  onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                  className="app-input"
                  placeholder="Ej: Interior, Barra"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={guardando}
                className="app-btn-primary"
              >
                {guardando ? 'Guardando...' : 'Agregar Mesa'}
              </button>
            </div>
          </form>
        </div>
      )}

      {canPedidosCliente && mostrarPedidosCliente && (
        <div className="app-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-stone-900">Pedidos cliente por link/QR</h2>
              <p className="text-sm text-stone-600">
                Habilita solicitudes de cliente y genera links por mesa. Esto vive aparte del mapa para que el mesero
                entre directo a mesas.
              </p>
            </div>
            <button
              type="button"
              onClick={togglePedidosCliente}
              disabled={guardandoPedidosCliente}
              className={pedidosClienteHabilitado ? 'app-btn-secondary' : 'app-btn-primary'}
            >
              {guardandoPedidosCliente
                ? 'Guardando...'
                : pedidosClienteHabilitado
                  ? 'Deshabilitar pedidos cliente'
                  : 'Habilitar pedidos cliente'}
            </button>
          </div>
          {restauranteSlug && publicOrigin && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
              <p className="text-sm text-stone-700">
                Link general:{' '}
                <span className="font-mono text-xs font-semibold text-stone-900">
                  {`${publicOrigin}/p/${restauranteSlug}`}
                </span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="app-btn-secondary"
                  onClick={async () => {
                    const url = `${publicOrigin}/p/${restauranteSlug}`
                    try {
                      await navigator.clipboard.writeText(url)
                      toast.success('Link general copiado')
                    } catch {
                      toast.error('No se pudo copiar el link general')
                    }
                  }}
                >
                  Copiar link general
                </button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <p className="text-sm font-medium text-stone-700">Links por mesa</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {mesas.map((mesa) => {
                const link = mesaLinkGenerado[mesa.id]
                const qrVisible = Boolean(mesaQrVisible[mesa.id])
                const qrSize = nearestQrStep(mesaQrSizePx[mesa.id] ?? 160)
                const qrSizeIdx = QR_SIZE_STEPS.indexOf(qrSize as (typeof QR_SIZE_STEPS)[number])
                const qrSizeIdxSafe = qrSizeIdx === -1 ? 1 : qrSizeIdx
                return (
                  <div key={`qr-${mesa.id}`} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-stone-900">Mesa {mesa.numero}</p>
                        <p className="text-xs text-stone-500">
                          {mesa.hasPublicLink
                            ? link
                              ? 'Link activo · también guardado en este navegador para volver a verlo.'
                              : 'Hay un link activo, pero este navegador no tiene la URL guardada. Regenera para verla (el código anterior dejará de funcionar).'
                            : 'Sin link generado aún'}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className="app-btn-secondary"
                          disabled={generandoMesaLinkId === mesa.id}
                          onClick={() => generarLinkMesa(mesa.id)}
                        >
                          {generandoMesaLinkId === mesa.id
                            ? 'Generando...'
                            : mesa.hasPublicLink
                              ? 'Regenerar link'
                              : 'Generar link'}
                        </button>
                        <button
                          type="button"
                          className="app-btn-secondary"
                          disabled={!link}
                          onClick={() => copiarLinkMesa(mesa.id)}
                        >
                          Copiar link
                        </button>
                        <button
                          type="button"
                          className="app-btn-secondary"
                          disabled={!link}
                          onClick={() => {
                            if (link) window.open(link, '_blank', 'noopener,noreferrer')
                          }}
                        >
                          Abrir vista cliente
                        </button>
                      </div>
                    </div>

                    {link ? (
                      <div className="mt-3 space-y-3">
                        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                          <p className="text-xs font-medium text-stone-600">URL</p>
                          <p className="mt-1 break-all font-mono text-[11px] leading-snug text-stone-900">{link}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="app-btn-secondary"
                            onClick={() => setMesaQrVisible((prev) => ({ ...prev, [mesa.id]: !qrVisible }))}
                          >
                            {qrVisible ? 'Ocultar QR' : 'Ver QR'}
                          </button>
                          <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-2 py-1">
                            <button
                              type="button"
                              className="app-btn-secondary px-3"
                              disabled={!qrVisible || qrSizeIdxSafe <= 0}
                              aria-label="Reducir tamaño del QR"
                              onClick={() => bumpQrSize(mesa.id, -1)}
                            >
                              −
                            </button>
                            <span className="min-w-[84px] text-center text-xs font-semibold text-stone-700">
                              QR {qrSize}px
                            </span>
                            <button
                              type="button"
                              className="app-btn-secondary px-3"
                              disabled={!qrVisible || qrSizeIdxSafe >= QR_SIZE_STEPS.length - 1}
                              aria-label="Aumentar tamaño del QR"
                              onClick={() => bumpQrSize(mesa.id, 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {qrVisible ? (
                          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                            <div className="rounded-2xl border border-stone-200 bg-white p-3">
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(
                                  link
                                )}`}
                                alt={`QR mesa ${mesa.numero}`}
                                className="rounded-xl"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <p className="max-w-md text-xs text-stone-600">
                              Tip: imprime o pega el QR cerca de la mesa. Si cambias el link, regenera para invalidar el
                              anterior.
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-stone-600">
                        {mesa.hasPublicLink
                          ? 'Pulsa «Regenerar link» para obtener la URL en este equipo, o usa otro navegador donde ya lo hayas generado (queda guardado localmente).'
                          : 'Genera el link para ver el QR y copiarlo rápido.'}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  )
}
