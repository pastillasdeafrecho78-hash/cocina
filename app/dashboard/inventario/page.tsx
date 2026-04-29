'use client'

import { useEffect, useMemo, useState } from 'react'
import BackButton from '@/components/BackButton'
import { apiFetch, authFetch } from '@/lib/auth-fetch'
import toast from 'react-hot-toast'

const INVENTARIO_MVP =
  process.env.NEXT_PUBLIC_INVENTARIO_MVP === '1' ||
  process.env.NEXT_PUBLIC_INVENTARIO_MVP === 'true'

type InventarioArticulo = {
  id: string
  nombre: string
  unidad: string
  sku?: string | null
  categoria?: string | null
  stockActual: number
  stockMinimo: number
  fechaCaducidad?: string | null
  activo: boolean
  alertas?: {
    bajoStock: boolean
    caducado: boolean
    caducaPronto: boolean
    diasParaCaducar: number | null
  }
}

type InventarioMovimiento = {
  id: string
  tipo: 'ENTRADA' | 'AJUSTE_ABSOLUTO'
  cantidad: number
  stockAntes: number
  stockDespues: number
  proveedor?: string | null
  referencia?: string | null
  createdAt: string
  articulo: { nombre: string; unidad: string }
}

export default function InventarioPage() {
  const [articulos, setArticulos] = useState<InventarioArticulo[]>([])
  const [movimientos, setMovimientos] = useState<InventarioMovimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [guardandoArticulo, setGuardandoArticulo] = useState(false)
  const [guardandoMovimiento, setGuardandoMovimiento] = useState(false)
  const [articuloForm, setArticuloForm] = useState({
    nombre: '',
    unidad: 'pieza',
    categoria: '',
    sku: '',
    stockActual: '0',
    stockMinimo: '0',
    fechaCaducidad: '',
  })
  const [movimientoForm, setMovimientoForm] = useState({
    articuloId: '',
    tipo: 'ENTRADA' as 'ENTRADA' | 'AJUSTE_ABSOLUTO',
    cantidad: '',
    stockFinal: '',
    proveedor: '',
    referencia: '',
    notas: '',
    fechaCaducidad: '',
  })

  const alertas = useMemo(
    () =>
      articulos.filter(
        (articulo) =>
          articulo.activo &&
          (articulo.alertas?.bajoStock ||
            articulo.alertas?.caducado ||
            articulo.alertas?.caducaPronto)
      ),
    [articulos]
  )

  useEffect(() => {
    if (!INVENTARIO_MVP) {
      setLoading(false)
      return
    }
    void Promise.all([fetchArticulos(), fetchMovimientos()]).finally(() => setLoading(false))
  }, [])

  const fetchArticulos = async () => {
    const res = await authFetch('/api/inventario/articulos?activo=true')
    if (res.status === 401 || res.status === 403) return
    const data = await res.json()
    if (data.success) setArticulos(data.data)
  }

  const fetchMovimientos = async () => {
    const res = await authFetch('/api/inventario/movimientos')
    if (res.status === 401 || res.status === 403) return
    const data = await res.json()
    if (data.success) setMovimientos(data.data)
  }

  const crearArticulo = async (event: React.FormEvent) => {
    event.preventDefault()
    setGuardandoArticulo(true)
    try {
      const res = await apiFetch('/api/inventario/articulos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: articuloForm.nombre,
          unidad: articuloForm.unidad,
          categoria: articuloForm.categoria || undefined,
          sku: articuloForm.sku || undefined,
          stockActual: Number(articuloForm.stockActual || 0),
          stockMinimo: Number(articuloForm.stockMinimo || 0),
          fechaCaducidad: articuloForm.fechaCaducidad
            ? new Date(`${articuloForm.fechaCaducidad}T00:00:00`).toISOString()
            : undefined,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || 'No se pudo crear el artículo')
        return
      }
      toast.success('Artículo creado')
      setArticuloForm({
        nombre: '',
        unidad: 'pieza',
        categoria: '',
        sku: '',
        stockActual: '0',
        stockMinimo: '0',
        fechaCaducidad: '',
      })
      await fetchArticulos()
    } catch {
      toast.error('No se pudo crear el artículo')
    } finally {
      setGuardandoArticulo(false)
    }
  }

  const registrarMovimiento = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!movimientoForm.articuloId) {
      toast.error('Selecciona un artículo')
      return
    }
    setGuardandoMovimiento(true)
    try {
      const res = await apiFetch('/api/inventario/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articuloId: movimientoForm.articuloId,
          tipo: movimientoForm.tipo,
          ...(movimientoForm.tipo === 'ENTRADA'
            ? { cantidad: Number(movimientoForm.cantidad) }
            : { stockFinal: Number(movimientoForm.stockFinal) }),
          proveedor: movimientoForm.proveedor || undefined,
          referencia: movimientoForm.referencia || undefined,
          notas: movimientoForm.notas || undefined,
          fechaCaducidad: movimientoForm.fechaCaducidad
            ? new Date(`${movimientoForm.fechaCaducidad}T00:00:00`).toISOString()
            : undefined,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || 'No se pudo registrar el movimiento')
        return
      }
      toast.success('Movimiento registrado')
      setMovimientoForm({
        articuloId: '',
        tipo: 'ENTRADA',
        cantidad: '',
        stockFinal: '',
        proveedor: '',
        referencia: '',
        notas: '',
        fechaCaducidad: '',
      })
      await Promise.all([fetchArticulos(), fetchMovimientos()])
    } catch {
      toast.error('No se pudo registrar el movimiento')
    } finally {
      setGuardandoMovimiento(false)
    }
  }

  if (!INVENTARIO_MVP) {
    return (
      <div className="app-page min-h-screen pb-8">
        <BackButton className="mb-4" />
        <div className="app-card p-6">
          <p className="app-kicker">Inventario</p>
          <h1 className="mt-2 text-2xl font-semibold text-stone-900">Inventario desactivado</h1>
          <p className="mt-2 text-stone-600">
            Activa `NEXT_PUBLIC_INVENTARIO_MVP=1` y redeploy en Vercel para mostrar este módulo.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="app-loading-shell">
        <div className="app-card text-center">Cargando inventario...</div>
      </div>
    )
  }

  return (
    <div className="app-page min-h-screen pb-20 sm:pb-8">
      <BackButton className="mb-4" />
      <div className="app-card mb-6 p-6">
        <p className="app-kicker">Inventario MVP</p>
        <h1 className="mt-2 text-2xl font-semibold text-stone-900 sm:text-3xl">
          Inventario manual
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-stone-600">
          Controla artículos, compras/entradas y ajustes absolutos. Este módulo no descuenta ventas automáticamente.
        </p>
      </div>

      {alertas.length > 0 && (
        <div className="app-card mb-6 border-amber-200 bg-amber-50 p-4">
          <h2 className="text-lg font-semibold text-amber-950">Alertas</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {alertas.map((articulo) => (
              <div key={articulo.id} className="rounded-xl border border-amber-200 bg-white p-3 text-sm text-amber-950">
                <strong>{articulo.nombre}</strong>
                <span className="ml-2">
                  {articulo.alertas?.bajoStock && `Bajo stock (${articulo.stockActual} ${articulo.unidad})`}
                  {articulo.alertas?.caducado && ' · Caducado'}
                  {articulo.alertas?.caducaPronto && ` · Caduca en ${articulo.alertas.diasParaCaducar} día(s)`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={crearArticulo} className="app-card p-6">
          <h2 className="text-xl font-semibold text-stone-900">Crear artículo</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input className="app-input app-field" required placeholder="Nombre" value={articuloForm.nombre} onChange={(e) => setArticuloForm({ ...articuloForm, nombre: e.target.value })} />
            <input className="app-input app-field" required placeholder="Unidad (kg, litro, pieza)" value={articuloForm.unidad} onChange={(e) => setArticuloForm({ ...articuloForm, unidad: e.target.value })} />
            <input className="app-input app-field" placeholder="Categoría" value={articuloForm.categoria} onChange={(e) => setArticuloForm({ ...articuloForm, categoria: e.target.value })} />
            <input className="app-input app-field" placeholder="SKU opcional" value={articuloForm.sku} onChange={(e) => setArticuloForm({ ...articuloForm, sku: e.target.value })} />
            <input className="app-input app-field" type="number" min="0" step="0.01" placeholder="Stock actual" value={articuloForm.stockActual} onChange={(e) => setArticuloForm({ ...articuloForm, stockActual: e.target.value })} />
            <input className="app-input app-field" type="number" min="0" step="0.01" placeholder="Stock mínimo" value={articuloForm.stockMinimo} onChange={(e) => setArticuloForm({ ...articuloForm, stockMinimo: e.target.value })} />
            <label className="text-sm text-stone-700 sm:col-span-2">
              Caducidad opcional
              <input className="app-input app-field mt-1 w-full" type="date" value={articuloForm.fechaCaducidad} onChange={(e) => setArticuloForm({ ...articuloForm, fechaCaducidad: e.target.value })} />
            </label>
          </div>
          <button className="app-btn-primary mt-4 rounded-xl px-4 py-2 disabled:opacity-60" disabled={guardandoArticulo}>
            {guardandoArticulo ? 'Guardando...' : 'Crear artículo'}
          </button>
        </form>

        <form onSubmit={registrarMovimiento} className="app-card p-6">
          <h2 className="text-xl font-semibold text-stone-900">Registrar compra o ajuste</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select className="app-input app-field sm:col-span-2" required value={movimientoForm.articuloId} onChange={(e) => setMovimientoForm({ ...movimientoForm, articuloId: e.target.value })}>
              <option value="">Selecciona artículo...</option>
              {articulos.map((articulo) => (
                <option key={articulo.id} value={articulo.id}>
                  {articulo.nombre} ({articulo.stockActual} {articulo.unidad})
                </option>
              ))}
            </select>
            <select className="app-input app-field" value={movimientoForm.tipo} onChange={(e) => setMovimientoForm({ ...movimientoForm, tipo: e.target.value as 'ENTRADA' | 'AJUSTE_ABSOLUTO' })}>
              <option value="ENTRADA">Compra / entrada</option>
              <option value="AJUSTE_ABSOLUTO">Ajuste absoluto</option>
            </select>
            {movimientoForm.tipo === 'ENTRADA' ? (
              <input className="app-input app-field" type="number" min="0.01" step="0.01" required placeholder="Cantidad recibida" value={movimientoForm.cantidad} onChange={(e) => setMovimientoForm({ ...movimientoForm, cantidad: e.target.value })} />
            ) : (
              <input className="app-input app-field" type="number" min="0" step="0.01" required placeholder="Stock final real" value={movimientoForm.stockFinal} onChange={(e) => setMovimientoForm({ ...movimientoForm, stockFinal: e.target.value })} />
            )}
            <input className="app-input app-field" placeholder="Proveedor" value={movimientoForm.proveedor} onChange={(e) => setMovimientoForm({ ...movimientoForm, proveedor: e.target.value })} />
            <input className="app-input app-field" placeholder="Referencia/factura" value={movimientoForm.referencia} onChange={(e) => setMovimientoForm({ ...movimientoForm, referencia: e.target.value })} />
            <input className="app-input app-field sm:col-span-2" placeholder="Notas" value={movimientoForm.notas} onChange={(e) => setMovimientoForm({ ...movimientoForm, notas: e.target.value })} />
            <label className="text-sm text-stone-700 sm:col-span-2">
              Actualizar caducidad opcional
              <input className="app-input app-field mt-1 w-full" type="date" value={movimientoForm.fechaCaducidad} onChange={(e) => setMovimientoForm({ ...movimientoForm, fechaCaducidad: e.target.value })} />
            </label>
          </div>
          <button className="app-btn-primary mt-4 rounded-xl px-4 py-2 disabled:opacity-60" disabled={guardandoMovimiento}>
            {guardandoMovimiento ? 'Registrando...' : 'Registrar movimiento'}
          </button>
        </form>
      </div>

      <div className="app-card mt-6 p-6">
        <h2 className="text-xl font-semibold text-stone-900">Artículos</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-stone-500">
              <tr>
                <th className="py-2 pr-4">Artículo</th>
                <th className="py-2 pr-4">Stock</th>
                <th className="py-2 pr-4">Mínimo</th>
                <th className="py-2 pr-4">Caducidad</th>
                <th className="py-2 pr-4">Estado</th>
              </tr>
            </thead>
            <tbody>
              {articulos.map((articulo) => (
                <tr key={articulo.id} className="border-b border-stone-100">
                  <td className="py-3 pr-4 font-medium text-stone-900">
                    {articulo.nombre}
                    {articulo.categoria && <span className="ml-2 text-xs text-stone-500">{articulo.categoria}</span>}
                  </td>
                  <td className="py-3 pr-4">{articulo.stockActual} {articulo.unidad}</td>
                  <td className="py-3 pr-4">{articulo.stockMinimo} {articulo.unidad}</td>
                  <td className="py-3 pr-4">
                    {articulo.fechaCaducidad ? new Date(articulo.fechaCaducidad).toLocaleDateString('es-MX') : 'Sin fecha'}
                  </td>
                  <td className="py-3 pr-4">
                    {articulo.alertas?.caducado ? 'Caducado' : articulo.alertas?.bajoStock ? 'Bajo stock' : articulo.alertas?.caducaPronto ? 'Caduca pronto' : 'OK'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="app-card mt-6 p-6">
        <h2 className="text-xl font-semibold text-stone-900">Últimos movimientos</h2>
        <div className="mt-4 space-y-2">
          {movimientos.map((mov) => (
            <div key={mov.id} className="rounded-xl border border-stone-200 p-3 text-sm">
              <div className="font-medium text-stone-900">
                {mov.articulo.nombre} · {mov.tipo === 'ENTRADA' ? 'Entrada' : 'Ajuste absoluto'}
              </div>
              <div className="mt-1 text-stone-600">
                {mov.stockAntes} → {mov.stockDespues} {mov.articulo.unidad}
                {mov.proveedor && ` · ${mov.proveedor}`}
                {mov.referencia && ` · ${mov.referencia}`}
              </div>
            </div>
          ))}
          {movimientos.length === 0 && <p className="text-sm text-stone-500">Sin movimientos todavía.</p>}
        </div>
      </div>
    </div>
  )
}
