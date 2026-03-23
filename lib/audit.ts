/** Datos mínimos para crear registro de auditoría (multi-tenant) */
export function datosAuditoria(
  user: { id: string; restauranteId: string },
  accion: string,
  entidad: string,
  entidadId: string,
  detalles?: Record<string, unknown>
) {
  return {
    restauranteId: user.restauranteId,
    usuarioId: user.id,
    accion,
    entidad,
    entidadId,
    ...(detalles && { detalles }),
  }
}
