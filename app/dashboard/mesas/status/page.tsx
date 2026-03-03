'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MesaCard from '@/components/MesaCard'
import BackButton from '@/components/BackButton'
import toast from 'react-hot-toast'
import { formatWaitTime, minutosDesde, colorProgresivoPorMinutos } from '@/lib/mesa-utils'

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
  const [mesaAConfirmarBorrado, setMesaAConfirmarBorrado] = useState<Mesa | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [tick, setTick] = useState(0)

  const fetchMesas = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/mesas', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (data.success) {
        setMesas(data.data)
      } else {
        toast.error('Error al cargar mesas')
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
      const token = localStorage.getItem('token')
      const response = await fetch('/api/configuracion/tiempos', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

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
      const token = localStorage.getItem('token')
      const response = await fetch('/api/configuracion/tiempos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
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
      const token = localStorage.getItem('token')
      const response = await fetch('/api/mesas', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          numero: parseInt(formData.numero),
          capacidad: parseInt(formData.capacidad),
          ubicacion: formData.ubicacion || undefined,
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

  const abrirConfirmarBorrado = (mesa: Mesa) => {
    if (mesa.comandaActual) {
      toast.error('No se puede borrar: la mesa tiene una comanda activa. Cierra o cancela la comanda primero.')
      return
    }
    setMesaAConfirmarBorrado(mesa)
  }

  const cancelarBorrado = () => {
    setMesaAConfirmarBorrado(null)
  }

  const confirmarBorrado = async () => {
    if (!mesaAConfirmarBorrado) return
    setBorrando(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/mesas/${mesaAConfirmarBorrado.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()

      if (data.success) {
        toast.success('Mesa borrada')
        setMesaAConfirmarBorrado(null)
        fetchMesas()
      } else {
        toast.error(data.error || 'Error al borrar mesa')
      }
    } catch {
      toast.error('Error al borrar mesa')
    } finally {
      setBorrando(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Cargando mesas...</div>
      </div>
    )
  }

  return (
    <div className="p-8 text-black">
      <BackButton className="mb-4" />
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Estado de Mesas</h1>
          <p className="text-gray-600 mt-2">Tiempo de espera desde que se generó la comanda</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMostrarConfigTiempos(!mostrarConfigTiempos)}
            className="bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700"
          >
            {mostrarConfigTiempos ? 'Ocultar tiempos' : '⏱️ Tiempos de color'}
          </button>
          <button
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
          >
            {mostrarFormulario ? 'Cancelar' : '+ Agregar Mesa'}
          </button>
        </div>
      </div>

      {mostrarConfigTiempos && (
        <div className="mb-6 bg-white rounded-lg shadow-md p-6 border border-amber-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Tiempos de color de las mesas</h2>
          <p className="text-sm text-gray-600 mb-4">
            Los colores verde → amarillo → rojo cambian de forma progresiva según el tiempo desde que se creó la comanda.
            Para el primer uso puedes configurarlo en <strong>Configuración</strong>; aquí puedes cambiarlo cuando quieras.
          </p>
          <form onSubmit={guardarTiemposColor} className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tiempo para amarillo (min)</label>
              <input
                type="number"
                min={1}
                value={editTiempoAmarillo}
                onChange={(e) => setEditTiempoAmarillo(e.target.value)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 text-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tiempo para rojo (min)</label>
              <input
                type="number"
                min={1}
                value={editTiempoRojo}
                onChange={(e) => setEditTiempoRojo(e.target.value)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 text-black"
              />
            </div>
            <button
              type="submit"
              disabled={guardandoTiempos}
              className="bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700 disabled:opacity-50"
            >
              {guardandoTiempos ? 'Guardando...' : 'Guardar tiempos'}
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-2">
            Verde: 0–{tiempoAmarilloMinutos} min · Amarillo→Rojo: {tiempoAmarilloMinutos}–{tiempoRojoMinutos} min · Rojo: +{tiempoRojoMinutos} min
          </p>
        </div>
      )}

      {mostrarFormulario && (
        <div className="mb-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Nueva Mesa</h2>
          <form onSubmit={handleAgregarMesa} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Mesa *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-black"
                  placeholder="Ej: 1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capacidad *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.capacidad}
                  onChange={(e) => setFormData({ ...formData, capacidad: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-black"
                  placeholder="Ej: 4"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Piso (opcional)
                </label>
                <input
                  type="text"
                  value={formData.piso}
                  onChange={(e) => setFormData({ ...formData, piso: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-black"
                  placeholder="Ej: 1, 2, Terraza"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ubicación (opcional)
                </label>
                <input
                  type="text"
                  value={formData.ubicacion}
                  onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-black"
                  placeholder="Ej: Interior, Barra"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={guardando}
                className="bg-primary-600 text-white px-6 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <h2 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">
                    {tituloPiso}
                  </h2>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                    {lista.map((mesa) => {
                      const fechaCreacion = mesa.comandaActual?.fechaCreacion
                      const waitTime = fechaCreacion ? formatWaitTime(fechaCreacion) : undefined
                      const colorProgresivo = fechaCreacion
                        ? colorProgresivoPorMinutos(
                            minutosDesde(fechaCreacion),
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
                          onDelete={() => abrirConfirmarBorrado(mesa)}
                          waitTime={waitTime}
                          colorProgresivo={colorProgresivo}
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
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-500 text-lg mb-2">No hay mesas configuradas</p>
          <p className="text-gray-400 text-sm">
            Haz clic en &quot;Agregar Mesa&quot; para comenzar
          </p>
        </div>
      )}

      {/* Modal ¿Estás seguro? para borrar mesa */}
      {mesaAConfirmarBorrado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={cancelarBorrado}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmar-borrar-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirmar-borrar-title" className="text-lg font-bold text-gray-900 mb-2">
              ¿Estás seguro?
            </h2>
            <p className="text-gray-600 mb-6">
              Se borrará la <strong>M{mesaAConfirmarBorrado.numero}</strong>. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={cancelarBorrado}
                className="px-4 py-2 rounded-lg font-semibold bg-gray-200 text-gray-800 hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarBorrado}
                disabled={borrando}
                className="px-4 py-2 rounded-lg font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {borrando ? 'Borrando…' : 'Sí, borrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
