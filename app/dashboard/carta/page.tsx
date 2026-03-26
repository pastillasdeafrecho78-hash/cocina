'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import BackButton from '@/components/BackButton'
import toast from 'react-hot-toast'
import { authFetch, apiFetch } from '@/lib/auth-fetch'
import {
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

interface ModificadorCategoria {
  id: string
  categoriaId: string
  modificadorId: string
  modificador: Modificador
}

interface Categoria {
  id: string
  nombre: string
  tipo: string
  descripcion?: string | null
  orden?: number
  activa?: boolean
  modificadores?: ModificadorCategoria[]
}

interface Modificador {
  id: string
  nombre: string
  tipo: 'INGREDIENTE' | 'COCCION' | 'TAMANO' | 'EXTRAS'
  precioExtra: number
  activo: boolean
}

interface ModificadorProducto {
  id: string
  productoId: string
  modificadorId: string
  modificador: Modificador
}

interface ProductoTamano {
  id: string
  productoId: string
  nombre: string
  precio: number
  orden: number
}

interface Producto {
  id: string
  nombre: string
  descripcion?: string | null
  precio: number
  categoriaId: string
  imagenUrl?: string | null
  activo: boolean
  listoPorDefault?: boolean
  categoria: Categoria
  modificadores: ModificadorProducto[]
  tamanos?: ProductoTamano[]
}

const TIPO_MODIFICADOR_LABEL: Record<string, string> = {
  INGREDIENTE: 'Ingrediente',
  COCCION: 'Cocción',
  TAMANO: 'Tamaño',
  EXTRAS: 'Extra',
}

const TIPO_MODIFICADOR_COLOR: Record<string, string> = {
  INGREDIENTE: 'bg-green-100 text-green-800',
  COCCION: 'bg-orange-100 text-orange-800',
  TAMANO: 'bg-blue-100 text-blue-800',
  EXTRAS: 'bg-purple-100 text-purple-800',
}

export default function CartaPage() {
  const router = useRouter()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [modificadores, setModificadores] = useState<Modificador[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    categoriaId: '',
    imagenUrl: '',
    listoPorDefault: false,
  })

  // Estados para gestión de categorías
  const [mostrarCategorias, setMostrarCategorias] = useState(false)
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState('')
  const [nuevaCategoriaTipo, setNuevaCategoriaTipo] = useState<'COMIDA' | 'BEBIDA' | 'POSTRE' | 'ENTRADA'>('COMIDA')
  const [creandoCategoria, setCreandoCategoria] = useState(false)
  const [editandoCategoria, setEditandoCategoria] = useState<Categoria | null>(null)
  const [formEditCategoria, setFormEditCategoria] = useState({
    nombre: '',
    descripcion: '',
    tipo: 'COMIDA' as 'COMIDA' | 'BEBIDA' | 'POSTRE' | 'ENTRADA',
    orden: 0,
  })

  // Estados para gestión de extras/modificadores
  const [mostrarExtras, setMostrarExtras] = useState(false)
  const [nuevoExtraNombre, setNuevoExtraNombre] = useState('')
  const [nuevoExtraTipo, setNuevoExtraTipo] = useState<'INGREDIENTE' | 'COCCION' | 'TAMANO' | 'EXTRAS'>('EXTRAS')
  const [nuevoExtraPrecio, setNuevoExtraPrecio] = useState('0')
  const [creandoExtra, setCreandoExtra] = useState(false)
  const [editandoExtra, setEditandoExtra] = useState<Modificador | null>(null)
  const [formEditExtra, setFormEditExtra] = useState({
    nombre: '',
    tipo: 'EXTRAS' as 'INGREDIENTE' | 'COCCION' | 'TAMANO' | 'EXTRAS',
    precioExtra: '0',
  })

  // Estado para el panel de extras por categoría
  const [categoriaConExtrasAbierta, setCategoriaConExtrasAbierta] = useState<string | null>(null)
  const [extraSeleccionadoParaCategoria, setExtraSeleccionadoParaCategoria] = useState<Record<string, string>>({})
  const [asignandoExtraCategoria, setAsignandoExtraCategoria] = useState<string | null>(null)

  // Estado para el panel de extras por producto
  const [productoConExtrasAbierto, setProductoConExtrasAbierto] = useState<string | null>(null)
  const [extraSeleccionadoParaAgregar, setExtraSeleccionadoParaAgregar] = useState<Record<string, string>>({})
  const [asignandoExtra, setAsignandoExtra] = useState<string | null>(null)

  // Tamaños por producto
  const [nuevoTamanoNombre, setNuevoTamanoNombre] = useState('')
  const [nuevoTamanoPrecio, setNuevoTamanoPrecio] = useState('')
  const [agregandoTamano, setAgregandoTamano] = useState<string | null>(null)

  // Estados para input de categoría con autocompletado en formulario de producto
  const [busquedaCategoria, setBusquedaCategoria] = useState('')
  const [mostrarSugerenciasProducto, setMostrarSugerenciasProducto] = useState(false)

  useEffect(() => {
    fetchCategorias()
    fetchProductos()
    fetchModificadores()
  }, [])

  const fetchCategorias = async () => {
    try {
      const response = await authFetch('/api/categorias')
      if (response.status === 401) return
      const data = await response.json()
      if (data.success) {
        setCategorias(data.data)
      } else {
        toast.error('Error al cargar categorías')
      }
    } catch {
      toast.error('Error al cargar categorías')
    }
  }

  const fetchProductos = async () => {
    try {
      const response = await authFetch('/api/productos')
      if (response.status === 401) return
      const data = await response.json()
      if (data.success) {
        setProductos(data.data)
      } else {
        toast.error('Error al cargar productos')
      }
    } catch {
      toast.error('Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }

  const fetchModificadores = async () => {
    try {
      const response = await authFetch('/api/modificadores')
      if (response.status === 401) return
      const data = await response.json()
      if (data.success) {
        setModificadores(data.data)
      }
    } catch {
      toast.error('Error al cargar extras')
    }
  }

  // Categoría seleccionada para el producto
  const categoriaSeleccionadaProducto = useMemo(() => {
    if (!formData.categoriaId) return null
    return categorias.find((cat) => cat.id === formData.categoriaId) || null
  }, [formData.categoriaId, categorias])

  // Sugerencias de categorías basadas en el texto ingresado (para crear nueva)
  const sugerenciasCategorias = useMemo(() => {
    if (!nuevaCategoriaNombre.trim()) return []
    const termino = nuevaCategoriaNombre.toLowerCase().trim()
    return categorias.filter((cat) => cat.nombre.toLowerCase().includes(termino))
  }, [nuevaCategoriaNombre, categorias])

  // Sugerencias para el input de categoría en el formulario de producto
  const sugerenciasCategoriaProducto = useMemo(() => {
    if (!busquedaCategoria.trim()) return categorias
    const termino = busquedaCategoria.toLowerCase().trim()
    return categorias.filter((cat) => cat.nombre.toLowerCase().includes(termino))
  }, [busquedaCategoria, categorias])

  // Sincronizar el input de categoría con la categoría seleccionada
  useEffect(() => {
    if (categoriaSeleccionadaProducto) {
      setBusquedaCategoria(categoriaSeleccionadaProducto.nombre)
    } else if (!formData.categoriaId) {
      setBusquedaCategoria('')
    }
  }, [categoriaSeleccionadaProducto, formData.categoriaId])

  // Crear nueva categoría
  const handleCrearCategoria = async () => {
    if (!nuevaCategoriaNombre.trim()) {
      toast.error('Ingresa un nombre para la categoría')
      return
    }

    const existe = categorias.find(
      (cat) => cat.nombre.toLowerCase() === nuevaCategoriaNombre.toLowerCase().trim()
    )
    if (existe) {
      toast.error('Ya existe una categoría con ese nombre')
      setNuevaCategoriaNombre('')
      return
    }

    setCreandoCategoria(true)
    try {
      const response = await apiFetch('/api/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevaCategoriaNombre.trim(), tipo: nuevaCategoriaTipo }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Categoría creada exitosamente')
        setNuevaCategoriaNombre('')
        fetchCategorias()
        if (formData.categoriaId === '') {
          setFormData({ ...formData, categoriaId: data.data.id })
        }
      } else {
        toast.error(data.error || 'Error al crear categoría')
      }
    } catch {
      toast.error('Error al crear categoría')
    } finally {
      setCreandoCategoria(false)
    }
  }

  const usarSugerencia = (categoria: Categoria) => {
    setNuevaCategoriaNombre('')
    setFormData({ ...formData, categoriaId: categoria.id })
  }

  const seleccionarCategoriaProducto = (categoria: Categoria) => {
    setFormData({ ...formData, categoriaId: categoria.id })
    setBusquedaCategoria(categoria.nombre)
    setMostrarSugerenciasProducto(false)
  }

  const crearCategoriaDesdeInput = async () => {
    if (!busquedaCategoria.trim()) {
      toast.error('Ingresa un nombre para la categoría')
      return
    }
    const existe = categorias.find(
      (cat) => cat.nombre.toLowerCase() === busquedaCategoria.toLowerCase().trim()
    )
    if (existe) {
      seleccionarCategoriaProducto(existe)
      return
    }
    setCreandoCategoria(true)
    try {
      const response = await apiFetch('/api/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: busquedaCategoria.trim(), tipo: nuevaCategoriaTipo }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Categoría creada exitosamente')
        fetchCategorias()
        setFormData({ ...formData, categoriaId: data.data.id })
        setBusquedaCategoria(data.data.nombre)
        setMostrarSugerenciasProducto(false)
      } else {
        toast.error(data.error || 'Error al crear categoría')
      }
    } catch {
      toast.error('Error al crear categoría')
    } finally {
      setCreandoCategoria(false)
    }
  }

  const iniciarEdicion = (categoria: Categoria) => {
    setEditandoCategoria(categoria)
    setFormEditCategoria({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || '',
      tipo: categoria.tipo as 'COMIDA' | 'BEBIDA' | 'POSTRE' | 'ENTRADA',
      orden: categoria.orden || 0,
    })
  }

  const handleGuardarEdicion = async () => {
    if (!editandoCategoria) return
    if (!formEditCategoria.nombre.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    try {
      const response = await apiFetch(`/api/categorias/${editandoCategoria.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formEditCategoria.nombre.trim(),
          descripcion: formEditCategoria.descripcion || undefined,
          tipo: formEditCategoria.tipo,
          orden: formEditCategoria.orden,
        }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Categoría actualizada exitosamente')
        setEditandoCategoria(null)
        fetchCategorias()
      } else {
        toast.error(data.error || 'Error al actualizar categoría')
      }
    } catch {
      toast.error('Error al actualizar categoría')
    }
  }

  const handleAsignarExtraCategoria = async (categoriaId: string) => {
    const modificadorId = extraSeleccionadoParaCategoria[categoriaId]
    if (!modificadorId) {
      toast.error('Selecciona un extra para agregar')
      return
    }
    setAsignandoExtraCategoria(categoriaId)
    try {
      const response = await apiFetch(`/api/categorias/${categoriaId}/modificadores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modificadorId }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Extra agregado a la categoría')
        setExtraSeleccionadoParaCategoria({ ...extraSeleccionadoParaCategoria, [categoriaId]: '' })
        fetchCategorias()
      } else {
        toast.error(data.error || 'Error al agregar extra')
      }
    } catch {
      toast.error('Error al agregar extra')
    } finally {
      setAsignandoExtraCategoria(null)
    }
  }

  const handleQuitarExtraCategoria = async (categoriaId: string, modificadorId: string) => {
    try {
      const response = await apiFetch(`/api/categorias/${categoriaId}/modificadores`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modificadorId }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Extra quitado de la categoría')
        fetchCategorias()
      } else {
        toast.error(data.error || 'Error al quitar extra')
      }
    } catch {
      toast.error('Error al quitar extra')
    }
  }

  const extrasDisponiblesParaCategoria = (categoria: Categoria) => {
    const asignados = new Set((categoria.modificadores || []).map((m) => m.modificadorId))
    return modificadores.filter((m) => m.activo && !asignados.has(m.id))
  }

  const handleToggleProductoActivo = async (producto: Producto) => {
    try {
      const response = await apiFetch(`/api/productos/${producto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !producto.activo }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success(producto.activo ? 'Producto desactivado' : 'Producto activado')
        fetchProductos()
      } else {
        toast.error(data.error || 'Error al actualizar producto')
      }
    } catch {
      toast.error('Error al actualizar producto')
    }
  }

  const handleToggleListoPorDefault = async (producto: Producto) => {
    try {
      const nuevoValor = !(producto.listoPorDefault ?? false)
      const response = await apiFetch(`/api/productos/${producto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listoPorDefault: nuevoValor }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success(nuevoValor ? 'Listo por default activado (Coca-Cola, etc.)' : 'Listo por default desactivado')
        fetchProductos()
      } else {
        toast.error(data.error || 'Error al actualizar')
      }
    } catch {
      toast.error('Error al actualizar')
    }
  }

  const handleEliminarCategoria = async (categoria: Categoria) => {
    if (!confirm(`¿Estás seguro de eliminar la categoría "${categoria.nombre}"?`)) return
    try {
      const response = await apiFetch(`/api/categorias/${categoria.id}`, {
        method: 'DELETE',
        headers: {},
      })
      const data = await response.json()
      if (data.success) {
        toast.success(data.message || 'Categoría eliminada exitosamente')
        fetchCategorias()
        if (formData.categoriaId === categoria.id) {
          setFormData({ ...formData, categoriaId: '' })
        }
      } else {
        toast.error(data.error || 'Error al eliminar categoría')
      }
    } catch {
      toast.error('Error al eliminar categoría')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nombre || !formData.precio || !formData.categoriaId) {
      toast.error('Completa todos los campos requeridos')
      return
    }
    const precio = parseFloat(formData.precio)
    if (isNaN(precio) || precio <= 0) {
      toast.error('El precio debe ser un número mayor a 0')
      return
    }
    setGuardando(true)
    try {
      const response = await apiFetch('/api/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formData.nombre,
          descripcion: formData.descripcion || undefined,
          precio,
          categoriaId: formData.categoriaId,
          imagenUrl: formData.imagenUrl || undefined,
          listoPorDefault: formData.listoPorDefault,
        }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Producto creado exitosamente')
        setFormData({ nombre: '', descripcion: '', precio: '', categoriaId: '', imagenUrl: '', listoPorDefault: false })
        setBusquedaCategoria('')
        setMostrarFormulario(false)
        fetchProductos()
      } else {
        toast.error(data.error || 'Error al crear producto')
      }
    } catch {
      toast.error('Error al crear producto')
    } finally {
      setGuardando(false)
    }
  }

  // ── EXTRAS ──────────────────────────────────────────────────────────────────

  const handleCrearExtra = async () => {
    if (!nuevoExtraNombre.trim()) {
      toast.error('Ingresa un nombre para el extra')
      return
    }
    setCreandoExtra(true)
    try {
      const response = await apiFetch('/api/modificadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nuevoExtraNombre.trim(),
          tipo: nuevoExtraTipo,
          precioExtra: parseFloat(nuevoExtraPrecio) || 0,
        }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Extra creado exitosamente')
        setNuevoExtraNombre('')
        setNuevoExtraPrecio('0')
        fetchModificadores()
      } else {
        toast.error(data.error || 'Error al crear extra')
      }
    } catch {
      toast.error('Error al crear extra')
    } finally {
      setCreandoExtra(false)
    }
  }

  const iniciarEdicionExtra = (modificador: Modificador) => {
    setEditandoExtra(modificador)
    setFormEditExtra({
      nombre: modificador.nombre,
      tipo: modificador.tipo,
      precioExtra: modificador.precioExtra.toString(),
    })
  }

  const handleGuardarEdicionExtra = async () => {
    if (!editandoExtra) return
    if (!formEditExtra.nombre.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    try {
      const response = await apiFetch(`/api/modificadores/${editandoExtra.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formEditExtra.nombre.trim(),
          tipo: formEditExtra.tipo,
          precioExtra: parseFloat(formEditExtra.precioExtra) || 0,
        }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Extra actualizado exitosamente')
        setEditandoExtra(null)
        fetchModificadores()
      } else {
        toast.error(data.error || 'Error al actualizar extra')
      }
    } catch {
      toast.error('Error al actualizar extra')
    }
  }

  const handleToggleExtraActivo = async (modificador: Modificador) => {
    try {
      const response = await apiFetch(`/api/modificadores/${modificador.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !modificador.activo }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success(modificador.activo ? 'Extra desactivado' : 'Extra activado')
        fetchModificadores()
      } else {
        toast.error(data.error || 'Error al actualizar extra')
      }
    } catch {
      toast.error('Error al actualizar extra')
    }
  }

  const handleEliminarExtra = async (modificador: Modificador) => {
    if (!confirm(`¿Estás seguro de eliminar el extra "${modificador.nombre}"?`)) return
    try {
      const response = await apiFetch(`/api/modificadores/${modificador.id}`, {
        method: 'DELETE',
        headers: {},
      })
      const data = await response.json()
      if (data.success) {
        toast.success(data.message || 'Extra eliminado exitosamente')
        fetchModificadores()
        fetchProductos()
      } else {
        toast.error(data.error || 'Error al eliminar extra')
      }
    } catch {
      toast.error('Error al eliminar extra')
    }
  }

  // ── ASIGNACIÓN DE EXTRAS A PRODUCTO ─────────────────────────────────────────

  const handleAsignarExtra = async (productoId: string) => {
    const modificadorId = extraSeleccionadoParaAgregar[productoId]
    if (!modificadorId) {
      toast.error('Selecciona un extra para agregar')
      return
    }
    setAsignandoExtra(productoId)
    try {
      const response = await apiFetch(`/api/productos/${productoId}/modificadores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modificadorId }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Extra agregado al producto')
        setExtraSeleccionadoParaAgregar({ ...extraSeleccionadoParaAgregar, [productoId]: '' })
        fetchProductos()
      } else {
        toast.error(data.error || 'Error al agregar extra')
      }
    } catch {
      toast.error('Error al agregar extra')
    } finally {
      setAsignandoExtra(null)
    }
  }

  const handleQuitarExtra = async (productoId: string, modificadorId: string) => {
    try {
      const response = await apiFetch(`/api/productos/${productoId}/modificadores`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modificadorId }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Extra quitado del producto')
        fetchProductos()
      } else {
        toast.error(data.error || 'Error al quitar extra')
      }
    } catch {
      toast.error('Error al quitar extra')
    }
  }

  // Extras activos que aún NO están asignados al producto (sin TAMANO: se usan tamaños por producto)
  const extrasDisponiblesParaProducto = (producto: Producto) => {
    const asignados = new Set(producto.modificadores.map((m) => m.modificadorId))
    return modificadores.filter((m) => m.activo && m.tipo !== 'TAMANO' && !asignados.has(m.id))
  }

  const handleAgregarTamano = async (productoId: string) => {
    if (!nuevoTamanoNombre.trim()) {
      toast.error('Ingresa el nombre del tamaño')
      return
    }
    const precio = parseFloat(nuevoTamanoPrecio)
    if (isNaN(precio) || precio < 0) {
      toast.error('El precio debe ser un número válido')
      return
    }
    setAgregandoTamano(productoId)
    try {
      const res = await apiFetch(`/api/productos/${productoId}/tamanos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevoTamanoNombre.trim(), precio, orden: 0 }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Tamaño agregado')
        setNuevoTamanoNombre('')
        setNuevoTamanoPrecio('')
        fetchProductos()
      } else {
        toast.error(data.error || 'Error al agregar tamaño')
      }
    } catch {
      toast.error('Error al agregar tamaño')
    } finally {
      setAgregandoTamano(null)
    }
  }

  const handleEliminarTamano = async (productoId: string, tamanoId: string) => {
    try {
      const res = await apiFetch(`/api/productos/${productoId}/tamanos/${tamanoId}`, {
        method: 'DELETE',
        headers: {},
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Tamaño eliminado')
        fetchProductos()
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch {
      toast.error('Error al eliminar tamaño')
    }
  }

  if (loading) {
    return (
      <div className="app-loading-shell">
        <div className="app-card text-center">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="app-page min-h-screen pb-20 sm:pb-8">
      <BackButton className="mb-4" />
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Gestión de Carta</h1>
          <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">Gestiona los productos del menú</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={() => setMostrarCategorias(!mostrarCategorias)}
            className="w-full min-h-[44px] rounded-2xl bg-gray-600 px-4 py-3 text-white hover:bg-gray-700 sm:min-h-0 sm:w-auto sm:py-2"
          >
            {mostrarCategorias ? 'Ocultar Categorías' : 'Gestionar Categorías'}
          </button>
          <button
            onClick={() => setMostrarExtras(!mostrarExtras)}
            className="w-full min-h-[44px] rounded-2xl bg-indigo-600 px-4 py-3 text-white hover:bg-indigo-700 sm:min-h-0 sm:w-auto sm:py-2"
          >
            {mostrarExtras ? 'Ocultar Extras' : 'Gestionar Extras'}
          </button>
          <button
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
            className="app-btn-primary w-full min-h-[44px] rounded-2xl px-4 py-3 sm:min-h-0 sm:w-auto sm:py-2"
          >
            {mostrarFormulario ? 'Cancelar' : '+ Crear Producto'}
          </button>
        </div>
      </div>

      {/* ── SECCIÓN CATEGORÍAS ─────────────────────────────────────────────── */}
      {mostrarCategorias && (
        <div className="app-card mb-6 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Gestión de Categorías</h2>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Crear Nueva Categoría</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Categoría</label>
                <div className="relative">
                  <input
                    type="text"
                    value={nuevaCategoriaNombre}
                    onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCrearCategoria() } }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-black"
                    placeholder="Escribe el nombre de la categoría..."
                  />
                  {sugerenciasCategorias.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {sugerenciasCategorias.map((cat) => (
                        <button key={cat.id} type="button" onClick={() => usarSugerencia(cat)} className="w-full text-left px-3 py-2 hover:bg-gray-100 text-black">
                          <div className="font-medium">{cat.nombre}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select value={nuevaCategoriaTipo} onChange={(e) => setNuevaCategoriaTipo(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-black">
                  <option value="COMIDA">Comida</option>
                  <option value="BEBIDA">Bebida</option>
                  <option value="POSTRE">Postre</option>
                  <option value="ENTRADA">Entrada</option>
                </select>
              </div>
            </div>
            <div className="mt-3">
              <button onClick={handleCrearCategoria} disabled={creandoCategoria || !nuevaCategoriaNombre.trim()} className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {creandoCategoria ? 'Creando...' : 'Crear Categoría'}
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Categorías Existentes</h3>
            {categorias.length > 0 ? (
              <div className="space-y-2">
                {categorias.map((categoria) =>
                  editandoCategoria?.id === categoria.id ? (
                    <div key={categoria.id} className="p-4 border border-blue-300 bg-blue-50 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                          <input type="text" value={formEditCategoria.nombre} onChange={(e) => setFormEditCategoria({ ...formEditCategoria, nombre: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-black" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                          <select value={formEditCategoria.tipo} onChange={(e) => setFormEditCategoria({ ...formEditCategoria, tipo: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-black">
                            <option value="COMIDA">Comida</option>
                            <option value="BEBIDA">Bebida</option>
                            <option value="POSTRE">Postre</option>
                            <option value="ENTRADA">Entrada</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
                          <input type="number" value={formEditCategoria.orden} onChange={(e) => setFormEditCategoria({ ...formEditCategoria, orden: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-black" />
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button onClick={handleGuardarEdicion} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">Guardar</button>
                        <button onClick={() => setEditandoCategoria(null)} className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div key={categoria.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between p-3 hover:bg-gray-50">
                        <div>
                          <div className="font-medium text-gray-900">{categoria.nombre}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-2">
                            <span>Orden: {categoria.orden || 0}</span>
                            {(categoria.modificadores?.length ?? 0) > 0 && (
                              <span className="text-indigo-600 font-medium">
                                · {categoria.modificadores!.length} extra{categoria.modificadores!.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCategoriaConExtrasAbierta(categoriaConExtrasAbierta === categoria.id ? null : categoria.id)}
                            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${categoriaConExtrasAbierta === categoria.id ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50'}`}
                            title="Gestionar extras de esta categoría"
                          >
                            <PlusIcon className="w-3.5 h-3.5" />
                            Extras ({categoria.modificadores?.length ?? 0})
                          </button>
                          <button onClick={() => iniciarEdicion(categoria)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-md" title="Editar"><PencilIcon className="w-5 h-5" /></button>
                          <button onClick={() => handleEliminarCategoria(categoria)} className="p-2 text-red-600 hover:bg-red-50 rounded-md" title="Eliminar"><TrashIcon className="w-5 h-5" /></button>
                        </div>
                      </div>

                      {/* Panel de extras de la categoría */}
                      {categoriaConExtrasAbierta === categoria.id && (
                        <div className="border-t border-indigo-100 bg-indigo-50 p-4">
                          <h4 className="text-sm font-semibold text-indigo-900 mb-1">
                            Extras predeterminados de "{categoria.nombre}"
                          </h4>
                          <p className="text-xs text-indigo-700 mb-3">
                            Estos extras aparecerán automáticamente al pedir cualquier producto de esta categoría.
                          </p>

                          {(categoria.modificadores?.length ?? 0) > 0 ? (
                            <div className="space-y-1 mb-3">
                              {categoria.modificadores!.map((mc) => (
                                <div key={mc.id} className="flex items-center justify-between bg-white rounded-md px-3 py-1.5 border border-indigo-100">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-1.5 py-0.5 text-xs rounded-full ${TIPO_MODIFICADOR_COLOR[mc.modificador.tipo]}`}>
                                      {TIPO_MODIFICADOR_LABEL[mc.modificador.tipo]}
                                    </span>
                                    <span className="text-sm text-gray-800">{mc.modificador.nombre}</span>
                                    {mc.modificador.precioExtra > 0 && (
                                      <span className="text-xs text-gray-500">+${mc.modificador.precioExtra.toFixed(2)}</span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleQuitarExtraCategoria(categoria.id, mc.modificadorId)}
                                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                                    title="Quitar extra"
                                  >
                                    <XMarkIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-indigo-600 mb-3">Esta categoría no tiene extras predeterminados.</p>
                          )}

                          {extrasDisponiblesParaCategoria(categoria).length > 0 ? (
                            <div className="flex gap-2">
                              <select
                                value={extraSeleccionadoParaCategoria[categoria.id] || ''}
                                onChange={(e) => setExtraSeleccionadoParaCategoria({ ...extraSeleccionadoParaCategoria, [categoria.id]: e.target.value })}
                                className="flex-1 px-2 py-1.5 text-sm border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black bg-white"
                              >
                                <option value="">Selecciona un extra...</option>
                                {extrasDisponiblesParaCategoria(categoria).map((mod) => (
                                  <option key={mod.id} value={mod.id}>
                                    {TIPO_MODIFICADOR_LABEL[mod.tipo]} — {mod.nombre}{mod.precioExtra > 0 ? ` (+$${mod.precioExtra.toFixed(2)})` : ''}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleAsignarExtraCategoria(categoria.id)}
                                disabled={!extraSeleccionadoParaCategoria[categoria.id] || asignandoExtraCategoria === categoria.id}
                                className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                              >
                                {asignandoExtraCategoria === categoria.id ? 'Agregando...' : 'Agregar'}
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">
                              {modificadores.filter((m) => m.activo).length === 0
                                ? 'Crea extras primero en la sección "Gestionar Extras".'
                                : 'Todos los extras disponibles ya están asignados.'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-gray-500">No hay categorías creadas</p>
            )}
          </div>
        </div>
      )}

      {/* ── SECCIÓN EXTRAS/MODIFICADORES ───────────────────────────────────── */}
      {mostrarExtras && (
        <div className="app-card mb-6 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Gestión de Extras</h2>
          <p className="text-sm text-gray-500 mb-4">
            Crea los extras disponibles (queso extra, término de cocción, tamaño, etc.) y luego asígnalos a cada producto desde las tarjetas de abajo.
          </p>

          {/* Formulario nuevo extra */}
          <div className="mb-6 p-4 bg-indigo-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Crear Nuevo Extra</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Extra</label>
                <input
                  type="text"
                  value={nuevoExtraNombre}
                  onChange={(e) => setNuevoExtraNombre(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCrearExtra() } }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black"
                  placeholder="Ej: Queso extra, Término medio..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={nuevoExtraTipo}
                  onChange={(e) => setNuevoExtraTipo(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black"
                >
                  <option value="EXTRAS">Extra</option>
                  <option value="INGREDIENTE">Ingrediente</option>
                  <option value="COCCION">Cocción</option>
                  <option value="TAMANO">Tamaño</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio extra ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={nuevoExtraPrecio}
                  onChange={(e) => setNuevoExtraPrecio(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="mt-3">
              <button
                onClick={handleCrearExtra}
                disabled={creandoExtra || !nuevoExtraNombre.trim()}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creandoExtra ? 'Creando...' : 'Crear Extra'}
              </button>
            </div>
          </div>

          {/* Lista de extras existentes */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Extras Existentes</h3>
            {modificadores.length > 0 ? (
              <div className="space-y-2">
                {modificadores.map((mod) =>
                  editandoExtra?.id === mod.id ? (
                    <div key={mod.id} className="p-4 border border-indigo-300 bg-indigo-50 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                          <input
                            type="text"
                            value={formEditExtra.nombre}
                            onChange={(e) => setFormEditExtra({ ...formEditExtra, nombre: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                          <select
                            value={formEditExtra.tipo}
                            onChange={(e) => setFormEditExtra({ ...formEditExtra, tipo: e.target.value as any })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black"
                          >
                            <option value="EXTRAS">Extra</option>
                            <option value="INGREDIENTE">Ingrediente</option>
                            <option value="COCCION">Cocción</option>
                            <option value="TAMANO">Tamaño</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Precio extra ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formEditExtra.precioExtra}
                            onChange={(e) => setFormEditExtra({ ...formEditExtra, precioExtra: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button onClick={handleGuardarEdicionExtra} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">Guardar</button>
                        <button onClick={() => setEditandoExtra(null)} className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div key={mod.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${TIPO_MODIFICADOR_COLOR[mod.tipo]}`}>
                          {TIPO_MODIFICADOR_LABEL[mod.tipo]}
                        </span>
                        <div>
                          <div className={`font-medium ${mod.activo ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{mod.nombre}</div>
                          {mod.precioExtra > 0 && (
                            <div className="text-sm text-gray-500">+${mod.precioExtra.toFixed(2)}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleToggleExtraActivo(mod)} className={`p-2 rounded-md ${mod.activo ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`} title={mod.activo ? 'Desactivar' : 'Activar'}>
                          {mod.activo ? <CheckCircleIcon className="w-5 h-5" /> : <XCircleIcon className="w-5 h-5" />}
                        </button>
                        <button onClick={() => iniciarEdicionExtra(mod)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-md" title="Editar">
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleEliminarExtra(mod)} className="p-2 text-red-600 hover:bg-red-50 rounded-md" title="Eliminar">
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-gray-500">No hay extras creados aún. Crea el primero arriba.</p>
            )}
          </div>
        </div>
      )}

      {/* ── FORMULARIO CREAR PRODUCTO ──────────────────────────────────────── */}
      {mostrarFormulario && (
        <div className="app-card mb-6 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Nuevo Producto</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Producto *</label>
                <input type="text" required value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-black" placeholder="Ej: Tacos al Pastor" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                <textarea value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-black" rows={3} placeholder="Descripción del producto..." />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={formData.precio}
                  onChange={(e) => {
                    let value = e.target.value
                    if (value.includes('.')) {
                      const parts = value.split('.')
                      if (parts[1] && parts[1].length > 2) {
                        value = parts[0] + '.' + parts[1].substring(0, 2)
                      }
                    }
                    setFormData({ ...formData, precio: value })
                  }}
                  onBlur={(e) => {
                    if (e.target.value && !isNaN(parseFloat(e.target.value))) {
                      setFormData({ ...formData, precio: parseFloat(e.target.value).toFixed(2) })
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-black"
                  placeholder="Ej: 80.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={busquedaCategoria}
                    onChange={(e) => {
                      setBusquedaCategoria(e.target.value)
                      setMostrarSugerenciasProducto(true)
                      const categoriaExacta = categorias.find((cat) => cat.nombre.toLowerCase() === e.target.value.toLowerCase().trim())
                      if (categoriaExacta) {
                        setFormData({ ...formData, categoriaId: categoriaExacta.id })
                      } else {
                        setFormData({ ...formData, categoriaId: '' })
                      }
                    }}
                    onFocus={() => setMostrarSugerenciasProducto(true)}
                    onBlur={() => { setTimeout(() => setMostrarSugerenciasProducto(false), 200) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (sugerenciasCategoriaProducto.length > 0 && !categoriaSeleccionadaProducto) {
                          seleccionarCategoriaProducto(sugerenciasCategoriaProducto[0])
                        } else if (!categoriaSeleccionadaProducto && busquedaCategoria.trim()) {
                          crearCategoriaDesdeInput()
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-black"
                    placeholder="Escribe o selecciona una categoría..."
                  />
                  {mostrarSugerenciasProducto && sugerenciasCategoriaProducto.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {sugerenciasCategoriaProducto.map((cat) => (
                        <button key={cat.id} type="button" onClick={() => seleccionarCategoriaProducto(cat)} className="w-full text-left px-3 py-2 hover:bg-gray-100 text-black">
                          <div className="font-medium">{cat.nombre}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {busquedaCategoria.trim() && !categoriaSeleccionadaProducto && sugerenciasCategoriaProducto.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3">
                      <p className="text-sm text-gray-600 mb-2">No se encontró "{busquedaCategoria}". Presiona Enter para crear una nueva categoría.</p>
                      <div className="mb-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de categoría</label>
                        <select value={nuevaCategoriaTipo} onChange={(e) => setNuevaCategoriaTipo(e.target.value as any)} className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md text-black">
                          <option value="COMIDA">Comida</option>
                          <option value="BEBIDA">Bebida</option>
                          <option value="POSTRE">Postre</option>
                          <option value="ENTRADA">Entrada</option>
                        </select>
                      </div>
                      <button type="button" onClick={crearCategoriaDesdeInput} disabled={creandoCategoria} className="w-full bg-primary-600 text-white px-3 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50 text-sm">
                        {creandoCategoria ? 'Creando...' : `Crear "${busquedaCategoria.trim()}"`}
                      </button>
                    </div>
                  )}
                </div>
                {categoriaSeleccionadaProducto && (
                  <p className="text-xs text-green-600 mt-1">✓ Categoría seleccionada: {categoriaSeleccionadaProducto.nombre}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">URL de Imagen (opcional)</label>
                <input type="url" value={formData.imagenUrl} onChange={(e) => setFormData({ ...formData, imagenUrl: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-black" placeholder="https://ejemplo.com/imagen.jpg" />
              </div>

              <div className="md:col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="listoPorDefault"
                  checked={formData.listoPorDefault}
                  onChange={(e) => setFormData({ ...formData, listoPorDefault: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="listoPorDefault" className="text-sm font-medium text-gray-700">
                  Listo por default (ej. Coca-Cola, aguas): entra en comanda ya como listo para entregar
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={guardando} className="bg-primary-600 text-white px-6 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {guardando ? 'Guardando...' : 'Crear Producto'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── LISTA DE PRODUCTOS ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">Productos de la Carta</h2>
        <p className="text-xs sm:text-sm text-gray-500 mb-4">
          Haz clic en <strong>Tamaños y extras</strong> en cada producto para agregar tamaños con precios (ej: Chico $80, Grande $120).
        </p>
        {productos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {productos.map((producto) => {
              const extrasDisponibles = extrasDisponiblesParaProducto(producto)
              const panelAbierto = productoConExtrasAbierto === producto.id

              return (
                <div
                  key={producto.id}
                  className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Imagen */}
                  {producto.imagenUrl && (
                    <img src={producto.imagenUrl} alt={producto.nombre} className="w-full h-32 object-cover" />
                  )}

                  {/* Info principal */}
                  <div className="p-4">
                    <div className="mb-2">
                      <h3 className="font-semibold text-gray-900">{producto.nombre}</h3>
                      <p className="text-sm text-gray-500">{producto.categoria.nombre}</p>
                    </div>
                    {producto.descripcion && (
                      <p className="text-sm text-gray-600 mb-2">{producto.descripcion}</p>
                    )}

                    {/* Badges de tamaños (por producto) */}
                    {(producto.tamanos?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {producto.tamanos!.map((t) => (
                          <span key={t.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                            {t.nombre} ${t.precio.toFixed(2)}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Badges de extras asignados */}
                    {producto.modificadores.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {producto.modificadores.map((mp) => (
                          <span
                            key={mp.id}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${TIPO_MODIFICADOR_COLOR[mp.modificador.tipo]}`}
                          >
                            {mp.modificador.nombre}
                            {mp.modificador.precioExtra > 0 && ` +$${mp.modificador.precioExtra.toFixed(2)}`}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Acciones */}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-3">
                      <span className="text-lg font-bold text-primary-600">
                        ${producto.precio.toFixed(2)}
                      </span>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => setProductoConExtrasAbierto(panelAbierto ? null : producto.id)}
                          className={`flex items-center justify-center gap-1 px-4 py-3 sm:py-1.5 rounded text-sm font-medium transition-colors border min-h-[44px] sm:min-h-0 ${
                            panelAbierto
                              ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                              : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50'
                          }`}
                          title="Gestionar tamaños y extras"
                        >
                          <PlusIcon className="w-3.5 h-3.5" />
                          Tamaños y extras
                          {(producto.tamanos?.length ?? 0) > 0 && (
                            <span className="text-blue-600">({producto.tamanos!.length} tamaño{(producto.tamanos!.length ?? 0) !== 1 ? 's' : ''})</span>
                          )}
                          {producto.modificadores.length > 0 && (
                            <span className="text-gray-500">· {producto.modificadores.length} extra{producto.modificadores.length !== 1 ? 's' : ''}</span>
                          )}
                        </button>
                        <button
                          onClick={() => handleToggleListoPorDefault(producto)}
                          className={`flex items-center justify-center gap-1 px-4 py-3 sm:py-1.5 rounded text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                            producto.listoPorDefault
                              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                          title={producto.listoPorDefault ? 'Quitar listo por default' : 'Marcar como listo por default (ej. Coca-Cola)'}
                        >
                          {producto.listoPorDefault ? (
                            <><CheckCircleIcon className="w-4 h-4" />Listo default</>
                          ) : (
                            <>Listo default</>
                          )}
                        </button>
                        <button
                          onClick={() => handleToggleProductoActivo(producto)}
                          className={`flex items-center justify-center gap-1 px-4 py-3 sm:py-1.5 rounded text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                            producto.activo
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                          title={producto.activo ? 'Desactivar producto' : 'Activar producto'}
                        >
                          {producto.activo ? (
                            <><CheckCircleIcon className="w-4 h-4" />Activo</>
                          ) : (
                            <><XCircleIcon className="w-4 h-4" />Inactivo</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Panel de extras y tamaños del producto */}
                  {panelAbierto && (
                    <div className="border-t border-indigo-100 bg-indigo-50 p-4 space-y-4 pb-6 sm:pb-4">
                      {/* Tamaños por producto */}
                      <div>
                        <h4 className="text-sm font-semibold text-indigo-900 mb-2">
                          Tamaños (cada uno con su precio)
                        </h4>
                        <p className="text-xs text-indigo-700 mb-2">
                          Ej: Chico $80, Mediano $100, Grande $120. Solo para este producto.
                        </p>
                        {(producto.tamanos?.length ?? 0) > 0 && (
                          <div className="space-y-1 mb-2">
                            {producto.tamanos!.map((t) => (
                              <div key={t.id} className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-blue-100">
                                <span className="text-sm text-gray-800">{t.nombre}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-blue-700">${t.precio.toFixed(2)}</span>
                                  <button
                                    onClick={() => handleEliminarTamano(producto.id, t.id)}
                                    className="p-2 -m-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:p-1 flex items-center justify-center"
                                    title="Eliminar tamaño"
                                  >
                                    <XMarkIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={productoConExtrasAbierto === producto.id ? nuevoTamanoNombre : ''}
                            onChange={(e) => setNuevoTamanoNombre(e.target.value)}
                            placeholder="Ej: Chico, Grande"
                            className="flex-1 px-3 py-3 sm:py-1.5 text-base sm:text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black min-h-[44px] sm:min-h-0"
                          />
                          <div className="flex gap-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={productoConExtrasAbierto === producto.id ? nuevoTamanoPrecio : ''}
                              onChange={(e) => setNuevoTamanoPrecio(e.target.value)}
                              placeholder="Precio"
                              className="w-full sm:w-24 px-3 py-3 sm:py-1.5 text-base sm:text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black min-h-[44px] sm:min-h-0"
                            />
                            <button
                              onClick={() => handleAgregarTamano(producto.id)}
                              disabled={!nuevoTamanoNombre.trim() || agregandoTamano === producto.id}
                              className="px-4 py-3 sm:py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0 whitespace-nowrap flex-1 sm:flex-none"
                            >
                              {agregandoTamano === producto.id ? '…' : 'Agregar'}
                            </button>
                          </div>
                        </div>
                      </div>

                      <hr className="border-indigo-200" />

                      <h4 className="text-sm font-semibold text-indigo-900 mb-2">Extras (ingredientes, cocción, etc.)</h4>

                      {/* Extras ya asignados */}
                      {producto.modificadores.length > 0 ? (
                        <div className="space-y-1 mb-3">
                          {producto.modificadores.map((mp) => (
                            <div key={mp.id} className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-indigo-100">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className={`px-1.5 py-0.5 text-xs rounded-full shrink-0 ${TIPO_MODIFICADOR_COLOR[mp.modificador.tipo]}`}>
                                  {TIPO_MODIFICADOR_LABEL[mp.modificador.tipo]}
                                </span>
                                <span className="text-sm text-gray-800 truncate">{mp.modificador.nombre}</span>
                                {mp.modificador.precioExtra > 0 && (
                                  <span className="text-xs text-gray-500 shrink-0">+${mp.modificador.precioExtra.toFixed(2)}</span>
                                )}
                              </div>
                              <button
                                onClick={() => handleQuitarExtra(producto.id, mp.modificadorId)}
                                className="p-2 -m-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:p-1 flex items-center justify-center shrink-0"
                                title="Quitar extra"
                              >
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-indigo-600 mb-3">Este producto no tiene extras asignados.</p>
                      )}

                      {/* Agregar nuevo extra */}
                      {extrasDisponibles.length > 0 ? (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            value={extraSeleccionadoParaAgregar[producto.id] || ''}
                            onChange={(e) => setExtraSeleccionadoParaAgregar({ ...extraSeleccionadoParaAgregar, [producto.id]: e.target.value })}
                            className="flex-1 px-3 py-3 sm:py-1.5 text-base sm:text-sm border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black bg-white min-h-[44px] sm:min-h-0"
                          >
                            <option value="">Selecciona un extra...</option>
                            {extrasDisponibles.map((mod) => (
                              <option key={mod.id} value={mod.id}>
                                {TIPO_MODIFICADOR_LABEL[mod.tipo]} — {mod.nombre}{mod.precioExtra > 0 ? ` (+$${mod.precioExtra.toFixed(2)})` : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleAsignarExtra(producto.id)}
                            disabled={!extraSeleccionadoParaAgregar[producto.id] || asignandoExtra === producto.id}
                            className="w-full sm:w-auto px-4 py-3 sm:py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap min-h-[44px] sm:min-h-0"
                          >
                            {asignandoExtra === producto.id ? 'Agregando...' : 'Agregar extra'}
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">
                          {modificadores.filter((m) => m.activo).length === 0
                            ? 'Crea extras primero en la sección "Gestionar Extras".'
                            : 'Todos los extras disponibles ya están asignados.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-500">No hay productos en la carta aún.</p>
        )}
      </div>
    </div>
  )
}
