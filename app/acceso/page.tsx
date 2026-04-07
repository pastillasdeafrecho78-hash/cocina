'use client'

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

type TenantData = {
  active?: { restauranteId?: string | null } | null
  branches?: Array<{ restauranteId: string; nombre: string }>
}

function AccesoOnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState(false)
  const [code, setCode] = useState('')
  const [tenantData, setTenantData] = useState<TenantData | null>(null)

  useEffect(() => {
    const presetCode = searchParams.get('code')
    if (presetCode) setCode(presetCode)
  }, [searchParams])

  useEffect(() => {
    const run = async () => {
      try {
        const sessionRes = await fetch('/api/auth/session', { credentials: 'same-origin' })
        const session = await sessionRes.json()
        if (!session?.user?.id) {
          router.replace('/login')
          return
        }

        const tenancyRes = await fetch('/api/auth/tenancy', { credentials: 'same-origin' })
        const tenancyJson = await tenancyRes.json()
        if (!tenancyRes.ok || !tenancyJson?.success) {
          throw new Error(tenancyJson?.error || 'No se pudo cargar tu contexto')
        }
        setTenantData(tenancyJson.data as TenantData)
        if ((tenancyJson.data?.branches?.length ?? 0) > 0) {
          router.replace('/dashboard')
          return
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error al cargar onboarding')
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [router])

  const normalized = useMemo(() => code.trim().toUpperCase(), [code])

  const redeemCode = async (event: FormEvent) => {
    event.preventDefault()
    if (!normalized) {
      toast.error('Ingresa un código')
      return
    }
    setRedeeming(true)
    try {
      const previewRes = await fetch('/api/auth/access-codes/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code: normalized }),
      })
      const previewJson = await previewRes.json()
      if (!previewRes.ok || !previewJson?.success || !previewJson?.data?.valido) {
        throw new Error(previewJson?.error || 'Código inválido o expirado')
      }

      const res = await fetch('/api/auth/access-codes/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code: normalized }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'No se pudo canjear el código')
      }
      toast.success(`Vinculado a ${json.data.restauranteNombre}`)
      router.replace('/dashboard')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al canjear')
    } finally {
      setRedeeming(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-stone-600">Cargando onboarding de acceso...</div>
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-stone-900">Vincula tu acceso</h1>
        <p className="mt-2 text-sm text-stone-600">
          Tu cuenta existe, pero todavía no pertenece a ninguna sucursal. Elige cómo continuar.
        </p>

        <form className="mt-6 space-y-3" onSubmit={redeemCode}>
          <label className="block text-sm font-medium text-stone-700">Código de sucursal</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ej: A7K9P2QX"
            className="app-input w-full"
          />
          <button type="submit" disabled={redeeming} className="app-btn-primary w-full">
            {redeeming ? 'Vinculando...' : 'Unirme con código / QR'}
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-medium text-stone-800">¿Vas a crear un negocio nuevo?</p>
          <p className="mt-1 text-xs text-stone-600">
            Usa este camino si eres dueño y quieres crear tu sucursal inicial.
          </p>
          <Link href="/register?mode=owner" className="app-btn-secondary mt-3 inline-flex">
            Registrar mi negocio
          </Link>
        </div>

        <div className="mt-4 text-xs text-stone-500">
          También puedes abrir un enlace de invitación si tu administrador lo comparte por WhatsApp.
        </div>
      </section>
      {tenantData?.active?.restauranteId ? null : (
        <p className="mt-4 text-xs text-stone-500">
          Cuando te vincules, tu contexto de sucursal activa se asignará automáticamente.
        </p>
      )}
    </div>
  )
}

export default function AccesoOnboardingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-stone-600">Cargando onboarding de acceso...</div>}>
      <AccesoOnboardingContent />
    </Suspense>
  )
}
