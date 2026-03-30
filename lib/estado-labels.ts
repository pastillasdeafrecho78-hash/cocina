/** Etiquetas unificadas de estado para comandas, cocina y barra */
export const ESTADOS_ITEM = {
  PENDIENTE: 'Por preparar',
  EN_PREPARACION: 'Por preparar',
  LISTO: 'Listo para entregar',
  ENTREGADO: 'Entregado',
} as const

export const ESTADOS_COMANDA = {
  ...ESTADOS_ITEM,
  SERVIDO: 'Entregado',
  PAGADO: 'Pagado',
  CANCELADO: 'Cancelado',
} as const

export function labelItemEstado(estado: string): string {
  return ESTADOS_ITEM[estado as keyof typeof ESTADOS_ITEM] ?? estado
}

export function labelComandaEstado(estado: string): string {
  return ESTADOS_COMANDA[estado as keyof typeof ESTADOS_COMANDA] ?? estado
}
