'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/auth-fetch'

type FlagStatus = {
  key: string
  enabled: boolean
  value: 'set' | 'unset'
}

type SchemaCheck = {
  key: string
  label: string
  ok: boolean
  hint: string
}

type RolloutStatus = {
  ok: boolean
  generatedAt: string
  flags: FlagStatus[]
  schema: SchemaCheck[]
  nextSteps: string[]
}

function StatusPill({ ok }: { ok: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
      }`}
    >
      {ok ? 'OK' : 'Pendiente'}
    </span>
  )
}

export default function RolloutStatusSection() {
  const [data, setData] = useState<RolloutStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargarDiagnostico() {
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch('/api/configuracion/rollout')
      const body = await res.json()
      if (!res.ok || !body.success) {
        throw new Error(body.error || 'No se pudo cargar el diagnóstico')
      }
      setData(body.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el diagnóstico')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Diagnóstico de rollout</h2>
          <p className="mt-1 text-sm text-gray-600">
            Revisa si Vercel tiene los flags activos y si Supabase ya tiene las migraciones del
            segundo momento.
          </p>
        </div>
        <button
          type="button"
          onClick={cargarDiagnostico}
          disabled={loading}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Revisando...' : 'Revisar rollout'}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill ok={data.ok} />
            <span className="text-sm text-gray-600">
              Última revisión: {new Date(data.generatedAt).toLocaleString('es-MX')}
            </span>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Flags</h3>
            <div className="mt-2 grid gap-2">
              {data.flags.map((flag) => (
                <div
                  key={flag.key}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs text-gray-700">{flag.key}</span>
                  <StatusPill ok={flag.enabled} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Migraciones críticas
            </h3>
            <div className="mt-2 grid gap-2">
              {data.schema.map((check) => (
                <div key={check.key} className="rounded-xl bg-white px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-gray-800">{check.label}</span>
                    <StatusPill ok={check.ok} />
                  </div>
                  {!check.ok && <p className="mt-1 text-xs text-gray-500">{check.hint}</p>}
                </div>
              ))}
            </div>
          </div>

          {data.nextSteps.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-semibold text-amber-900">Siguientes pasos</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                {data.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
