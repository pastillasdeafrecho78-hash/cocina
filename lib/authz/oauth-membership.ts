export function buildBranchMembershipUpsertData(input: {
  userId: string
  restauranteId: string
  rolId: string
  esPrincipal: boolean
}) {
  return {
    where: {
      usuarioId_restauranteId: {
        usuarioId: input.userId,
        restauranteId: input.restauranteId,
      },
    },
    create: {
      usuarioId: input.userId,
      restauranteId: input.restauranteId,
      rolId: input.rolId,
      activo: true,
      esPrincipal: input.esPrincipal,
    },
    // Compatibilidad temporal: no sobreescribir rolId ya asignado por sucursal.
    update: { activo: true },
  }
}

export function buildOrganizationMembershipUpsertData(input: {
  userId: string
  organizacionId: string
  rolId: string
}) {
  return {
    where: {
      usuarioId_organizacionId: {
        usuarioId: input.userId,
        organizacionId: input.organizacionId,
      },
    },
    create: {
      usuarioId: input.userId,
      organizacionId: input.organizacionId,
      rolId: input.rolId,
      activo: true,
    },
    // Compatibilidad temporal: no sobreescribir rolId ya asignado por organización.
    update: { activo: true },
  }
}
