'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MesaCard from '@/components/MesaCard'
import BackButton from '@/components/BackButton'
import toast from 'react-hot-toast'
import { formatWaitTime, minutosDesde, colorProgresivoPorMinutos } from '@/lib/mesa-utils'
import { authFetch, apiFetch } from '@/lib/auth-fetch'

interface Mesa {
  id: string
  numero: number
  estado: string
  capacidad: number
  ubicacion?: string | null
  piso?: string | null
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

export default function MesasStatusPage() {
  const router = useRouter()
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
    fetchMesas()
    fetchConfiguracionTiempos()
    const interval = setInterval(() => {
      fetchMesas()
      setTick((t) => t + 1)
    }, 10000)
    return () => clearInterval(interval)
  }, [])

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
          <button
            onClick={() => router.push('/dashboard/mesas/reservaciones')}
            className="app-btn-secondary"
          >
            Reservaciones
          </button>
          <button
            onClick={() => setMostrarConfigTiempos(!mostrarConfigTiempos)}
            className="app-btn-secondary"
          >
            {mostrarConfigTiempos ? 'Ocultar tiempos' : '⏱️ Tiempos de color'}
          </button>
          <button
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
            className="app-btn-primary"
          >
            {mostrarFormulario ? 'Cancelar' : '+ Agregar Mesa'}
          </button>
          </div>
        </div>
      </div>

      {mostrarConfigTiempos && (
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

      {mostrarFormulario && (
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

      </div>
    </div>
  )
}
