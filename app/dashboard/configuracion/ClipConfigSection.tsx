'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowPathIcon, DevicePhoneMobileIcon, TrashIcon } from '@heroicons/react/24/outline'
import { apiFetch } from '@/lib/auth-fetch'

interface ClipConfigState {
  activo: boolean
  hasApiKey: boolean
  hasApiKeyDecrypted?: boolean
  apiKeyError?: string | null
  clipReady?: boolean
}

interface TerminalRow {
  id: string
  serialNumber: string
  nombre: string | null
  activo: boolean
}

export default function ClipConfigSection() {
  const [cfg, setCfg] = useState<ClipConfigState | null>(null)
  const [clipApiKeyInput, setClipApiKeyInput] = useState('')
  const [clipSecretInput, setClipSecretInput] = useState('')
  const [terminales, setTerminales] = useState<TerminalRow[]>([])
  const [newSerial, setNewSerial] = useState('')
  const [newNombre, setNewNombre] = useState('')
  const [devicesClip, setDevicesClip] = useState<unknown>(null)

  const loadCfg = useCallback(async () => {
    const res = await apiFetch('/api/clip/config')
    const j = await res.json()
    if (j.success) {
      setCfg(j.data)
      return
    }
    toast.error(j.error || 'No se pudo cargar configuración de Clip')
  }, [])

  const loadTerminales = useCallback(async () => {
    const res = await apiFetch('/api/clip/terminales')
    const j = await res.json()
    if (j.success) {
      setTerminales((j.data as TerminalRow[]).filter((t) => t.activo))
      return
    }
    toast.error(j.error || 'No se pudieron cargar terminales')
  }, [])

  useEffect(() => {
    loadCfg()
    loadTerminales()
  }, [loadCfg, loadTerminales])

  const guardarConfig = async () => {
    try {
      const api = clipApiKeyInput.trim()
      const secret = clipSecretInput.trim()
      if (!api || !secret) {
        toast.error('Pega Clave API y Clave secreta del dashboard de Clip (ambas)')
        return
      }

      const res = await apiFetch('/api/clip/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activo: true,
          clipApiKey: api,
          clipSecretKey: secret,
        }),
      })
      const j = await res.json()
      if (!j.success) {
        toast.error(j.error || 'No se pudo guardar')
        return
      }
      toast.success('Credenciales de Clip guardadas')
      setClipApiKeyInput('')
      setClipSecretInput('')
      loadCfg()
    } catch {
      toast.error('Error al guardar configuración de Clip')
    }
  }

  const eliminarApiKey = async () => {
    const res = await apiFetch('/api/clip/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clearApiKey: true }),
    })
    const j = await res.json()
    if (!j.success) {
      toast.error(j.error || 'No se pudo eliminar la API key')
      return
    }
    toast.success('Credenciales eliminadas')
    setClipApiKeyInput('')
    setClipSecretInput('')
    setDevicesClip(null)
    loadCfg()
  }

  const agregarTerminal = async () => {
    if (!newSerial.trim()) {
      toast.error('Ingresa el número de serie')
      return
    }
    const res = await apiFetch('/api/clip/terminales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serialNumber: newSerial.trim(), nombre: newNombre.trim() || undefined }),
    })
    const j = await res.json()
    if (!j.success) {
      toast.error(j.error || 'No se pudo registrar terminal')
      return
    }
    toast.success('Terminal registrada')
    setNewSerial('')
    setNewNombre('')
    loadTerminales()
  }

  const eliminarTerminal = async (id: string) => {
    const res = await apiFetch(`/api/clip/terminales/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    const j = await res.json()
    if (!j.success) {
      toast.error(j.error || 'No se pudo desactivar terminal')
      return
    }
    toast.success('Terminal desactivada')
    loadTerminales()
  }

  const refrescarDispositivos = async () => {
    const res = await apiFetch('/api/clip/dispositivos')
    const j = await res.json()
    if (!j.success) {
      toast.error(j.error || 'No se pudieron consultar dispositivos')
      return
    }
    setDevicesClip(j.data)
    toast.success('Dispositivos consultados')
  }

  const estadoClave = (() => {
    if (!cfg) return 'Cargando...'
    if (cfg.clipReady) return 'Configurado'
    if (cfg.apiKeyError === 'DECRYPT_FAILED') return 'API key inválida, vuelve a guardarla'
    if (cfg.apiKeyError === 'MISSING_KEY') return 'Falta API key'
    if (cfg.apiKeyError === 'INACTIVE') return 'Clip inactivo'
    return 'Pendiente'
  })()

  return (
    <section className="app-card space-y-5">
      <div className="flex items-start gap-3">
        <div className="app-icon-shell h-11 w-11 shrink-0">
          <DevicePhoneMobileIcon className="h-6 w-6 text-[rgb(var(--brand))]" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-50">Configuración de Clip</h2>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
            Administra credenciales y terminales autorizadas para cobros con Clip.
          </p>
        </div>
      </div>

      <div className="app-card-muted p-4 space-y-3">
        <p className="text-sm text-stone-700 dark:text-stone-300">
          Estado: <strong>{estadoClave}</strong>
        </p>
        {cfg?.apiKeyError === 'DECRYPT_FAILED' && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            La clave guardada no se puede leer. Vuelve a guardar Clave API y Clave secreta.
          </p>
        )}
        <p className="text-xs text-stone-600 dark:text-stone-400">
          En el panel de Clip obtienes dos valores: <strong>Clave API</strong> y <strong>Clave secreta</strong>.
          Ambos son obligatorios; el servidor arma el header Basic correcto para PinPad.
        </p>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">Clave API</label>
        <input
          type="password"
          autoComplete="off"
          placeholder="Ej. UUID de Clave API"
          className="app-input app-field text-sm"
          value={clipApiKeyInput}
          onChange={(e) => setClipApiKeyInput(e.target.value)}
        />
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">Clave secreta</label>
        <input
          type="password"
          autoComplete="off"
          placeholder="Clave secreta (mostrarla solo una vez en el dashboard de Clip)"
          className="app-input app-field text-sm"
          value={clipSecretInput}
          onChange={(e) => setClipSecretInput(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="app-btn-secondary text-sm" onClick={guardarConfig}>
            Guardar credenciales
          </button>
          {cfg?.hasApiKey && (
            <button type="button" className="app-btn-danger text-sm" onClick={eliminarApiKey}>
              Eliminar credenciales
            </button>
          )}
        </div>
      </div>

      <div className="app-card-muted p-4 space-y-3">
        <p className="text-sm font-medium text-stone-800 dark:text-stone-200">Terminales registradas</p>
        <ul className="space-y-2 text-sm text-stone-700 dark:text-stone-300">
          {terminales.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3">
              <span>
                <code className="rounded bg-stone-200/80 px-1 text-xs dark:bg-stone-800">{t.serialNumber}</code>
                {t.nombre ? ` · ${t.nombre}` : ''}
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-rose-700 hover:underline dark:text-rose-300"
                onClick={() => eliminarTerminal(t.id)}
              >
                <TrashIcon className="h-4 w-4" />
                Quitar
              </button>
            </li>
          ))}
          {terminales.length === 0 && (
            <li className="text-stone-500 dark:text-stone-400">Aún no hay terminales registradas.</li>
          )}
        </ul>
        <div className="flex flex-wrap gap-2">
          <input
            className="app-input app-field min-w-[180px] flex-1 py-2 text-sm"
            placeholder="Número de serie"
            value={newSerial}
            onChange={(e) => setNewSerial(e.target.value)}
          />
          <input
            className="app-input app-field min-w-[120px] flex-1 py-2 text-sm"
            placeholder="Nombre (opcional)"
            value={newNombre}
            onChange={(e) => setNewNombre(e.target.value)}
          />
          <button type="button" className="app-btn-secondary text-sm" onClick={agregarTerminal}>
            Registrar
          </button>
        </div>
      </div>

      <div className="app-card-muted p-4 space-y-2">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm text-[rgb(var(--brand))] hover:underline"
          onClick={refrescarDispositivos}
        >
          <ArrowPathIcon className="h-4 w-4" />
          Ver terminales disponibles en Clip
        </button>
        {devicesClip != null && (
          <pre className="max-h-40 overflow-auto rounded bg-stone-900 p-2 text-[11px] text-stone-100">
            {JSON.stringify(devicesClip, null, 2)}
          </pre>
        )}
      </div>
    </section>
  )
}

