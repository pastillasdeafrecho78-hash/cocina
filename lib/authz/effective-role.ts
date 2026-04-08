type MembershipRole = { restauranteId: string; rolId: string | null }

export function resolveEffectiveRoleId(
  activeRestauranteId: string | null,
  memberships: MembershipRole[],
  legacyRolId: string
) {
  const membershipForActiveBranch = memberships.find((m) => m.restauranteId === activeRestauranteId)
  const usedLegacyFallback = !membershipForActiveBranch?.rolId
  return {
    effectiveRolId: membershipForActiveBranch?.rolId ?? legacyRolId,
    usedLegacyFallback,
  }
}
