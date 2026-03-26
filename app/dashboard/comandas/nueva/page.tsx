'use client'

import { useEffect, useState, useMemo } from 'react'
import { apiFetch } from '@/lib/auth-fetch'
import { useRouter, useSearchParams } from 'next/navigation'
import BackButton from '@/components/BackButton'
import toast from 'react-hot-toast'
import { MagnifyingGlassIcon, XMarkIcon, PlusIcon, MinusIcon } from '@heroicons/react/24/outline'

interface Modificador {
  id: string
  nombre: string
  tipo: string
  precioExtra: number
  activo: boolean
}

interface ModificadorProducto {
  id: string
  modificadorId: string
  modificador: Modificador
}

interface ModificadorCategoria {
  id: string
  modificadorId: string
  modificador: Modificador
}

interface ProductoTamano {
  id: string
  nombre: string
  precio: number
  orden: number
}

interface Producto {
  id: string
  nombre: string
  precio: number
  categoria?: {
    id: string
    nombre: string
    tipo: string
  }
  modificadores: ModificadorProducto[]
  tamanos?: ProductoTamano[]
}

interface Categoria {
  id: string
  nombre: string
  tipo: string
  productos: Producto[]
  modificadores: ModificadorCategoria[]
}

interface Mesa {
  id: string
  numero: number
}

interface ItemCarrito {
  key: string
  productoId: string
  producto: Producto
  tamanoId?: string
  tamanoDetalle?: ProductoTamano
  cantidad: number
  modificadoresIds: string[]
  modificadoresDetalle: Modificador[]
  notas?: string
}

// Extras del producto + categoría (sin TAMANO: tamaños son por producto)
function getExtrasDisponibles(producto: Producto, categoria: Categoria): Modificador[] {
  const vistos = new Set<string>()
  const extras: Modificador[] = []

  const agregar = (mod: Modificador) => {
    if (mod.activo && mod.tipo !== 'TAMANO' && !vistos.has(mod.id)) {
      vistos.add(mod.id)
      extras.push(mod)
    }
  }

  for (const mp of producto.modificadores) agregar(mp.modificador)
  for (const mc of categoria.modificadores) agregar(mc.modificador)

  return extras.sort((a, b) => a.nombre.localeCompare(b.nombre))
}

const TIPO_COLOR: Record<string, string> = {
  INGREDIENTE: 'bg-green-100 text-green-800 border-green-200',
  COCCION: 'bg-orange-100 text-orange-800 border-orange-200',
  TAMANO: 'bg-blue-100 text-blue-800 border-blue-200',
  EXTRAS: 'bg-purple-100 text-purple-800 border-purple-200',
}

const TIPO_LABEL: Record<string, string> = {
  INGREDIENTE: 'Ingrediente',
  COCCION: 'Cocción',
  TAMANO: 'Tamaño',
  EXTRAS: 'Extra',
}

export default function NuevaComandaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mesaIdParam = searchParams.get('mesaId')
  const comandaIdParam = searchParams.get('comandaId')

  const [mesas, setMesas] = useState<Mesa[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [mesaId, setMesaId] = useState(mesaIdParam || '')
  const [tipoPedido, setTipoPedido] = useState<'EN_MESA' | 'PARA_LLEVAR' | 'A_DOMICILIO' | 'WHATSAPP'>('EN_MESA')
  const [observaciones, setObservaciones] = useState('')
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  // Modal de extras (y tamaños si el producto los tiene)
  const [modalExtras, setModalExtras] = useState<{
    producto: Producto
    categoria: Categoria
    tamanoSeleccionadoId: string | null
    extrasSeleccionados: string[]
    notas: string
  } | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (comandaIdParam) {
          const comandaRes = await apiFetch(`/api/comandas/${comandaIdParam}`, {
            headers: {},
          })
          const comandaData = await comandaRes.json()
          if (comandaData.success && comandaData.data?.mesaId) {
            setMesaId(comandaData.data.mesaId)
          }
        }
        const [mesasRes, categoriasRes] = await Promise.all([
          apiFetch('/api/mesas', { headers: {} }),
          apiFetch('/api/categorias', { headers: {} }),
        ])
        const mesasData = await mesasRes.json()
        const categoriasData = await categoriasRes.json()
        if (mesasData.success) setMesas(mesasData.data)
        if (categoriasData.success) setCategorias(categoriasData.data)
      } catch {
        toast.error('Error al cargar datos')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [comandaIdParam])

  // Abrir modal al hacer clic en un producto
  const handleClickProducto = (producto: Producto, categoria: Categoria) => {
    const tieneTamanos = (producto.tamanos?.length ?? 0) > 0
    const extrasDisponibles = getExtrasDisponibles(producto, categoria)

    if (!tieneTamanos && extrasDisponibles.length === 0) {
      agregarAlCarrito(producto, categoria, null, [], '')
    } else {
      setModalExtras({
        producto,
        categoria,
        tamanoSeleccionadoId: tieneTamanos ? null : '',
        extrasSeleccionados: [],
        notas: '',
      })
    }
  }

  const toggleExtraEnModal = (modificadorId: string) => {
    if (!modalExtras) return
    const ya = modalExtras.extrasSeleccionados.includes(modificadorId)
    setModalExtras({
      ...modalExtras,
      extrasSeleccionados: ya
        ? modalExtras.extrasSeleccionados.filter((id) => id !== modificadorId)
        : [...modalExtras.extrasSeleccionados, modificadorId],
    })
  }

  const setTamanoEnModal = (tamanoId: string | null) => {
    if (!modalExtras) return
    setModalExtras({ ...modalExtras, tamanoSeleccionadoId: tamanoId })
  }

  const confirmarDesdeModal = () => {
    if (!modalExtras) return
    const tieneTamanos = (modalExtras.producto.tamanos?.length ?? 0) > 0
    if (tieneTamanos && !modalExtras.tamanoSeleccionadoId) {
      toast.error('Selecciona un tamaño')
      return
    }
    agregarAlCarrito(
      modalExtras.producto,
      modalExtras.categoria,
      modalExtras.tamanoSeleccionadoId || null,
      modalExtras.extrasSeleccionados,
      modalExtras.notas
    )
    setModalExtras(null)
  }

  const agregarAlCarrito = (
    producto: Producto,
    categoria: Categoria,
    tamanoId: string | null,
    modificadoresIds: string[],
    notas: string
  ) => {
    const tamanoDetalle = tamanoId
      ? producto.tamanos?.find((t) => t.id === tamanoId)
      : undefined

    // Reusar item si mismo producto, mismo tamaño, mismos extras (suma cantidad)
    const idsExtrasOrd = [...modificadoresIds].sort()
    const mismaCombo = (item: ItemCarrito) => {
      if (item.productoId !== producto.id || (item.tamanoId ?? null) !== (tamanoId ?? null)) return false
      const itemOrd = [...item.modificadoresIds].sort()
      return itemOrd.length === idsExtrasOrd.length && itemOrd.every((id, i) => id === idsExtrasOrd[i])
    }
    const existente = carrito.find(mismaCombo)
    if (existente && modificadoresIds.length === 0 && !tamanoId) {
      setCarrito(carrito.map((item) =>
        item.key === existente.key ? { ...item, cantidad: item.cantidad + 1 } : item
      ))
      return
    }
    if (existente) {
      setCarrito(carrito.map((item) =>
        item.key === existente.key ? { ...item, cantidad: item.cantidad + 1 } : item
      ))
      return
    }

    const allExtras = getExtrasDisponibles(producto, categoria)
    const detalle = modificadoresIds
      .map((id) => allExtras.find((e) => e.id === id))
      .filter(Boolean) as Modificador[]

    const key = `${producto.id}_${tamanoId ?? ''}_${modificadoresIds.slice().sort().join('_')}_${Date.now()}`

    setCarrito([
      ...carrito,
      {
        key,
        productoId: producto.id,
        producto,
        tamanoId: tamanoId || undefined,
        tamanoDetalle,
        cantidad: 1,
        modificadoresIds,
        modificadoresDetalle: detalle,
        notas,
      },
    ])
  }

  const actualizarCantidad = (key: string, cantidad: number) => {
    if (cantidad <= 0) {
      setCarrito(carrito.filter((item) => item.key !== key))
    } else {
      setCarrito(carrito.map((item) => item.key === key ? { ...item, cantidad } : item))
    }
  }

  const precioItem = (item: ItemCarrito) => {
    const precioBase = item.tamanoDetalle ? item.tamanoDetalle.precio : item.producto.precio
    const precioExtras = item.modificadoresDetalle.reduce((s, m) => s + (m.precioExtra || 0), 0)
    return (precioBase + precioExtras) * item.cantidad
  }

  const calcularTotal = () => carrito.reduce((sum, item) => sum + precioItem(item), 0)

  const productosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return null
    const termino = busqueda.toLowerCase().trim()
    const resultado: Array<{ producto: Producto; categoria: Categoria }> = []
    categorias.forEach((cat) => {
      cat.productos.forEach((prod) => {
        if (prod.nombre.toLowerCase().includes(termino) || cat.nombre.toLowerCase().includes(termino)) {
          resultado.push({ producto: prod, categoria: cat })
        }
      })
    })
    return resultado
  }, [busqueda, categorias])

  const handleGuardar = async () => {
    if (carrito.length === 0) {
      toast.error('Agrega al menos un producto')
      return
    }
    if (!comandaIdParam && tipoPedido === 'EN_MESA' && !mesaId) {
      toast.error('Selecciona una mesa')
      return
    }
    setGuardando(true)
    try {
      const itemsPayload = carrito.map((item) => ({
        productoId: item.productoId,
        tamanoId: item.tamanoId,
        cantidad: item.cantidad,
        modificadores: item.modificadoresIds,
        notas: item.notas,
      }))
      if (comandaIdParam) {
        const response = await apiFetch(`/api/comandas/${comandaIdParam}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsPayload }),
        })
        const data = await response.json()
        if (data.success) {
          toast.success('Pedidos agregados')
          router.push(`/dashboard/comandas/${data.data.numeroComanda}`)
        } else {
          toast.error(data.error || 'Error al agregar pedidos')
        }
      } else {
        const response = await apiFetch('/api/comandas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mesaId: mesaId || undefined,
            tipoPedido,
            items: itemsPayload,
            observaciones,
          }),
        })
        const data = await response.json()
        if (data.success) {
          toast.success('Comanda creada exitosamente')
          router.push(`/dashboard/comandas/${data.data.numeroComanda}`)
        } else {
          toast.error(data.error || 'Error al crear comanda')
        }
      }
    } catch {
      toast.error(comandaIdParam ? 'Error al agregar pedidos' : 'Error al crear comanda')
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return (
      <div className="app-loading-shell">
        <div className="app-card text-center">Cargando...</div>
      </div>
    )
  }

  const renderBotonProducto = (producto: Producto, categoria: Categoria) => {
    const extras = getExtrasDisponibles(producto, categoria)
    const tieneTamanos = (producto.tamanos?.length ?? 0) > 0
    const precioMin = tieneTamanos && producto.tamanos!.length
      ? Math.min(...producto.tamanos!.map((t) => t.precio))
      : producto.precio
    return (
      <button
        key={producto.id}
        onClick={() => handleClickProducto(producto, categoria)}
        className="p-3 border border-gray-300 rounded-md hover:bg-indigo-50 hover:border-indigo-300 text-left transition-colors group"
      >
        <div className="font-semibold text-gray-900 group-hover:text-indigo-900">{producto.nombre}</div>
        <div className="text-sm text-gray-600 mt-0.5">
          {tieneTamanos ? `Desde $${precioMin.toFixed(2)}` : `$${producto.precio.toFixed(2)}`}
        </div>
        {tieneTamanos && (
          <div className="text-xs text-blue-600 mt-1">
            {producto.tamanos!.length} tamaño{producto.tamanos!.length !== 1 ? 's' : ''}
          </div>
        )}
        {extras.length > 0 && (
          <div className="text-xs text-indigo-500 mt-0.5">
            {extras.length} extra{extras.length !== 1 ? 's' : ''} disponible{extras.length !== 1 ? 's' : ''}
          </div>
        )}
      </button>
    )
  }

  const esAgregarPedidos = !!comandaIdParam

  return (
    <div className="app-page">
      <BackButton className="mb-4" fallbackHref={esAgregarPedidos ? '/dashboard/mesas' : '/dashboard/comandas'} />
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          {esAgregarPedidos ? 'Agregar más pedidos' : 'Nueva Comanda'}
        </h1>
        {esAgregarPedidos && (
          <p className="text-gray-600 mt-1">Se agregarán los productos a la comanda actual</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── PANEL IZQUIERDO ───────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          {!esAgregarPedidos && (
            <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Pedido</label>
            <select
              value={tipoPedido}
              onChange={(e) => setTipoPedido(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-black"
            >
              <option value="EN_MESA">En Mesa</option>
              <option value="PARA_LLEVAR">Para Llevar</option>
              <option value="A_DOMICILIO">A Domicilio</option>
              <option value="WHATSAPP">WhatsApp</option>
            </select>
          </div>

          {tipoPedido === 'EN_MESA' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Mesa</label>
              <select
                value={mesaId}
                onChange={(e) => setMesaId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-black"
              >
                <option value="">Selecciona una mesa</option>
                {mesas.map((mesa) => (
                  <option key={mesa.id} value={mesa.id}>Mesa {mesa.numero}</option>
                ))}
              </select>
            </div>
          )}
            </>
          )}

          {/* Búsqueda */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar Producto</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre de producto o categoría..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-black"
              />
              {busqueda && (
                <button onClick={() => setBusqueda('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                  <span className="text-xl">×</span>
                </button>
              )}
            </div>
          </div>

          {/* Grid de productos */}
          <div className="space-y-6">
            {productosFiltrados !== null ? (
              productosFiltrados.length > 0 ? (
                <div className="app-card p-4">
                  <h2 className="text-xl font-bold mb-4">Resultados ({productosFiltrados.length})</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {productosFiltrados.map(({ producto, categoria }) =>
                      renderBotonProducto(producto, categoria)
                    )}
                  </div>
                </div>
              ) : (
                <div className="app-card p-8 text-center">
                  <p className="text-gray-500 text-lg">No se encontraron productos que coincidan con "{busqueda}"</p>
                  <button onClick={() => setBusqueda('')} className="mt-4 text-primary-600 hover:text-primary-800 underline">Limpiar búsqueda</button>
                </div>
              )
            ) : (
              categorias.map((categoria) => (
                <div key={categoria.id} className="app-card p-4">
                  <h2 className="text-xl font-bold mb-1">{categoria.nombre}</h2>
                  {categoria.modificadores.length > 0 && (
                    <p className="text-xs text-indigo-500 mb-3">
                      Extras de categoría: {categoria.modificadores.map((mc) => mc.modificador.nombre).join(', ')}
                    </p>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {categoria.productos.map((producto) => renderBotonProducto(producto, categoria))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── PANEL DERECHO - CARRITO ───────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="app-card sticky top-4 p-6">
            <h2 className="text-xl font-bold mb-4">Pedido</h2>

            {carrito.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Agrega productos al pedido</p>
            ) : (
              <div className="space-y-3 mb-4 max-h-[50vh] overflow-y-auto pr-1">
                {carrito.map((item) => (
                  <div key={item.key} className="border-b pb-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">
                          {item.producto.nombre}
                          {item.tamanoDetalle && (
                            <span className="font-normal text-gray-600"> — {item.tamanoDetalle.nombre}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          ${(item.tamanoDetalle ? item.tamanoDetalle.precio : item.producto.precio).toFixed(2)} c/u
                        </div>
                        {item.modificadoresDetalle.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.modificadoresDetalle.map((mod) => (
                              <span key={mod.id} className={`text-xs px-1.5 py-0.5 rounded-full border ${TIPO_COLOR[mod.tipo] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                {mod.nombre}{mod.precioExtra > 0 ? ` +$${mod.precioExtra.toFixed(2)}` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.notas && (
                          <div className="text-xs text-gray-400 italic mt-0.5">"{item.notas}"</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => actualizarCantidad(item.key, item.cantidad - 1)}
                          className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                        >
                          <MinusIcon className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-medium">{item.cantidad}</span>
                        <button
                          onClick={() => actualizarCantidad(item.key, item.cantidad + 1)}
                          className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                        >
                          <PlusIcon className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-right text-gray-700 mt-1">
                      ${precioItem(item).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-4 mb-4">
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>${calcularTotal().toFixed(2)}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Observaciones</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-black text-sm"
                rows={2}
                placeholder="Alergias, instrucciones generales..."
              />
            </div>

            <button
              onClick={handleGuardar}
              disabled={guardando || carrito.length === 0}
              className="w-full bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {guardando ? 'Guardando...' : esAgregarPedidos ? 'Agregar pedidos' : 'Crear Comanda'}
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL DE EXTRAS Y TAMAÑOS ───────────────────────────────────── */}
      {modalExtras && (() => {
        const { producto, tamanoSeleccionadoId } = modalExtras
        const tieneTamanos = (producto.tamanos?.length ?? 0) > 0
        const tamanoSeleccionado = tamanoSeleccionadoId
          ? producto.tamanos?.find((t) => t.id === tamanoSeleccionadoId)
          : null
        const extrasDisponibles = getExtrasDisponibles(producto, modalExtras.categoria)
        const precioExtras = modalExtras.extrasSeleccionados
          .map((id) => extrasDisponibles.find((e) => e.id === id)?.precioExtra || 0)
          .reduce((a, b) => a + b, 0)
        const precioBase = tamanoSeleccionado ? tamanoSeleccionado.precio : producto.precio
        const precioTotal = precioBase + precioExtras

        // Agrupar extras por tipo
        const porTipo: Record<string, Modificador[]> = {}
        for (const extra of extrasDisponibles) {
          if (!porTipo[extra.tipo]) porTipo[extra.tipo] = []
          porTipo[extra.tipo].push(extra)
        }

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-[28px] border border-gray-200 bg-white shadow-2xl">
              {/* Header */}
              <div className="flex items-start justify-between border-b p-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{modalExtras.producto.nombre}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{modalExtras.categoria.nombre}</p>
                </div>
                <button onClick={() => setModalExtras(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Contenido */}
              <div className="flex-1 overflow-y-auto p-5">
                <p className="text-sm font-medium text-gray-700 mb-3">Personaliza tu pedido</p>

                {/* Selector de tamaño (obligatorio si el producto tiene) */}
                {tieneTamanos && (
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Tamaño <span className="text-red-500">*</span>
                    </h3>
                    <div className="space-y-2">
                      {producto.tamanos!.map((t) => {
                        const sel = tamanoSeleccionadoId === t.id
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setTamanoEnModal(sel ? null : t.id)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors text-left ${
                              sel
                                ? 'bg-blue-50 border-blue-400 text-blue-900'
                                : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
                            }`}
                          >
                            <span className="text-sm font-medium">{t.nombre}</span>
                            <span className="text-sm text-gray-600">${t.precio.toFixed(2)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Extras */}
                <div className="space-y-4">
                  {Object.entries(porTipo).map(([tipo, extras]) => (
                    <div key={tipo}>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        {TIPO_LABEL[tipo] || tipo}
                      </h3>
                      <div className="space-y-2">
                        {extras.map((extra) => {
                          const seleccionado = modalExtras.extrasSeleccionados.includes(extra.id)
                          return (
                            <button
                              key={extra.id}
                              onClick={() => toggleExtraEnModal(extra.id)}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors text-left ${
                                seleccionado
                                  ? 'bg-indigo-50 border-indigo-400 text-indigo-900'
                                  : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${seleccionado ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                  {seleccionado && (
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <span className="text-sm font-medium">{extra.nombre}</span>
                              </div>
                              {extra.precioExtra > 0 && (
                                <span className="text-sm text-gray-500">+${extra.precioExtra.toFixed(2)}</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Notas */}
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Nota (opcional)</label>
                  <input
                    type="text"
                    value={modalExtras.notas}
                    onChange={(e) => setModalExtras({ ...modalExtras, notas: e.target.value })}
                    placeholder="Sin cebolla, bien cocido..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="rounded-b-[28px] border-t bg-gray-50 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-600">
                    Precio unitario:
                    {precioExtras > 0 && <span className="text-gray-400"> (incluye extras)</span>}
                  </span>
                  <span className="font-bold text-gray-900">${precioTotal.toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModalExtras(null)}
                    className="app-btn-secondary flex-1 rounded-2xl px-4 py-2 text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarDesdeModal}
                    disabled={tieneTamanos && !tamanoSeleccionadoId}
                    className="app-btn-primary flex-1 rounded-2xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Agregar al pedido
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
