'use client'

import { useEffect, useMemo, useState } from 'react'
import { signIn } from 'next-auth/react'
import { tienePermiso } from '@/lib/permisos'

type TenancyPayload = {
  activeOrganizacionId?: string | null
  activeRestauranteId?: string | null
  current: {
    restauranteId: string
    restauranteNombre: string
    restauranteSlug: string | null
    organizacionId: string | null
    organizacionNombre: string | null
  } | null
  branches: Array<{
    restauranteId: string
    restauranteNombre: string
    restauranteSlug: string | null
    organizacionId: string | null
    organizacionNombre: string | null
    esPrincipal: boolean
    isActive: boolean
  }>
  organizations: Array<{
    organizacionId: string
    organizacionNombre: string
    esOwner: boolean
  }>
  organizationBranches: Array<{
    organizacionId: string
    organizacionNombre: string
    branches: Array<{
      restauranteId: string
      restauranteNombre: string
      restauranteSlug: string | null
      esPrincipal: boolean
      isActive: boolean
    }>
  }>
  oauth: {
    linkedProviders: string[]
    availableProviders: Array<{ provider: string; enabled: boolean }>
  }
}

type Role = { id: string; nombre: string; codigo?: string | null }

export default function TenantIdentitySection() {
  const [tenancy, setTenancy] = useState<TenancyPayload | null>(null)
  const [me, setMe] = useState<any>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRoleId, setInviteRoleId] = useState('')
  const [inviteStatus, setInviteStatus] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [loadingInvite, setLoadingInvite] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [membersData, setMembersData] = useState<Array<Record<string, unknown>>>([])
  const [membersTitle, setMembersTitle] = useState('')
  const [membersLoading, setMembersLoading] = useState(false)
  const [invites, setInvites] = useState<
    Array<{ id: string; email: string; expiraEn: string; usadaEn: string | null }>
  >([])
  const [providerLoading, setProviderLoading] = useState<string | null>(null)

  const canManageUsers = useMemo(() => tienePermiso(me, 'usuarios_roles'), [me])

  useEffect(() => {
    const load = async () => {
      const [tenancyRes, meRes] = await Promise.all([
        fetch('/api/auth/tenancy', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' }),
      ])
      const tenancyData = (await tenancyRes.json()) as { success?: boolean; data?: TenancyPayload }
      const meData = (await meRes.json()) as { success?: boolean; data?: unknown }
      if (tenancyData.success && tenancyData.data) setTenancy(tenancyData.data)
      if (meData.success && meData.data) setMe(meData.data)
      if (tenancyData.success && tenancyData.data) {
        setSelectedOrgId(
          tenancyData.data.activeOrganizacionId ??
            tenancyData.data.current?.organizacionId ??
            tenancyData.data.organizations[0]?.organizacionId ??
            ''
        )
      }
    }
    void load()
  }, [])

  useEffect(() => {
    if (!canManageUsers) return
    const loadRoles = async () => {
      const res = await fetch('/api/roles', { credentials: 'same-origin' })
      const data = (await res.json()) as { success?: boolean; data?: Role[] }
      if (data.success && Array.isArray(data.data)) {
        setRoles(data.data)
        setInviteRoleId(data.data[0]?.id ?? '')
      }
    }
    void loadRoles()
  }, [canManageUsers])

  useEffect(() => {
    if (!canManageUsers) return
    const loadInvites = async () => {
      const res = await fetch('/api/auth/invites', { credentials: 'same-origin', cache: 'no-store' })
      const data = (await res.json()) as {
        success?: boolean
        data?: Array<{ id: string; email: string; expiraEn: string; usadaEn: string | null }>
      }
      if (data.success && Array.isArray(data.data)) {
        setInvites(data.data)
      }
    }
    void loadInvites()
  }, [canManageUsers])

  const linkedSet = useMemo(
    () => new Set(tenancy?.oauth.linkedProviders ?? []),
    [tenancy?.oauth.linkedProviders]
  )

  const filteredBranches = useMemo(() => {
    if (!tenancy) return []
    if (!selectedOrgId) return tenancy.branches
    return tenancy.branches.filter((b) => (b.organizacionId ?? '__none__') === selectedOrgId)
  }, [tenancy, selectedOrgId])

  const refreshTenancy = async () => {
    const res = await fetch('/api/auth/tenancy', { cache: 'no-store', credentials: 'same-origin' })
    const data = (await res.json()) as { success?: boolean; data?: TenancyPayload }
    if (data.success && data.data) {
      setTenancy(data.data)
      if (!selectedOrgId && data.data.organizations.length) {
        setSelectedOrgId(data.data.organizations[0].organizacionId)
      }
    }
  }

  const switchContext = async (payload: { restauranteId?: string; organizacionId?: string }) => {
    setSwitching(true)
    try {
      const res = await fetch('/api/auth/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'No se pudo cambiar contexto')
      await refreshTenancy()
      const meRes = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
      const meData = (await meRes.json()) as { success?: boolean; data?: unknown }
      if (meData.success && meData.data) {
        localStorage.setItem('user', JSON.stringify(meData.data))
      }
      window.location.href = '/dashboard'
    } catch (error) {
      setInviteStatus(error instanceof Error ? error.message : 'Error al cambiar contexto')
    } finally {
      setSwitching(false)
    }
  }

  const loadMembers = async (scope: 'branch' | 'organization', id: string, title: string) => {
    setMembersLoading(true)
    setMembersTitle(title)
    setMembersData([])
    try {
      const res = await fetch(`/api/auth/memberships?scope=${scope}&id=${id}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      const data = (await res.json()) as {
        success?: boolean
        data?: { members?: Array<Record<string, unknown>> }
        error?: string
      }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'No se pudo cargar miembros')
      setMembersData(data.data?.members ?? [])
    } catch (error) {
      setInviteStatus(error instanceof Error ? error.message : 'No se pudo cargar miembros')
    } finally {
      setMembersLoading(false)
    }
  }

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !inviteRoleId) return
    setLoadingInvite(true)
    setInviteStatus('')
    setInviteUrl('')
    try {
      const res = await fetch('/api/auth/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          rolId: inviteRoleId,
        }),
      })
      const data = (await res.json()) as {
        success?: boolean
        error?: string
        data?: { inviteUrl?: string }
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'No se pudo generar invitación')
      }
      setInviteStatus('Invitación creada correctamente')
      setInviteUrl(data.data?.inviteUrl ?? '')
      setInviteEmail('')
    } catch (error) {
      setInviteStatus(error instanceof Error ? error.message : 'Error al crear invitación')
    } finally {
      setLoadingInvite(false)
    }
  }

  return (
    <section className="space-y-6 rounded-2xl border border-stone-200 bg-stone-50/80 p-5 dark:border-stone-700 dark:bg-stone-900/45">
      <div>
        <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
          Multitenant, multisucursal e identidad
        </h2>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          Aquí puedes validar organización/sucursal activa y vincular proveedores de acceso social.
        </p>
      </div>

      {tenancy?.current && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-500/35 dark:bg-sky-950/55">
          <p className="text-xs uppercase tracking-[0.18em] text-sky-700 dark:text-sky-200">
            Contexto activo
          </p>
          <p className="mt-2 text-sm text-sky-900 dark:text-sky-100">
            Organización: <strong>{tenancy.current.organizacionNombre ?? 'Sin organización'}</strong>
          </p>
          <p className="text-sm text-sky-900 dark:text-sky-100">
            Sucursal: <strong>{tenancy.current.restauranteNombre}</strong>
            {tenancy.current.restauranteSlug ? ` (${tenancy.current.restauranteSlug})` : ''}
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-950/55">
          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">Sucursales vinculadas</p>
          <ul className="mt-2 space-y-1 text-sm text-stone-700 dark:text-stone-300">
            {(tenancy?.branches ?? []).map((b) => (
              <li key={b.restauranteId}>
                {b.restauranteNombre}
                {b.organizacionNombre ? ` · ${b.organizacionNombre}` : ''}
                {b.isActive ? ' (activa)' : ''}
                <div className="mt-1 flex gap-2">
                  {!b.isActive && (
                    <button
                      type="button"
                      disabled={switching}
                      onClick={() => void switchContext({ restauranteId: b.restauranteId })}
                      className="text-xs underline"
                    >
                      Cambiar a esta sucursal
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      void loadMembers('branch', b.restauranteId, `Miembros de ${b.restauranteNombre}`)
                    }
                    className="text-xs underline"
                  >
                    Ver miembros
                  </button>
                </div>
              </li>
            ))}
            {(tenancy?.branches ?? []).length === 0 && <li>Sin sucursales asociadas</li>}
          </ul>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-950/55">
          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">Organizaciones vinculadas</p>
          <ul className="mt-2 space-y-1 text-sm text-stone-700 dark:text-stone-300">
            {(tenancy?.organizations ?? []).map((o) => (
              <li key={o.organizacionId}>
                {o.organizacionNombre}
                {o.esOwner ? ' (owner)' : ''}
                <div className="mt-1 flex gap-2">
                  {tenancy?.activeOrganizacionId !== o.organizacionId && (
                    <button
                      type="button"
                      disabled={switching}
                      onClick={() => {
                        setSelectedOrgId(o.organizacionId)
                        void switchContext({ organizacionId: o.organizacionId })
                      }}
                      className="text-xs underline"
                    >
                      Cambiar a esta organización
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      void loadMembers('organization', o.organizacionId, `Miembros de ${o.organizacionNombre}`)
                    }
                    className="text-xs underline"
                  >
                    Ver miembros
                  </button>
                </div>
              </li>
            ))}
            {(tenancy?.organizations ?? []).length === 0 && <li>Sin organizaciones asociadas</li>}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-950/55">
        <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
          Vinculación de cuentas (Google / Meta)
        </p>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Conecta proveedores para login rápido y vínculo de identidad.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {tenancy?.oauth.availableProviders.map((p) => (
            <button
              key={p.provider}
              type="button"
              disabled={!p.enabled || providerLoading === p.provider}
              onClick={async () => {
                setProviderLoading(p.provider)
                await signIn(p.provider, { callbackUrl: '/dashboard/configuracion' })
              }}
              className="app-btn-secondary"
            >
              {providerLoading === p.provider
                ? 'Abriendo proveedor...'
                : linkedSet.has(p.provider)
                  ? `Vinculado: ${p.provider}`
                  : `Vincular ${p.provider}`}
            </button>
          ))}
        </div>
      </div>

      {canManageUsers && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-400/35 dark:bg-amber-950/45">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Invitar usuarios a la sucursal activa
          </p>
          <form className="mt-3 grid gap-2 md:grid-cols-[1.5fr_1fr_auto]" onSubmit={createInvite}>
            <input
              className="app-input"
              type="email"
              required
              placeholder="correo@ejemplo.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <select
              className="app-input"
              required
              value={inviteRoleId}
              onChange={(e) => setInviteRoleId(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
            <button type="submit" disabled={loadingInvite} className="app-btn-primary">
              {loadingInvite ? 'Creando...' : 'Invitar'}
            </button>
          </form>
          {inviteStatus && <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">{inviteStatus}</p>}
          {inviteUrl && (
            <p className="mt-1 break-all text-xs text-amber-900 dark:text-amber-100">
              Link: {inviteUrl}
            </p>
          )}
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-900 dark:text-amber-100">
              Invitaciones recientes
            </p>
            <ul className="mt-2 space-y-1 text-xs text-amber-900 dark:text-amber-100">
              {invites.slice(0, 6).map((inv) => (
                <li key={inv.id}>
                  {inv.email} · {inv.usadaEn ? 'Aceptada' : 'Pendiente'} · expira{' '}
                  {new Date(inv.expiraEn).toLocaleString('es-MX')}
                </li>
              ))}
              {invites.length === 0 && <li>Sin invitaciones aún.</li>}
            </ul>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-950/55">
        <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">Selector operativo</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <select
            className="app-input"
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
          >
            {(tenancy?.organizations ?? []).map((org) => (
              <option key={org.organizacionId} value={org.organizacionId}>
                {org.organizacionNombre}
              </option>
            ))}
          </select>
          <select
            className="app-input"
            value={tenancy?.activeRestauranteId ?? ''}
            onChange={(e) => void switchContext({ restauranteId: e.target.value })}
          >
            {filteredBranches.map((b) => (
              <option key={b.restauranteId} value={b.restauranteId}>
                {b.restauranteNombre}
                {b.isActive ? ' (activa)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(membersLoading || membersData.length > 0) && (
        <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-950/55">
          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{membersTitle}</p>
          {membersLoading ? (
            <p className="mt-2 text-sm text-stone-500">Cargando miembros...</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-stone-700 dark:text-stone-300">
              {membersData.map((m, idx) => (
                <li key={String(m.id ?? idx)}>
                  {String(m.nombre ?? '')} {String(m.apellido ?? '')} · {String(m.email ?? '')}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
