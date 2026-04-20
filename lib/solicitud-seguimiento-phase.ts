export type SolicitudClientePhase =
  | 'received'
  | 'validating'
  | 'queue'
  | 'accepted'
  | 'preparation'
  | 'ready'
  | 'cancelled'

export type ComandaEstadoLite = 'PENDIENTE' | 'EN_PREPARACION' | 'LISTO' | 'SERVIDO' | 'PAGADO' | 'CANCELADO'

export type ItemEstadoLite = 'PENDIENTE' | 'EN_PREPARACION' | 'LISTO' | 'ENTREGADO'

export type ItemSnapshotForPhase = {
  destino: 'COCINA' | 'BARRA'
  estado: ItemEstadoLite
  listoPorDefault: boolean
}

const PHASE_LABELS: Record<SolicitudClientePhase, string> = {
  received: 'Pedido recibido',
  validating: 'En validación',
  queue: 'En cola',
  accepted: 'Aceptado',
  preparation: 'En preparación',
  ready: 'Listo',
  cancelled: 'Cancelado',
}

export function labelForSolicitudPhase(phase: SolicitudClientePhase): string {
  return PHASE_LABELS[phase]
}

function hasActiveKitchenWork(items: ItemSnapshotForPhase[]): boolean {
  return items.some(
    (it) =>
      (it.destino === 'COCINA' || it.destino === 'BARRA') &&
      !it.listoPorDefault &&
      it.estado !== 'LISTO' &&
      it.estado !== 'ENTREGADO'
  )
}

export function computeSolicitudClientePhase(input: {
  estadoSolicitud: 'PENDIENTE' | 'EN_COLA' | 'APROBADA' | 'RECHAZADA' | 'EXPIRADA'
  approvedComandaId: string | null
  comandaEstado: ComandaEstadoLite | null
  items: ItemSnapshotForPhase[]
}): SolicitudClientePhase {
  if (
    input.estadoSolicitud === 'RECHAZADA' ||
    input.estadoSolicitud === 'EXPIRADA' ||
    input.comandaEstado === 'CANCELADO'
  ) {
    return 'cancelled'
  }

  if (input.comandaEstado === 'LISTO' || input.comandaEstado === 'SERVIDO') {
    return 'ready'
  }

  if (input.comandaEstado === 'PAGADO') {
    return 'ready'
  }

  if (input.comandaEstado) {
    if (input.comandaEstado === 'EN_PREPARACION' || hasActiveKitchenWork(input.items)) {
      return 'preparation'
    }
    if (input.comandaEstado === 'PENDIENTE' && hasActiveKitchenWork(input.items)) {
      return 'preparation'
    }
  }

  if (input.estadoSolicitud === 'APROBADA' || Boolean(input.approvedComandaId)) {
    return 'accepted'
  }

  if (input.estadoSolicitud === 'EN_COLA') {
    return 'queue'
  }

  if (input.estadoSolicitud === 'PENDIENTE') {
    return 'validating'
  }

  return 'received'
}
