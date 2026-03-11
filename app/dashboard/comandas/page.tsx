'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BackButton from '@/components/BackButton'
import toast from 'react-hot-toast'

interface Comanda {
  id: string
  numeroComanda: string
  estado: string
  total: number
  fechaCreacion: string
  mesa?: {
    numero: number
  } | null
  cliente?: {
    nombre: string
  } | null
}

export default function ComandasPage() {
  const router = useRouter()
  const [comandas, setComandas] = useState<Comanda[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<string>('')

  useEffect(() => {
    fetchComandas()
  }, [filtro])

  const fetchComandas = async () => {
    try {
      const token = localStorage.getItem('token')
      const url = filtro
        ? `/api/comandas?estado=${filtro}`
        : '/api/comandas'

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (data.success) {
        setComandas(data.data)
      } else {
        toast.error('Error al cargar comandas')
      }
    } catch (error) {
      toast.error('Error al cargar comandas')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="app-page">
        <div className="app-card text-center text-stone-600">Cargando...</div>
      </div>
    )
  }

  const estados = [
    { value: '', label: 'Todas' },
    { value: 'PENDIENTE', label: 'Pendientes' },
    { value: 'EN_PREPARACION', label: 'En Preparación' },
    { value: 'LISTO', label: 'Listas' },
    { value: 'SERVIDO', label: 'Servidas' },
    { value: 'PAGADO', label: 'Pagadas' },
  ]

  return (
    <div className="app-page">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="app-card">
          <BackButton className="mb-4" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="app-kicker">Operación</p>
              <h1 className="mt-2 text-3xl font-semibold text-stone-900">Comandas</h1>
              <p className="mt-1 text-sm text-stone-600">
                Controla el ciclo completo de atención y cobro.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="app-input min-w-[180px]"
              >
                {estados.map((estado) => (
                  <option key={estado.value} value={estado.value}>
                    {estado.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => router.push('/dashboard/comandas/nueva')}
                className="app-btn-primary"
              >
                Nueva Comanda
              </button>
            </div>
          </div>
        </div>

        <div className="app-table-shell">
          <table className="min-w-full divide-y divide-stone-200">
            <thead className="bg-stone-50/90">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                  Comanda
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                  Mesa/Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white/95">
              {comandas.map((comanda) => (
                <tr key={comanda.id} className="hover:bg-amber-50/60">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-stone-900">
                    {comanda.numeroComanda}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-stone-600">
                    {comanda.mesa
                      ? `Mesa ${comanda.mesa.numero}`
                      : comanda.cliente?.nombre || 'Para llevar'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`app-badge ${
                        comanda.estado === 'PENDIENTE'
                          ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
                          : comanda.estado === 'LISTO'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : comanda.estado === 'PAGADO'
                              ? 'border-stone-200 bg-stone-100 text-stone-700'
                              : 'border-sky-200 bg-sky-50 text-sky-700'
                      }`}
                    >
                      {comanda.estado}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-stone-900">
                    ${comanda.total.toFixed(2)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-stone-600">
                    {new Date(comanda.fechaCreacion).toLocaleString('es-MX')}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                    <button
                      onClick={() => router.push(`/dashboard/comandas/${comanda.numeroComanda}`)}
                      className="text-amber-700 hover:text-amber-900"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {comandas.length === 0 && (
            <div className="py-12 text-center text-stone-500">
              No hay comandas {filtro ? 'con este estado' : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}








