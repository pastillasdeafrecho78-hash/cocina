'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

function AcceptInviteForm() {
  const search = useSearchParams()
  const token = useMemo(() => search.get('token') ?? '', [search])

  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    password: '',
  })

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
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'No se pudo aceptar la invitación')
      }
      toast.success('Invitación aceptada. Ya puedes iniciar sesión.')
      window.location.href = '/login'
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
