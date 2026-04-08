'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import { apiFetch, authFetch } from '@/lib/auth-fetch'

type Reservacion = {
  id: string
  clienteNombre: string
  clienteEmail?: string | null
  clienteTelefono?: string | null
  partySize: number
  reservedFor: string
  durationMinutes: number
  status: 'PENDIENTE' | 'CONFIRMADA' | 'ASIGNADA' | 'CANCELADA' | 'COMPLETADA'
  notes?: string | null
  mesaId?: string | null
  mesaNumero?: number | null
}

export default function ReservacionesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<Reservacion[]>([])
  const [form, setForm] = useState({
    clienteNombre: '',
    clienteEmail: '',
    clienteTelefono: '',
    partySize: '2',
    reservedFor: '',
    durationMinutes: '90',
    notes: '',
  })

  const upcoming = useMemo(
    () =>
      rows
        .filter((r) => ['PENDIENTE', 'CONFIRMADA', 'ASIGNADA'].includes(r.status))
        .sort((a, b) => +new Date(a.reservedFor) - +new Date(b.reservedFor)),
    [rows]
  )

  const loadRows = async () => {
    try {
      const response = await authFetch('/api/reservaciones')
      if (response.status === 401) return
      const data = await response.json()
      if (!data.success) throw new Error(data.error ?? 'Error al cargar reservaciones')
      setRows(data.data ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al cargar reservaciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRows()
  }, [])

  const createReservation = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await apiFetch('/api/reservaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteNombre: form.clienteNombre,
          clienteEmail: form.clienteEmail || undefined,
          clienteTelefono: form.clienteTelefono || undefined,
          partySize: Number(form.partySize),
          reservedFor: new Date(form.reservedFor).toISOString(),
          durationMinutes: Number(form.durationMinutes),
          notes: form.notes || undefined,
        }),
      })
      const data = await response.json()
      if (!data.success) throw new Error(data.error ?? 'No se pudo crear reservacion')
      toast.success('Reservacion creada')
      setForm({
        clienteNombre: '',
        clienteEmail: '',
        clienteTelefono: '',
        partySize: '2',
        reservedFor: '',
        durationMinutes: '90',
        notes: '',
      })
      await loadRows()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al crear reservacion')
    } finally {
      setSaving(false)
    }
  }

  const cancelReservation = async (id: string) => {
    try {
      const response = await apiFetch(`/api/reservaciones/${id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!data.success) throw new Error(data.error ?? 'No se pudo cancelar')
      toast.success('Reservacion cancelada')
      await loadRows()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al cancelar reservacion')
    }
  }

  if (loading) {
    return (
      <div className="app-page">
        <div className="app-card text-center text-stone-600">Cargando reservaciones...</div>
      </div>
    )
  }

  return (
    <div className="app-page">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="app-card">
          <BackButton className="mb-4" />
          <p className="app-kicker">Mesas</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-900">Reservaciones</h1>
          <p className="mt-2 text-stone-600">
            Crea y administra reservaciones por horario. Solo perfiles con permiso especial pueden modificar o cancelar terceros.
          </p>
        </div>

        <div className="app-card">
          <h2 className="text-xl font-semibold text-stone-900 mb-4">Nueva reservacion</h2>
          <form onSubmit={createReservation} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              className="app-input"
              placeholder="Nombre del cliente"
              value={form.clienteNombre}
              onChange={(event) => setForm((prev) => ({ ...prev, clienteNombre: event.target.value }))}
              required
            />
            <input
              className="app-input"
              placeholder="Correo (opcional)"
              value={form.clienteEmail}
              onChange={(event) => setForm((prev) => ({ ...prev, clienteEmail: event.target.value }))}
            />
            <input
              className="app-input"
              placeholder="Telefono (opcional)"
              value={form.clienteTelefono}
              onChange={(event) => setForm((prev) => ({ ...prev, clienteTelefono: event.target.value }))}
            />
            <input
              className="app-input"
              type="number"
              min={1}
              max={30}
              placeholder="Personas"
              value={form.partySize}
              onChange={(event) => setForm((prev) => ({ ...prev, partySize: event.target.value }))}
              required
            />
            <input
              className="app-input"
              type="datetime-local"
              value={form.reservedFor}
              onChange={(event) => setForm((prev) => ({ ...prev, reservedFor: event.target.value }))}
              required
            />
            <input
              className="app-input"
              type="number"
              min={30}
              max={360}
              value={form.durationMinutes}
              onChange={(event) => setForm((prev) => ({ ...prev, durationMinutes: event.target.value }))}
              required
            />
            <input
              className="app-input md:col-span-2"
              placeholder="Notas (opcional)"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
            <button type="submit" className="app-btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Crear reservacion'}
            </button>
          </form>
        </div>

        <div className="app-card">
          <h2 className="text-xl font-semibold text-stone-900 mb-4">Proximas reservaciones</h2>
          {!upcoming.length ? <p className="text-stone-500">No hay reservaciones activas.</p> : null}
          <div className="space-y-3">
            {upcoming.map((row) => (
              <div key={row.id} className="rounded-2xl border border-stone-200 p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-stone-900">
                    {row.clienteNombre} · {row.partySize} personas
                  </p>
                  <p className="text-sm text-stone-600">
                    {new Date(row.reservedFor).toLocaleString('es-MX')} · {row.durationMinutes} min · Mesa{' '}
                    {row.mesaNumero ?? 'por asignar'}
                  </p>
                  {row.clienteTelefono ? <p className="text-sm text-stone-500">Tel: {row.clienteTelefono}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs rounded-full bg-stone-100 px-3 py-1">{row.status}</span>
                  {row.status !== 'CANCELADA' && row.status !== 'COMPLETADA' ? (
                    <button className="app-btn-secondary" onClick={() => cancelReservation(row.id)}>
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
