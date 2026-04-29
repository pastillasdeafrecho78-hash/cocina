import { CAPACIDADES, type Modulo } from '@/lib/permisos'

/**
 * Explicación breve al pasar el cursor (sin saturar la etiqueta visible).
 * Cubre todos los módulos listados en MODULOS.
 */
export const PERMISSION_HOVER_HINTS: Record<string, string> = {
  mesas:
    'Paquete heredado: acceso amplio a mesas, reservas y canal cliente como en roles viejos. Suele bastar con las capacidades tables.* en roles nuevos.',
  comandas:
    'Paquete heredado: ver y operar comandas como antes. Equivale en gran parte a orders.* en el sistema nuevo.',
  carta: 'Paquete heredado: ver y editar menú y productos. Equivale a menu.view y menu.manage.',
  cocina: 'Paquete heredado: pantalla y acciones de cocina. Equivale a kitchen.view y kitchen.manage.',
  barra: 'Paquete heredado: pantalla y acciones de barra. Equivale a bar.view y bar.manage.',
  reportes: 'Paquete heredado: acceso a reportes. Equivale a reports.view.',
  caja: 'Paquete heredado: caja y cobros. Equivale a payments.view y payments.manage.',
  configuracion: 'Paquete heredado: ajustes de sucursal. Equivale a settings.view y settings.manage.',
  usuarios_roles: 'Paquete heredado: usuarios y roles. Equivale a staff.view y staff.manage.',
  'menu.view': 'Puede ver categorías, productos y precios en la carta.',
  'menu.manage': 'Puede crear, editar y desactivar categorías y productos.',
  'orders.view': 'Puede ver comandas activas y su detalle (sin modificarlas, según otras reglas).',
  'orders.manage': 'Puede crear ítems, enviar a cocina/barra y operar el flujo habitual de la comanda.',
  'orders.override': 'Puede aprobar, rechazar o forzar pedidos especiales o excepciones en cola.',
  'kitchen.view': 'Ve la cola de cocina y el estado de los platillos.',
  'kitchen.manage': 'Puede marcar listo, entregado y operar la cola de cocina.',
  'bar.view': 'Ve la cola de barra y bebidas.',
  'bar.manage': 'Puede marcar listo y operar la cola de barra.',
  'payments.view': 'Ve turnos de caja, cobros y resúmenes de pagos.',
  'payments.manage': 'Puede abrir/cerrar turno, registrar cobros y ajustes de caja.',
  'reports.view': 'Accede a reportes y analítica permitida para su sucursal.',
  'settings.view': 'Ve configuración general de la sucursal (lectura).',
  'settings.manage': 'Puede cambiar configuración, integraciones y datos sensibles de la sucursal.',
  'staff.view': 'Ve lista de usuarios, roles asignados y estado de invitaciones.',
  'staff.manage': 'Puede crear usuarios, asignar roles y códigos de acceso.',
  'reservations.view': 'Ve reservas y calendario de la sucursal.',
  'reservations.manage': 'Puede crear, editar y cancelar reservaciones.',
  'tables.view': 'Ve mapa de mesas y estado de ocupación.',
  'tables.manage': 'Puede dar de alta o baja mesas y ajustar su numeración.',
  'tables.wait_times': 'Puede ver y ajustar los tiempos de color del tablero de mesas.',
  'tables.reservations': 'Accede al módulo de reservas desde el flujo de mesas.',
  'tables.client_channel': 'Gestiona pedido por QR, links públicos y canal cliente en mesa.',
  'inventory.view': 'Ve artículos, stock, alertas y movimientos de inventario.',
  'inventory.manage': 'Crea artículos y registra compras, entradas y ajustes de stock.',
  'benefits.grant': 'Puede aplicar descuentos o beneficios especiales definidos por la sucursal.',
}

export function getPermissionHoverHint(mod: string): string {
  return PERMISSION_HOVER_HINTS[mod] ?? `Permiso del sistema: ${mod}`
}

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
    id: 'inventario',
    title: 'Inventario',
    description: 'Artículos, compras/entradas y ajustes manuales de stock.',
    modules: ['inventory.view', 'inventory.manage'],
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
      'inventory.view',
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
