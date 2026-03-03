'use client'

import { useEffect, useState, useMemo } from 'react'
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
  // Clave única: productoId + JSON de modificadores seleccionados (para permitir mismo producto con distintos extras)
  key: string
  productoId: string
  producto: Producto
  cantidad: number
  modificadoresIds: string[]
  modificadoresDetalle: Modificador[]
  notas?: string
}

// Junta extras del producto + extras de su categoría (sin duplicados, solo activos)
function getExtrasDisponibles(producto: Producto, categoria: Categoria): Modificador[] {
  const vistos = new Set<string>()
  const extras: Modificador[] = []

  const agregar = (mod: Modificador) => {
    if (mod.activo && !vistos.has(mod.id)) {
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

  const [mesas, setMesas] = useState<Mesa[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [mesaId, setMesaId] = useState(mesaIdParam || '')
  const [tipoPedido, setTipoPedido] = useState<'EN_MESA' | 'PARA_LLEVAR' | 'A_DOMICILIO' | 'WHATSAPP'>('EN_MESA')
  const [observaciones, setObservaciones] = useState('')
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  // Modal de extras
  const [modalExtras, setModalExtras] = useState<{
    producto: Producto
    categoria: Categoria
    extrasSeleccionados: string[]
    notas: string
  } | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token')
        const [mesasRes, categoriasRes] = await Promise.all([
          fetch('/api/mesas', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/categorias', { headers: { Authorization: `Bearer ${token}` } }),
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
  }, [])

  // Abrir modal de extras al hacer clic en un producto
  const handleClickProducto = (producto: Producto, categoria: Categoria) => {
    const extrasDisponibles = getExtrasDisponibles(producto, categoria)

    if (extrasDisponibles.length === 0) {
      agregarAlCarrito(producto, categoria, [], '')
    } else {
      setModalExtras({ producto, categoria, extrasSeleccionados: [], notas: '' })
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

  const confirmarDesdeModal = () => {
    if (!modalExtras) return
    agregarAlCarrito(
      modalExtras.producto,
      modalExtras.categoria,
      modalExtras.extrasSeleccionados,
      modalExtras.notas
    )
    setModalExtras(null)
  }

  const agregarAlCarrito = (
    producto: Producto,
    categoria: Categoria,
    modificadoresIds: string[],
    notas: string
  ) => {
    // Si no tiene extras, reusar el item existente del mismo producto (suma cantidad)
    if (modificadoresIds.length === 0) {
      const existente = carrito.find(
        (item) => item.productoId === producto.id && item.modificadoresIds.length === 0
      )
      if (existente) {
        setCarrito(carrito.map((item) =>
          item.key === existente.key ? { ...item, cantidad: item.cantidad + 1 } : item
        ))
        return
      }
    }

    const allExtras = getExtrasDisponibles(producto, categoria)
    const detalle = modificadoresIds
      .map((id) => allExtras.find((e) => e.id === id))
      .filter(Boolean) as Modificador[]

    const key = `${producto.id}_${modificadoresIds.slice().sort().join('_')}_${Date.now()}`

    setCarrito([
      ...carrito,
      { key, productoId: producto.id, producto, cantidad: 1, modificadoresIds, modificadoresDetalle: detalle, notas },
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
    const precioExtras = item.modificadoresDetalle.reduce((s, m) => s + (m.precioExtra || 0), 0)
    return (item.producto.precio + precioExtras) * item.cantidad
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
    if (tipoPedido === 'EN_MESA' && !mesaId) {
      toast.error('Selecciona una mesa')
      return
    }
    setGuardando(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/comandas', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesaId: mesaId || undefined,
          tipoPedido,
          items: carrito.map((item) => ({
            productoId: item.productoId,
            cantidad: item.cantidad,
            modificadores: item.modificadoresIds,
            notas: item.notas,
          })),
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
    } catch {
      toast.error('Error al crear comanda')
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Cargando...</div>
  }

  const renderBotonProducto = (producto: Producto, categoria: Categoria) => {
    const extras = getExtrasDisponibles(producto, categoria)
    return (
      <button
        key={producto.id}
        onClick={() => handleClickProducto(producto, categoria)}
        className="p-3 border border-gray-300 rounded-md hover:bg-indigo-50 hover:border-indigo-300 text-left transition-colors group"
      >
        <div className="font-semibold text-gray-900 group-hover:text-indigo-900">{producto.nombre}</div>
        <div className="text-sm text-gray-600 mt-0.5">${producto.precio.toFixed(2)}</div>
        {extras.length > 0 && (
          <div className="text-xs text-indigo-500 mt-1">
            {extras.length} extra{extras.length !== 1 ? 's' : ''} disponible{extras.length !== 1 ? 's' : ''}
          </div>
        )}
      </button>
    )
  }

  return (
    <div className="p-8 text-black">
      <BackButton className="mb-4" />
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Nueva Comanda</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── PANEL IZQUIERDO ───────────────────────────────────────────── */}
        <div className="lg:col-span-2">
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
                <div className="bg-white rounded-lg shadow p-4">
                  <h2 className="text-xl font-bold mb-4">Resultados ({productosFiltrados.length})</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {productosFiltrados.map(({ producto, categoria }) =>
                      renderBotonProducto(producto, categoria)
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <p className="text-gray-500 text-lg">No se encontraron productos que coincidan con "{busqueda}"</p>
                  <button onClick={() => setBusqueda('')} className="mt-4 text-primary-600 hover:text-primary-800 underline">Limpiar búsqueda</button>
                </div>
              )
            ) : (
              categorias.map((categoria) => (
                <div key={categoria.id} className="bg-white rounded-lg shadow p-4">
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
          <div className="bg-white rounded-lg shadow p-6 sticky top-4">
            <h2 className="text-xl font-bold mb-4">Pedido</h2>

            {carrito.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Agrega productos al pedido</p>
            ) : (
              <div className="space-y-3 mb-4 max-h-[50vh] overflow-y-auto pr-1">
                {carrito.map((item) => (
                  <div key={item.key} className="border-b pb-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{item.producto.nombre}</div>
                        <div className="text-xs text-gray-500">${item.producto.precio.toFixed(2)} c/u</div>
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
              {guardando ? 'Guardando...' : 'Crear Comanda'}
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL DE EXTRAS ────────────────────────────────────────────── */}
      {modalExtras && (() => {
        const extrasDisponibles = getExtrasDisponibles(modalExtras.producto, modalExtras.categoria)
        const precioExtras = modalExtras.extrasSeleccionados
          .map((id) => extrasDisponibles.find((e) => e.id === id)?.precioExtra || 0)
          .reduce((a, b) => a + b, 0)
        const precioTotal = modalExtras.producto.precio + precioExtras

        // Agrupar extras por tipo
        const porTipo: Record<string, Modificador[]> = {}
        for (const extra of extrasDisponibles) {
          if (!porTipo[extra.tipo]) porTipo[extra.tipo] = []
          porTipo[extra.tipo].push(extra)
        }

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between p-5 border-b">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{modalExtras.producto.nombre}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{modalExtras.categoria.nombre}</p>
                </div>
                <button onClick={() => setModalExtras(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Extras */}
              <div className="overflow-y-auto flex-1 p-5">
                <p className="text-sm font-medium text-gray-700 mb-3">Personaliza tu pedido</p>
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
              <div className="p-5 border-t bg-gray-50 rounded-b-xl">
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
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarDesdeModal}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
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
