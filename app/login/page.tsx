'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import toast from 'react-hot-toast'
import BrandLogo from '@/components/BrandLogo'
import ThemeToggle from '@/components/ThemeToggle'

export default function LoginPage() {
  const [activeTheme, setActiveTheme] = useState<'light' | 'dark'>('light')
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    slug: 'principal',
  })

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get('error')
    if (e === 'OAuthAccountNotLinked' || e === 'Configuration') {
      toast.error('No se pudo completar el inicio con Google.')
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const syncTheme = () => {
      setActiveTheme(root.classList.contains('dark') ? 'dark' : 'light')
    }

    syncTheme()

    const observer = new MutationObserver(syncTheme)
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    })

    return () => observer.disconnect()
  }, [])

  const themedInputStyle =
    activeTheme === 'dark'
      ? {
          backgroundColor: 'rgba(28, 25, 23, 0.96)',
          borderColor: 'rgba(120, 113, 108, 0.9)',
          color: 'rgb(245 245 244)',
        }
      : {
          backgroundColor: 'rgba(255, 252, 247, 0.96)',
          borderColor: 'rgba(214, 211, 209, 0.9)',
          color: 'rgb(41 37 36)',
        }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await signIn('credentials', {
        email: formData.email.trim(),
        password: formData.password,
        slug: formData.slug.trim() || 'principal',
        redirect: false,
      })

      if (res?.error) {
        throw new Error('Credenciales inválidas o restaurante no encontrado')
      }

      const sessionRes = await fetch('/api/auth/session', { credentials: 'same-origin' })
      const session = await sessionRes.json()
      if (session?.user) {
        localStorage.setItem('user', JSON.stringify(session.user))
      }

      toast.success('Sesión iniciada correctamente')
      window.location.href = '/dashboard'
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error al iniciar sesión'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    const slug = formData.slug.trim() || 'principal'
    setLoading(true)
    try {
      await fetch('/api/auth/oauth-slug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ slug }),
      })
      await signIn('google', { callbackUrl: '/dashboard' })
    } catch {
      toast.error('Error al iniciar con Google')
    } finally {
      setLoading(false)
    }
  }

  const googleEnabled =
    typeof process !== 'undefined' &&
    Boolean(process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED)

  return (
    <div className="app-login-shell px-4 py-7 lg:py-10">
      <div className="mx-auto mb-4 flex max-w-6xl justify-end lg:mb-6">
        <ThemeToggle />
      </div>
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-start gap-6 lg:min-h-0 lg:grid-cols-[1.2fr_0.8fr] lg:gap-8">
        <section className="hidden lg:block">
          <div className="max-w-none">
            <BrandLogo
              size="xl"
              priority
              className="-mt-3 h-[220px] w-full max-w-[1200px]"
            />
            <p className="app-kicker mt-5">Suite operativa para restaurantes</p>
            <h1 className="mt-3 text-5xl font-semibold leading-tight text-stone-900">
              Servicio, ritmo y control en una sola plataforma.
            </h1>
            <p className="mt-4 text-lg text-stone-600">
              ServimOS conecta mesas, cocina, barra, caja y análisis con una identidad
              visual más cálida, precisa y profesional.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="app-brand-panel p-5">
                <p className="text-sm font-medium text-stone-500">Flujo operativo</p>
                <p className="mt-2 text-2xl font-semibold text-stone-900">Del salón al cobro</p>
              </div>
              <div className="app-brand-panel p-5">
                <p className="text-sm font-medium text-stone-500">Visibilidad</p>
                <p className="mt-2 text-2xl font-semibold text-stone-900">Operación en tiempo real</p>
              </div>
            </div>
          </div>
        </section>

        <div className="w-full">
          <div className="mb-4 flex justify-center lg:hidden">
            <BrandLogo
              size="xl"
              priority
              className="h-[132px] w-full max-w-[520px]"
            />
          </div>

          <div className="app-brand-panel mx-auto w-full max-w-md p-8">
            <div>
              <p className="app-kicker text-center">Acceso</p>
              <p className="mt-2 text-center text-sm text-stone-600">
                Inicia sesión para entrar al centro operativo de ServimOS.
              </p>
            </div>

            <div className="app-brand-divider mt-6" />

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-3">
                <div>
                  <label htmlFor="slug" className="mb-1.5 block text-sm font-medium text-stone-700">
                    Restaurante (slug)
                  </label>
                  <input
                    id="slug"
                    name="slug"
                    type="text"
                    autoComplete="organization"
                    className="app-input border-stone-300 bg-white/95 text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
                    style={themedInputStyle}
                    placeholder="principal"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-stone-700">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="app-input border-stone-300 bg-white/95 text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
                    style={themedInputStyle}
                    placeholder="admin@restaurante.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-stone-700">
                    Contraseña
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="app-input border-stone-300 bg-white/95 text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
                    style={themedInputStyle}
                    placeholder="Tu contraseña"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className="app-btn-primary w-full">
                {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
              </button>

              {googleEnabled && (
                <>
                  <div className="relative py-2 text-center text-xs text-stone-500">o</div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void handleGoogle()}
                    className="app-btn-secondary w-full border-stone-300"
                  >
                    Continuar con Google
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
