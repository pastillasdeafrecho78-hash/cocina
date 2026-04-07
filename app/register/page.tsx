'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import toast from 'react-hot-toast'
import BrandLogo from '@/components/BrandLogo'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    organizacionNombre: '',
    restauranteNombre: '',
    email: '',
    password: '',
    nombre: '',
    apellido: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
          router.push('/dashboard')
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
          <h1 className="text-xl font-semibold text-stone-900">Crear cuenta</h1>
          <p className="mt-4 text-sm text-stone-600">
            Registra tu organización y tu restaurante. Solo necesitas email y contraseña para entrar
            después del registro.
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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
              placeholder="Nombre del restaurante"
              value={form.restauranteNombre}
              onChange={(e) => setForm({ ...form, restauranteNombre: e.target.value })}
            />
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
              {loading ? 'Creando…' : 'Registrar'}
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
