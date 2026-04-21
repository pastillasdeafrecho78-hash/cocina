import { CAPACIDADES, type Modulo } from '@/lib/permisos'

/** Grupos visuales para la UI de roles (cada módulo aparece en un solo grupo). */
export const PERMISSION_UI_GROUPS: readonly {
  id: string
  title: string
  description: string
  modules: readonly Modulo[]
}[] = [
  {
    id: 'mesas',
    title: 'Mesas y reservaciones',
    description: 'Mapa, tiempos de color, reservas y pedidos cliente / QR.',
    modules: [
      'mesas',
      'tables.view',
      'tables.manage',
      'tables.wait_times',
      'tables.reservations',
      'tables.client_channel',
      'reservations.view',
      'reservations.manage',
    ],
  },
  {
    id: 'comandas',
    title: 'Comandas y pedidos',
    description: 'Ver y operar comandas; aprobaciones especiales.',
    modules: ['comandas', 'orders.view', 'orders.manage', 'orders.override'],
  },
  {
    id: 'carta',
    title: 'Carta',
    description: 'Menú, categorías y productos.',
    modules: ['carta', 'menu.view', 'menu.manage'],
  },
  {
    id: 'cocina_barra',
    title: 'Cocina y barra',
    description: 'Pantallas y acciones de cocina y barra.',
    modules: ['cocina', 'barra', 'kitchen.view', 'kitchen.manage', 'bar.view', 'bar.manage'],
  },
  {
    id: 'caja',
    title: 'Caja y pagos',
    description: 'Turnos, cobros y caja.',
    modules: ['caja', 'payments.view', 'payments.manage'],
  },
  {
    id: 'reportes',
    title: 'Reportes',
    description: 'Consultas y analítica.',
    modules: ['reportes', 'reports.view'],
  },
  {
    id: 'config',
    title: 'Configuración',
    description: 'Ajustes de sucursal y beneficios.',
    modules: ['configuracion', 'settings.view', 'settings.manage', 'benefits.grant'],
  },
  {
    id: 'staff',
    title: 'Personal y roles',
    description: 'Usuarios, roles e invitaciones.',
    modules: ['usuarios_roles', 'staff.view', 'staff.manage'],
  },
] as const

export const ROLE_PRESET_KEYS = ['mesero', 'cocina', 'barra', 'caja', 'admin_sucursal'] as const
export type RolePresetKey = (typeof ROLE_PRESET_KEYS)[number]

const ALL_CAPS = [...CAPACIDADES] as readonly string[]

/** Plantillas que escriben solo capacidades (salvo admin que usa la lista completa de CAPACIDADES). */
export const ROLE_PRESETS: Record<
  RolePresetKey,
  { label: string; description: string; permisos: readonly string[] }
> = {
  mesero: {
    label: 'Mesero',
    description: 'Mesas completas, reservaciones y operación habitual de comandas.',
    permisos: [
      'tables.view',
      'tables.manage',
      'tables.wait_times',
      'tables.reservations',
      'tables.client_channel',
      'reservations.view',
      'reservations.manage',
      'orders.view',
      'orders.manage',
    ],
  },
  cocina: {
    label: 'Cocina',
    description: 'Cola de cocina y visibilidad de pedidos.',
    permisos: ['kitchen.view', 'kitchen.manage', 'orders.view'],
  },
  barra: {
    label: 'Barra',
    description: 'Cola de barra y visibilidad de pedidos.',
    permisos: ['bar.view', 'bar.manage', 'orders.view'],
  },
  caja: {
    label: 'Caja',
    description: 'Pagos y lectura de comandas para cobrar.',
    permisos: ['payments.view', 'payments.manage', 'orders.view'],
  },
  admin_sucursal: {
    label: 'Administrador de sucursal',
    description: 'Todas las capacidades granulares. Puedes añadir módulos legacy en modo avanzado si hace falta.',
    permisos: ALL_CAPS,
  },
}
