'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import toast from 'react-hot-toast'
import BrandLogo from '@/components/BrandLogo'
import ThemeToggle from '@/components/ThemeToggle'

type ChooseOption = { restauranteId: string; nombre: string }

export default function LoginPage() {
  const [activeTheme, setActiveTheme] = useState<'light' | 'dark'>('light')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'form' | 'choose'>('form')
  const [chooseOptions, setChooseOptions] = useState<ChooseOption[]>([])
  const [selectedRestauranteId, setSelectedRestauranteId] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get('error')
    if (e === 'OAuthAccountNotLinked' || e === 'Configuration') {
      toast.error('No se pudo completar el inicio con Google.')
    }
    if (e === 'google_multi') {
      toast.error(
        'Ese email está en varios restaurantes. Inicia sesión con contraseña y elige el local.'
      )
    }
    if (e === 'google_register') {
      toast.error(
        'No hay cuenta con Google para este entorno. Regístrate o pide una invitación.'
      )
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

  const completeSignIn = async (restauranteId: string) => {
    const res = await signIn('credentials', {
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
      restauranteId,
      redirect: false,
    })

    if (res?.error) {
      throw new Error('No se pudo iniciar sesión. Vuelve a intentarlo.')
    }

    const sessionRes = await fetch('/api/auth/session', { credentials: 'same-origin' })
    const session = await sessionRes.json()
    if (session?.user) {
      localStorage.setItem('user', JSON.stringify(session.user))
    }

    toast.success('Sesión iniciada correctamente')
    window.location.href = '/dashboard'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 'choose') {
      if (!selectedRestauranteId) {
        toast.error('Elige un restaurante')
        return
      }
      setLoading(true)
      try {
        await completeSignIn(selectedRestauranteId)
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Error al iniciar sesión'
        toast.error(msg)
      } finally {
        setLoading(false)
      }
      return
    }

    setLoading(true)
    try {
      const pre = await fetch('/api/auth/prelogin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
        }),
      })
      const data = (await pre.json()) as {
        ok?: boolean
        mode?: string
        restauranteId?: string
        options?: ChooseOption[]
        error?: string
      }

      if (!pre.ok || !data.ok) {
        if (pre.status >= 500) {
          throw new Error(
            'El servidor no puede validar el acceso (suele ser la base de datos). Abre /api/health en este sitio; en Vercel + Supabase usa DATABASE_URL del pooler (puerto 6543), no :5432.'
          )
        }
        throw new Error(data.error ?? 'Credenciales incorrectas')
      }

      if (data.mode === 'single' && data.restauranteId) {
        await completeSignIn(data.restauranteId)
        return
      }

      if (data.mode === 'choose' && data.options?.length) {
        setChooseOptions(data.options)
        setSelectedRestauranteId(data.options[0]?.restauranteId ?? '')
        setStep('choose')
        return
      }

      throw new Error('Respuesta inesperada del servidor')
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error al iniciar sesión'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setLoading(true)
    try {
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
                Inicia sesión con tu email y contraseña.
              </p>
            </div>

            <div className="app-brand-divider mt-6" />

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              {step === 'choose' ? (
                <div className="space-y-4">
                  <p className="text-sm text-stone-600">
                    Tu cuenta existe en varios restaurantes. Elige dónde entrar:
                  </p>
                  <div className="space-y-2">
                    {chooseOptions.map((opt) => (
                      <label
                        key={opt.restauranteId}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-stone-200 p-3 dark:border-stone-700"
                      >
                        <input
                          type="radio"
                          name="restaurante"
                          className="h-4 w-4"
                          checked={selectedRestauranteId === opt.restauranteId}
                          onChange={() => setSelectedRestauranteId(opt.restauranteId)}
                        />
                        <span className="font-medium text-stone-900 dark:text-stone-100">
                          {opt.nombre}
                        </span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="text-sm text-amber-800 underline dark:text-amber-400"
                    onClick={() => {
                      setStep('form')
                      setChooseOptions([])
                      setSelectedRestauranteId('')
                    }}
                  >
                    Volver
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
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
              )}

              <button type="submit" disabled={loading} className="app-btn-primary w-full">
                {loading
                  ? 'Iniciando sesión...'
                  : step === 'choose'
                    ? 'Continuar'
                    : 'Iniciar sesión'}
              </button>

              {step === 'form' && googleEnabled && (
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
