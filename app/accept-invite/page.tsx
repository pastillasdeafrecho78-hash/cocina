'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

function AcceptInviteForm() {
  const search = useSearchParams()
  const token = useMemo(() => search.get('token') ?? '', [search])
  const [preview, setPreview] = useState<{
    email: string
    expiraEn: string
    usadaEn: string | null
    expirada: boolean
    rol: { id: string; nombre: string }
    restaurante: {
      id: string
      nombre: string
      slug: string | null
      organizacion: { id: string; nombre: string } | null
    }
  } | null>(null)

  const [loading, setLoading] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(true)
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    password: '',
  })

  useEffect(() => {
    const loadPreview = async () => {
      if (!token) {
        setLoadingPreview(false)
        return
      }
      try {
        const res = await fetch(`/api/auth/invites/preview?token=${encodeURIComponent(token)}`, {
          cache: 'no-store',
        })
        const data = (await res.json()) as { success?: boolean; data?: typeof preview; error?: string }
        if (res.ok && data.success && data.data) {
          setPreview(data.data)
        } else {
          toast.error(data.error ?? 'No se pudo validar la invitación')
        }
      } catch {
        toast.error('No se pudo validar la invitación')
      } finally {
        setLoadingPreview(false)
      }
    }
    void loadPreview()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      toast.error('Token de invitación inválido')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          nombre: formData.nombre.trim(),
          apellido: formData.apellido.trim(),
          password: formData.password,
        }),
      })
      const data = (await res.json()) as {
        success?: boolean
        error?: string
        data?: { email?: string }
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'No se pudo aceptar la invitación')
      }
      toast.success('Invitación aceptada. Ya puedes iniciar sesión.')
      const emailHint = data.data?.email ?? preview?.email ?? ''
      const qp = new URLSearchParams({ invited: '1' })
      if (emailHint) qp.set('email', emailHint)
      window.location.href = `/login?${qp.toString()}`
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al aceptar invitación'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <div className="app-brand-panel w-full p-8">
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-100">
          Aceptar invitación
        </h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          Crea tu contraseña para unirte al restaurante.
        </p>
        {loadingPreview ? (
          <p className="mt-3 text-sm text-stone-500">Validando invitación...</p>
        ) : preview ? (
          <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-500/35 dark:bg-sky-950/55 dark:text-sky-100">
            <p>
              Organización:{' '}
              <strong>{preview.restaurante.organizacion?.nombre ?? 'Sin organización'}</strong>
            </p>
            <p>
              Sucursal: <strong>{preview.restaurante.nombre}</strong>
              {preview.restaurante.slug ? ` (${preview.restaurante.slug})` : ''}
            </p>
            <p>
              Rol asignado: <strong>{preview.rol.nombre}</strong>
            </p>
            <p>
              Email invitado: <strong>{preview.email}</strong>
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-red-600">No se pudo validar la invitación.</p>
        )}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <input
            className="app-input"
            placeholder="Nombre"
            required
            value={formData.nombre}
            onChange={(e) => setFormData((prev) => ({ ...prev, nombre: e.target.value }))}
          />
          <input
            className="app-input"
            placeholder="Apellido"
            required
            value={formData.apellido}
            onChange={(e) => setFormData((prev) => ({ ...prev, apellido: e.target.value }))}
          />
          <input
            type="password"
            className="app-input"
            placeholder="Contraseña (mínimo 8 caracteres)"
            required
            minLength={8}
            value={formData.password}
            onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
          />
          <button type="submit" disabled={loading} className="app-btn-primary w-full">
            {loading ? 'Procesando...' : 'Aceptar invitación'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md p-6">Cargando invitación...</main>}>
      <AcceptInviteForm />
    </Suspense>
  )
}
