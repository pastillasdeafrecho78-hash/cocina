'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import BackButton from '@/components/BackButton'
import { authFetch } from '@/lib/auth-fetch'
import MesasListView from './_components/MesasListView'
import MesasSpatialView from './_components/MesasSpatialView'
import MesasViewToggle from './_components/MesasViewToggle'
import type { MesaDashboard, MesasDashboardView } from './_components/types'

const STORAGE_KEY = 'servimos.mesas.view'

function readInitialView(): MesasDashboardView {
  if (typeof window === 'undefined') return 'lista'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'plano' || stored === 'lista' ? stored : 'lista'
}

export default function MesasPage() {
  const router = useRouter()
  const [view, setView] = useState<MesasDashboardView>('lista')
  const [mesas, setMesas] = useState<MesaDashboard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    setView(readInitialView())
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, view)
  }, [view])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const [mesasRes, meRes] = await Promise.all([
          authFetch('/api/mesas'),
          authFetch('/api/auth/me'),
        ])
        const mesasData = await mesasRes.json()
        const meData = await meRes.json()

        if (!mesasRes.ok || !mesasData.success) {
          throw new Error(mesasData.error || 'No se pudieron cargar las mesas')
        }
        if (!cancelled) {
          setMesas(mesasData.data || [])
          setCurrentUserId(meData?.data?.id || null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar las mesas')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    return {
      total: mesas.length,
      libres: mesas.filter((mesa) => mesa.estado === 'LIBRE').length,
      ocupadas: mesas.filter((mesa) => Boolean(mesa.comandaActual)).length,
    }
  }, [mesas])

  const handleMesaClick = (mesa: MesaDashboard) => {
    if (mesa.comandaActual) {
      router.push(`/dashboard/comandas/${mesa.comandaActual.numeroComanda}`)
      return
    }
    router.push(`/dashboard/comandas/nueva?mesaId=${mesa.id}`)
  }

  return (
    <div className="app-page">
      <div className="mx-auto max-w-7xl space-y-6">
        <BackButton />

        <section className="overflow-hidden rounded-[36px] border border-stone-200 bg-white shadow-sm">
          <div className="bg-[radial-gradient(circle_at_top_left,#fed7aa,transparent_35%),linear-gradient(135deg,#fffaf0,#f5f5f4)] p-6 sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="app-kicker">Mesas</p>
                <h1 className="mt-2 text-3xl font-semibold text-stone-950 sm:text-4xl">
                  Operación por lista o por plano
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-stone-600">
                  La lista mantiene el flujo rápido actual. El plano muestra forma, tamaño y
                  posición por sucursal para preparar el producto móvil sin romper operación.
                </p>
              </div>
              <MesasViewToggle view={view} onChange={setView} />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Total</p>
                <p className="mt-1 text-2xl font-semibold text-stone-950">{stats.total}</p>
              </div>
              <div className="rounded-2xl bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Libres</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-700">{stats.libres}</p>
              </div>
              <div className="rounded-2xl bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Con comanda</p>
                <p className="mt-1 text-2xl font-semibold text-orange-700">{stats.ocupadas}</p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/mesas/status" className="app-btn-secondary">
                Estado avanzado
              </Link>
              <Link href="/dashboard/mesas/planta" className="app-btn-secondary">
                Editar plano
              </Link>
              <Link href="/dashboard/mesas/reservaciones" className="app-btn-secondary">
                Reservaciones
              </Link>
            </div>

            {loading ? (
              <div className="rounded-[28px] bg-stone-100 p-10 text-center text-stone-500">
                Cargando mesas...
              </div>
            ) : error ? (
              <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-700">
                {error}
              </div>
            ) : view === 'lista' ? (
              <MesasListView
                currentUserId={currentUserId}
                mesas={mesas}
                onMesaClick={handleMesaClick}
              />
            ) : (
              <MesasSpatialView mesas={mesas} onMesaClick={handleMesaClick} />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
