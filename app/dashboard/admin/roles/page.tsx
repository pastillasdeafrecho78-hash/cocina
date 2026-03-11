'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BackButton from '@/components/BackButton'
import toast from 'react-hot-toast'
import { tienePermiso } from '@/lib/permisos'
import { MODULOS } from '@/lib/permisos'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  UserGroupIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

const MODULO_LABELS: Record<string, string> = {
  mesas: 'Mesas',
  comandas: 'Comandas',
  carta: 'Carta',
  cocina: 'Cocina',
  barra: 'Barra',
  reportes: 'Reportes',
  caja: 'Caja',
  configuracion: 'Configuración',
  usuarios_roles: 'Usuarios y roles',
}

interface Rol {
  id: string
  nombre: string
  codigo?: string | null
  descripcion?: string | null
  permisos: string[]
  numUsuarios: number
  createdAt?: string
  updatedAt?: string
}

interface Usuario {
  id: string
  email: string
  nombre: string
  apellido: string
  activo: boolean
  rolId: string
  rol: { id: string; nombre: string; codigo?: string | null }
  createdAt?: string
  ultimoAcceso?: string | null
}

type Tab = 'roles' | 'usuarios'

export default function AdminRolesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState<Tab>('roles')
  const [loading, setLoading] = useState(true)

  const [roles, setRoles] = useState<Rol[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargandoRoles, setCargandoRoles] = useState(false)
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false)

  const [modalRol, setModalRol] = useState<'crear' | 'editar' | null>(null)
  const [rolEdicion, setRolEdicion] = useState<Rol | null>(null)
  const [formRol, setFormRol] = useState({
    nombre: '',
    codigo: '',
    descripcion: '',
    permisos: [] as string[],
  })
  const [guardandoRol, setGuardandoRol] = useState(false)

  const [modalUsuario, setModalUsuario] = useState<'crear' | 'editar' | null>(null)
  const [usuarioEdicion, setUsuarioEdicion] = useState<Usuario | null>(null)
  const [formUsuario, setFormUsuario] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    rolId: '',
    activo: true,
  })
  const [guardandoUsuario, setGuardandoUsuario] = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (!userStr) {
      router.push('/login')
      return
    }
    const u = JSON.parse(userStr)
    setUser(u)
    if (!tienePermiso(u, 'usuarios_roles')) {
      router.push('/dashboard')
      return
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    if (tab === 'roles' && user) cargarRoles()
    if (tab === 'usuarios' && user) cargarUsuarios()
  }, [tab, user])

  const cargarRoles = async () => {
    setCargandoRoles(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/roles', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401 || res.status === 403) {
        router.push('/dashboard')
        return
      }
      const data = await res.json()
      if (data.success) setRoles(data.data)
    } catch (e) {
      toast.error('Error al cargar roles')
    } finally {
      setCargandoRoles(false)
    }
  }

  const cargarUsuarios = async () => {
    setCargandoUsuarios(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/usuarios', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401 || res.status === 403) {
        router.push('/dashboard')
        return
      }
      const data = await res.json()
      if (data.success) setUsuarios(data.data)
    } catch (e) {
      toast.error('Error al cargar usuarios')
    } finally {
      setCargandoUsuarios(false)
    }
  }

  const abrirCrearRol = () => {
    setRolEdicion(null)
    setFormRol({
      nombre: '',
      codigo: '',
      descripcion: '',
      permisos: [],
    })
    setModalRol('crear')
  }

  const abrirEditarRol = (r: Rol) => {
    setRolEdicion(r)
    setFormRol({
      nombre: r.nombre,
      codigo: r.codigo || '',
      descripcion: r.descripcion || '',
      permisos: [...r.permisos],
    })
    setModalRol('editar')
  }

  const togglePermiso = (mod: string) => {
    setFormRol((prev) => ({
      ...prev,
      permisos: prev.permisos.includes(mod)
        ? prev.permisos.filter((p) => p !== mod)
        : [...prev.permisos, mod],
    }))
  }

  const guardarRol = async () => {
    if (!formRol.nombre.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    if (formRol.permisos.length === 0) {
      toast.error('Debe seleccionar al menos un permiso')
      return
    }
    setGuardandoRol(true)
    try {
      const token = localStorage.getItem('token')
      const url = modalRol === 'editar' && rolEdicion
        ? `/api/roles/${rolEdicion.id}`
        : '/api/roles'
      const method = modalRol === 'editar' ? 'PATCH' : 'POST'
      const body =
        modalRol === 'editar'
          ? {
              nombre: formRol.nombre.trim(),
              codigo: formRol.codigo.trim() || null,
              descripcion: formRol.descripcion.trim() || null,
              permisos: formRol.permisos,
            }
          : {
              nombre: formRol.nombre.trim(),
              codigo: formRol.codigo.trim() || null,
              descripcion: formRol.descripcion.trim() || null,
              permisos: formRol.permisos,
            }
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || 'Error al guardar')
        return
      }
      toast.success(modalRol === 'editar' ? 'Rol actualizado' : 'Rol creado')
      setModalRol(null)
      cargarRoles()
    } catch (e) {
      toast.error('Error al guardar rol')
    } finally {
      setGuardandoRol(false)
    }
  }

  const eliminarRol = async (r: Rol) => {
    if (r.numUsuarios > 0) {
      toast.error(`Reasigna los ${r.numUsuarios} usuario(s) antes de eliminar`)
      return
    }
    if (!confirm(`¿Eliminar rol "${r.nombre}"?`)) return
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/roles/${r.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || 'Error al eliminar')
        return
      }
      toast.success('Rol eliminado')
      cargarRoles()
    } catch (e) {
      toast.error('Error al eliminar rol')
    }
  }

  const abrirCrearUsuario = () => {
    setUsuarioEdicion(null)
    setFormUsuario({
      nombre: '',
      apellido: '',
      email: '',
      password: '',
      rolId: roles[0]?.id || '',
      activo: true,
    })
    setModalUsuario('crear')
  }

  const abrirEditarUsuario = (u: Usuario) => {
    setUsuarioEdicion(u)
    setFormUsuario({
      nombre: u.nombre,
      apellido: u.apellido,
      email: u.email,
      password: '',
      rolId: u.rolId,
      activo: u.activo,
    })
    setModalUsuario('editar')
  }

  const guardarUsuario = async () => {
    if (!formUsuario.nombre.trim() || !formUsuario.apellido.trim()) {
      toast.error('Nombre y apellido son requeridos')
      return
    }
    if (!formUsuario.email.trim()) {
      toast.error('El email es requerido')
      return
    }
    if (modalUsuario === 'crear' && !formUsuario.password) {
      toast.error('La contraseña es requerida')
      return
    }
    if (formUsuario.password && formUsuario.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (!formUsuario.rolId) {
      toast.error('El rol es requerido')
      return
    }
    setGuardandoUsuario(true)
    try {
      const token = localStorage.getItem('token')
      const url =
        modalUsuario === 'editar' && usuarioEdicion
          ? `/api/usuarios/${usuarioEdicion.id}`
          : '/api/usuarios'
      const method = modalUsuario === 'editar' ? 'PATCH' : 'POST'
      const body: Record<string, unknown> = {
        nombre: formUsuario.nombre.trim(),
        apellido: formUsuario.apellido.trim(),
        email: formUsuario.email.trim(),
        rolId: formUsuario.rolId,
      }
      if (modalUsuario === 'crear') {
        body.password = formUsuario.password
      } else if (formUsuario.password) {
        body.password = formUsuario.password
      }
      if (modalUsuario === 'editar') {
        body.activo = formUsuario.activo
      }
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || 'Error al guardar')
        return
      }
      toast.success(
        modalUsuario === 'editar' ? 'Usuario actualizado' : 'Usuario creado'
      )
      setModalUsuario(null)
      cargarUsuarios()
    } catch (e) {
      toast.error('Error al guardar usuario')
    } finally {
      setGuardandoUsuario(false)
    }
  }

  const desactivarUsuario = async (u: Usuario) => {
    if (!confirm(`¿Desactivar a ${u.nombre} ${u.apellido}?`)) return
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/usuarios/${u.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || 'Error al desactivar')
        return
      }
      toast.success('Usuario desactivado')
      cargarUsuarios()
    } catch (e) {
      toast.error('Error al desactivar usuario')
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="p-8 text-gray-900">
      <div className="mb-6 flex items-center justify-between">
        <BackButton fallbackHref="/dashboard" />
        <h1 className="text-2xl font-semibold">Roles y Usuarios</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab('roles')}
          className={`px-4 py-2 font-medium border-b-2 -mb-px ${
            tab === 'roles'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <UserGroupIcon className="w-5 h-5" />
            Roles
          </span>
        </button>
        <button
          onClick={() => setTab('usuarios')}
          className={`px-4 py-2 font-medium border-b-2 -mb-px ${
            tab === 'usuarios'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5" />
            Usuarios
          </span>
        </button>
      </div>

      {/* Tab Roles */}
      {tab === 'roles' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={abrirCrearRol}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <PlusIcon className="w-5 h-5" />
              Nuevo rol
            </button>
          </div>
          {cargandoRoles ? (
            <div className="text-gray-500">Cargando roles...</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roles.map((r) => (
                <div
                  key={r.id}
                  className="bg-white rounded-lg shadow p-6 border border-gray-200"
                >
                  <h3 className="font-semibold text-lg">{r.nombre}</h3>
                  {r.descripcion && (
                    <p className="text-sm text-gray-500 mt-1">{r.descripcion}</p>
                  )}
                  <p className="text-sm text-gray-600 mt-2">
                    {r.numUsuarios} usuario(s)
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => abrirEditarRol(r)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 rounded hover:bg-gray-200"
                    >
                      <PencilIcon className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={() => eliminarRol(r)}
                      disabled={r.numUsuarios > 0}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <TrashIcon className="w-4 h-4" />
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Usuarios */}
      {tab === 'usuarios' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={abrirCrearUsuario}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <PlusIcon className="w-5 h-5" />
              Nuevo usuario
            </button>
          </div>
          {cargandoUsuarios ? (
            <div className="text-gray-500">Cargando usuarios...</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Rol
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {usuarios.map((u) => (
                    <tr key={u.id} className={!u.activo ? 'bg-gray-50 opacity-75' : ''}>
                      <td className="px-4 py-3 text-sm">
                        {u.nombre} {u.apellido}
                      </td>
                      <td className="px-4 py-3 text-sm">{u.email}</td>
                      <td className="px-4 py-3 text-sm">{u.rol.nombre}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            u.activo ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => abrirEditarUsuario(u)}
                          className="mr-2 text-blue-600 hover:text-blue-800"
                        >
                          Editar
                        </button>
                        {u.activo && (
                          <button
                            onClick={() => desactivarUsuario(u)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Desactivar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Rol */}
      {modalRol && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold">
                {modalRol === 'crear' ? 'Nuevo rol' : 'Editar rol'}
              </h2>
              <button
                onClick={() => setModalRol(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={formRol.nombre}
                  onChange={(e) =>
                    setFormRol((p) => ({ ...p, nombre: e.target.value }))
                  }
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Ej. Supervisor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código (opcional)
                </label>
                <input
                  type="text"
                  value={formRol.codigo}
                  onChange={(e) =>
                    setFormRol((p) => ({ ...p, codigo: e.target.value }))
                  }
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Ej. SUPERVISOR"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción (opcional)
                </label>
                <input
                  type="text"
                  value={formRol.descripcion}
                  onChange={(e) =>
                    setFormRol((p) => ({ ...p, descripcion: e.target.value }))
                  }
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permisos (módulos)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MODULOS.map((mod) => (
                    <label
                      key={mod}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formRol.permisos.includes(mod)}
                        onChange={() => togglePermiso(mod)}
                      />
                      <span className="text-sm">
                        {MODULO_LABELS[mod] || mod}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setModalRol(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={guardarRol}
                disabled={guardandoRol}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {guardandoRol ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Usuario */}
      {modalUsuario && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold">
                {modalUsuario === 'crear'
                  ? 'Nuevo usuario'
                  : 'Editar usuario'}
              </h2>
              <button
                onClick={() => setModalUsuario(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={formUsuario.nombre}
                  onChange={(e) =>
                    setFormUsuario((p) => ({ ...p, nombre: e.target.value }))
                  }
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellido
                </label>
                <input
                  type="text"
                  value={formUsuario.apellido}
                  onChange={(e) =>
                    setFormUsuario((p) => ({ ...p, apellido: e.target.value }))
                  }
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formUsuario.email}
                  onChange={(e) =>
                    setFormUsuario((p) => ({ ...p, email: e.target.value }))
                  }
                  className="w-full border rounded-lg px-3 py-2"
                  disabled={modalUsuario === 'editar'}
                />
                {modalUsuario === 'editar' && (
                  <p className="text-xs text-gray-500 mt-1">
                    El email no se puede cambiar
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña {modalUsuario === 'editar' && '(dejar vacía para no cambiar)'}
                </label>
                <input
                  type="password"
                  value={formUsuario.password}
                  onChange={(e) =>
                    setFormUsuario((p) => ({ ...p, password: e.target.value }))
                  }
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder={modalUsuario === 'editar' ? '••••••••' : 'Mínimo 6 caracteres'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rol
                </label>
                <select
                  value={formUsuario.rolId}
                  onChange={(e) =>
                    setFormUsuario((p) => ({ ...p, rolId: e.target.value }))
                  }
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>
              {modalUsuario === 'editar' && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formUsuario.activo}
                    onChange={(e) =>
                      setFormUsuario((p) => ({ ...p, activo: e.target.checked }))
                    }
                  />
                  <span className="text-sm">Activo</span>
                </label>
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setModalUsuario(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={guardarUsuario}
                disabled={guardandoUsuario}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {guardandoUsuario ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
