'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import toast from 'react-hot-toast'
import BrandLogo from '@/components/BrandLogo'

function RegisterPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'worker' | 'owner'>('worker')
  const [form, setForm] = useState({
    organizacionNombre: '',
    restauranteNombre: '',
    email: '',
    password: '',
    nombre: '',
    apellido: '',
  })

  useEffect(() => {
    const qMode = searchParams.get('mode')
    if (qMode === 'owner') setMode('owner')
  }, [searchParams])

  const title = useMemo(
    () => (mode === 'owner' ? 'Registrar mi negocio' : 'Crear cuenta de trabajador'),
    [mode]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payloadBase = {
        email: form.email,
        password: form.password,
        nombre: form.nombre,
        apellido: form.apellido,
      }
      const endpoint = mode === 'owner' ? '/api/auth/register' : '/api/auth/register-user'
      const payload =
        mode === 'owner'
          ? {
              ...payloadBase,
              organizacionNombre: form.organizacionNombre,
              restauranteNombre: form.restauranteNombre,
            }
          : payloadBase

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al registrar')
      }

      const restauranteId = data?.data?.restauranteId as string | undefined
      if (restauranteId) {
        const signInRes = await signIn('credentials', {
          email: form.email.trim().toLowerCase(),
          password: form.password,
          restauranteId,
          redirect: false,
        })
        if (!signInRes?.error) {
          toast.success('Cuenta creada y sesión iniciada.')
          router.push(mode === 'owner' ? '/dashboard' : '/acceso')
          return
        }
      }

      toast.success('Cuenta creada. Inicia sesión con tu email y contraseña.')
      router.push('/login')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-login-shell px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 flex justify-center">
          <BrandLogo size="lg" className="h-24 w-auto max-w-[320px]" />
        </div>
        <div className="app-brand-panel p-8">
          <h1 className="text-xl font-semibold text-stone-900">{title}</h1>
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-stone-200 p-1">
            <button
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                mode === 'worker' ? 'bg-stone-900 text-white' : 'text-stone-700'
              }`}
              onClick={() => setMode('worker')}
            >
              Entrar con código
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                mode === 'owner' ? 'bg-stone-900 text-white' : 'text-stone-700'
              }`}
              onClick={() => setMode('owner')}
            >
              Registrar negocio
            </button>
          </div>
          <p className="mt-4 text-sm text-stone-600">
            {mode === 'owner'
              ? 'Crea tu cuenta y da de alta tu sucursal inicial.'
              : 'Crea tu cuenta personal y vincúlate luego con código o QR de sucursal.'}
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {mode === 'owner' && (
              <>
                <input
                  required
                  className="app-input w-full"
                  placeholder="Nombre de la organización"
                  value={form.organizacionNombre}
                  onChange={(e) => setForm({ ...form, organizacionNombre: e.target.value })}
                />
                <input
                  required
                  className="app-input w-full"
                  placeholder="Nombre del restaurante / sucursal"
                  value={form.restauranteNombre}
                  onChange={(e) => setForm({ ...form, restauranteNombre: e.target.value })}
                />
              </>
            )}
            <input
              required
              type="email"
              className="app-input w-full"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              required
              type="password"
              minLength={8}
              className="app-input w-full"
              placeholder="Contraseña (mín. 8 caracteres)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <input
              required
              className="app-input w-full"
              placeholder="Tu nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
            <input
              required
              className="app-input w-full"
              placeholder="Tu apellido"
              value={form.apellido}
              onChange={(e) => setForm({ ...form, apellido: e.target.value })}
            />
            <button type="submit" disabled={loading} className="app-btn-primary w-full">
              {loading ? 'Creando…' : mode === 'owner' ? 'Crear negocio' : 'Crear cuenta'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-stone-600">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-medium text-amber-800 underline">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-stone-600">Cargando registro...</div>}>
      <RegisterPageContent />
    </Suspense>
  )
}
