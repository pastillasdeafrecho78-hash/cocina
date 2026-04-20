'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import BackButton from '@/components/BackButton'
import toast from 'react-hot-toast'
import { apiFetch } from '@/lib/auth-fetch'
import {
  ComandaBuilder,
  type Categoria,
  type ComandaCheckoutItem,
  type Mesa,
} from '@/components/ComandaBuilder'

export default function NuevaComandaPage() {
  const searchParams = useSearchParams()
  const mesaIdParam = searchParams.get('mesaId')
  const comandaIdParam = searchParams.get('comandaId')

  const [mesas, setMesas] = useState<Mesa[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [initialMesaId, setInitialMesaId] = useState(mesaIdParam || '')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        let mesaFromComanda = mesaIdParam || ''
        if (comandaIdParam) {
          const comandaRes = await apiFetch(`/api/comandas/${comandaIdParam}`, { headers: {} })
          const comandaData = await comandaRes.json()
          if (comandaData.success && comandaData.data?.mesaId) {
            mesaFromComanda = comandaData.data.mesaId
          }
        }
        if (!cancelled) setInitialMesaId(mesaFromComanda)

        const [mesasRes, categoriasRes] = await Promise.all([
          apiFetch('/api/mesas', { headers: {} }),
          apiFetch('/api/categorias', { headers: {} }),
        ])
        const mesasData = await mesasRes.json()
        const categoriasData = await categoriasRes.json()
        if (!cancelled) {
          if (mesasData.success) setMesas(mesasData.data)
          if (categoriasData.success) setCategorias(categoriasData.data)
        }
      } catch {
        if (!cancelled) toast.error('Error al cargar datos')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [comandaIdParam, mesaIdParam])

  const onCheckout = async (payload: {
    items: ComandaCheckoutItem[]
    observaciones: string
    mesaId?: string
    tipoPedido?: 'EN_MESA' | 'PARA_LLEVAR' | 'A_DOMICILIO' | 'WHATSAPP'
    comandaId?: string | null
  }) => {
    const { items, observaciones, mesaId, tipoPedido, comandaId } = payload
    try {
      if (comandaId) {
        const response = await apiFetch(`/api/comandas/${comandaId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        })
        const data = await response.json()
        if (!data.success) {
          return { ok: false, error: data.error || 'Error al agregar pedidos' }
        }
        return { ok: true, redirectTo: `/dashboard/comandas/${data.data.numeroComanda}` }
      }
      const response = await apiFetch('/api/comandas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesaId,
          tipoPedido,
          items,
          observaciones,
        }),
      })
      const data = await response.json()
      if (!data.success) {
        return { ok: false, error: data.error || 'Error al crear comanda' }
      }
      return { ok: true, redirectTo: `/dashboard/comandas/${data.data.numeroComanda}` }
    } catch {
      return { ok: false, error: comandaId ? 'Error al agregar pedidos' : 'Error al crear comanda' }
    }
  }

  if (loading) {
    return (
      <div className="app-loading-shell">
        <div className="app-card text-center">Cargando...</div>
      </div>
    )
  }

  const esAgregarPedidos = !!comandaIdParam

  return (
    <ComandaBuilder
      categorias={categorias}
      mesas={mesas}
      initialMesaId={initialMesaId}
      comandaIdParam={comandaIdParam}
      showStaffTipoMesaControls
      title={esAgregarPedidos ? 'Agregar más pedidos' : 'Nueva Comanda'}
      subtitle={
        esAgregarPedidos ? 'Se agregarán los productos a la comanda actual' : undefined
      }
      backButton={
        <BackButton
          fallbackHref={esAgregarPedidos ? '/dashboard/mesas' : '/dashboard/comandas'}
        />
      }
      onCheckout={onCheckout}
    />
  )
}
