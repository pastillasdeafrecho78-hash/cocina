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
type AccessCode = {
  id: string
  expiraEn: string
  usadaEn: string | null
  createdAt: string
  estado: 'ACTIVA' | 'USADA' | 'EXPIRADA'
  rol?: { id: string; nombre: string } | null
  organizacion?: { id: string; nombre: string } | null
}

export default function TenantIdentitySection() {
  const [tenancy, setTenancy] = useState<TenancyPayload | null>(null)
  const [me, setMe] = useState<any>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [status, setStatus] = useState('')
  const [switching, setSwitching] = useState(false)
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [membersData, setMembersData] = useState<Array<Record<string, unknown>>>([])
  const [membersTitle, setMembersTitle] = useState('')
  const [membersLoading, setMembersLoading] = useState(false)
  const [codes, setCodes] = useState<AccessCode[]>([])
  const [generatedCode, setGeneratedCode] = useState<{ code: string; redeemUrl: string } | null>(null)
  const [codeExpiryMins, setCodeExpiryMins] = useState(120)
  const [codeRoleId, setCodeRoleId] = useState('')
  const [codeOrgId, setCodeOrgId] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [newOrgName, setNewOrgName] = useState('')
  const [editingOrgName, setEditingOrgName] = useState('')
  const [savingBranch, setSavingBranch] = useState(false)
  const [savingOrg, setSavingOrg] = useState(false)
  const [providerLoading, setProviderLoading] = useState<string | null>(null)

  const canManageUsers = useMemo(() => tienePermiso(me, 'usuarios_roles'), [me])
  const canManageConfig = useMemo(() => tienePermiso(me, 'configuracion'), [me])

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
        setCodeOrgId(
          tenancyData.data.activeOrganizacionId ??
            tenancyData.data.current?.organizacionId ??
            ''
        )
      }
    }
    void load()
  }, [])

  useEffect(() => {
    if (!canManageUsers && !canManageConfig) return
    const loadRoles = async () => {
      const res = await fetch('/api/roles', { credentials: 'same-origin' })
      const data = (await res.json()) as { success?: boolean; data?: Role[] }
      if (data.success && Array.isArray(data.data)) {
        setRoles(data.data)
        setCodeRoleId(data.data[0]?.id ?? '')
      }
    }
    void loadRoles()
  }, [canManageConfig, canManageUsers])

  useEffect(() => {
    if (!canManageUsers) return
    const loadCodes = async () => {
      const res = await fetch('/api/auth/access-codes', { credentials: 'same-origin', cache: 'no-store' })
      const data = (await res.json()) as { success?: boolean; data?: AccessCode[] }
      if (data.success && Array.isArray(data.data)) {
        setCodes(data.data)
      }
    }
    void loadCodes()
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
      setStatus(error instanceof Error ? error.message : 'Error al cambiar contexto')
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
      setStatus(error instanceof Error ? error.message : 'No se pudo cargar miembros')
    } finally {
      setMembersLoading(false)
    }
  }

  const createCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenancy?.activeRestauranteId) {
      setStatus('Debes tener una sucursal activa para generar códigos')
      return
    }
    setCodeLoading(true)
    setStatus('')
    setGeneratedCode(null)
    try {
      const res = await fetch('/api/auth/access-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          expiraEnMinutos: codeExpiryMins,
          rolId: codeRoleId || undefined,
          organizacionId: codeOrgId || undefined,
        }),
      })
      const data = (await res.json()) as {
        success?: boolean
        error?: string
        data?: { codigo: string; redeemUrl: string }
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'No se pudo generar código')
      }
      setStatus('Código generado correctamente')
      setGeneratedCode({ code: data.data?.codigo ?? '', redeemUrl: data.data?.redeemUrl ?? '' })
      const listRes = await fetch('/api/auth/access-codes', { credentials: 'same-origin', cache: 'no-store' })
      const listData = (await listRes.json()) as { success?: boolean; data?: AccessCode[] }
      if (listData.success && Array.isArray(listData.data)) setCodes(listData.data)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error al crear código')
    } finally {
      setCodeLoading(false)
    }
  }

  const createBranch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBranchName.trim()) return
    setSavingBranch(true)
    setStatus('')
    try {
      const res = await fetch('/api/auth/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          nombre: newBranchName.trim(),
          organizacionId: selectedOrgId || undefined,
        }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'No se pudo crear sucursal')
      setStatus('Sucursal creada')
      setNewBranchName('')
      await refreshTenancy()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error creando sucursal')
    } finally {
      setSavingBranch(false)
    }
  }

  const createOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOrgName.trim()) return
    setSavingOrg(true)
    setStatus('')
    try {
      const res = await fetch('/api/auth/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ nombre: newOrgName.trim() }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string; data?: { id: string } }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'No se pudo crear organización')
      setStatus('Organización creada')
      setNewOrgName('')
      await refreshTenancy()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error creando organización')
    } finally {
      setSavingOrg(false)
    }
  }

  const updateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrgId || !editingOrgName.trim()) return
    setSavingOrg(true)
    setStatus('')
    try {
      const res = await fetch('/api/auth/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          organizacionId: selectedOrgId,
          nombre: editingOrgName.trim(),
        }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'No se pudo actualizar organización')
      setStatus('Organización actualizada')
      await refreshTenancy()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error actualizando organización')
    } finally {
      setSavingOrg(false)
    }
  }

  useEffect(() => {
    const currentOrg = tenancy?.organizations.find((o) => o.organizacionId === selectedOrgId)
    setEditingOrgName(currentOrg?.organizacionNombre ?? '')
  }, [selectedOrgId, tenancy?.organizations])

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
            Códigos de acceso (one-time)
          </p>
          <form className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={createCode}>
            <input
              className="app-input"
              type="number"
              min={5}
              max={10080}
              value={codeExpiryMins}
              onChange={(e) => setCodeExpiryMins(Number(e.target.value))}
              placeholder="Minutos de expiración"
            />
            <select
              className="app-input"
              value={codeRoleId}
              onChange={(e) => setCodeRoleId(e.target.value)}
            >
              <option value="">Sin rol automático</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
            <select
              className="app-input"
              value={codeOrgId}
              onChange={(e) => setCodeOrgId(e.target.value)}
            >
              <option value="">Sin organización automática</option>
              {(tenancy?.organizations ?? []).map((org) => (
                <option key={org.organizacionId} value={org.organizacionId}>
                  {org.organizacionNombre}
                </option>
              ))}
            </select>
            <button type="submit" disabled={codeLoading} className="app-btn-primary">
              {codeLoading ? 'Generando...' : 'Generar código'}
            </button>
          </form>
          {generatedCode && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-white p-3 text-xs text-amber-900">
              <p>
                Código: <strong>{generatedCode.code}</strong>
              </p>
              <p className="mt-1 break-all">Link: {generatedCode.redeemUrl}</p>
              <img
                className="mt-2 h-28 w-28 rounded border border-amber-200 bg-white p-1"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(generatedCode.code)}`}
                alt="QR del código"
              />
            </div>
          )}
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-900 dark:text-amber-100">
              Códigos recientes
            </p>
            <ul className="mt-2 space-y-1 text-xs text-amber-900 dark:text-amber-100">
              {codes.slice(0, 8).map((c) => (
                <li key={c.id}>
                  {c.estado} · {c.rol?.nombre ?? 'sin rol'} · expira{' '}
                  {new Date(c.expiraEn).toLocaleString('es-MX')}
                </li>
              ))}
              {codes.length === 0 && <li>Sin códigos aún.</li>}
            </ul>
          </div>
        </div>
      )}

      {canManageConfig && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/35 dark:bg-emerald-950/45">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              Alta de sucursal
            </p>
            <form className="mt-3 space-y-2" onSubmit={createBranch}>
              <input
                className="app-input"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="Nombre de la nueva sucursal"
              />
              <button type="submit" disabled={savingBranch} className="app-btn-primary">
                {savingBranch ? 'Creando...' : 'Crear sucursal'}
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-500/35 dark:bg-violet-950/45">
            <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">
              Gestión de organización
            </p>
            <form className="mt-3 space-y-2" onSubmit={createOrganization}>
              <input
                className="app-input"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Crear nueva organización"
              />
              <button type="submit" disabled={savingOrg} className="app-btn-secondary">
                {savingOrg ? 'Guardando...' : 'Crear organización'}
              </button>
            </form>
            <form className="mt-3 space-y-2" onSubmit={updateOrganization}>
              <input
                className="app-input"
                value={editingOrgName}
                onChange={(e) => setEditingOrgName(e.target.value)}
                placeholder="Nombre de organización activa"
                disabled={!selectedOrgId}
              />
              <button type="submit" disabled={savingOrg || !selectedOrgId} className="app-btn-primary">
                Actualizar organización activa
              </button>
            </form>
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

      {status && (
        <div className="rounded-lg border border-stone-200 bg-white p-3 text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-950/55 dark:text-stone-200">
          {status}
        </div>
      )}

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
