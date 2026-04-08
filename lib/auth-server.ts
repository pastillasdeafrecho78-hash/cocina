import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { resolveTenantContext } from '@/lib/tenant'
import { logLegacyFallback } from '@/lib/authz/logging'
import { resolveEffectiveRoleId } from '@/lib/authz/effective-role'

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>

/**
 * Usuario actual desde la sesión NextAuth (JWT). Usar en Route Handlers y server components.
 */
export async function getSessionUser() {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return null

  const user = await prisma.usuario.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      nombre: true,
      apellido: true,
      rolId: true,
      restauranteId: true,
      activeRestauranteId: true,
      activeOrganizacionId: true,
      activo: true,
      restaurante: {
        select: {
          id: true,
          nombre: true,
          slug: true,
          organizacionId: true,
          organizacion: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      },
      sucursales: {
        where: { activo: true, restaurante: { activo: true } },
        select: {
          restauranteId: true,
          esPrincipal: true,
          rolId: true,
          restaurante: {
            select: {
              id: true,
              nombre: true,
              slug: true,
              organizacionId: true,
              organizacion: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!user?.activo) return null

  let activeRestauranteId = user.activeRestauranteId ?? null
  let activeOrganizacionId = user.activeOrganizacionId ?? null

  const hasMemberships = user.sucursales.length > 0
  if (hasMemberships) {
    const activeMembership = user.sucursales.find((m) => m.restauranteId === activeRestauranteId)
    if (!activeMembership) {
      const preferred = user.sucursales.find((m) => m.esPrincipal) ?? user.sucursales[0]
      activeRestauranteId = preferred.restauranteId
      activeOrganizacionId = preferred.restaurante.organizacionId ?? null
    } else if (!activeOrganizacionId) {
      activeOrganizacionId = activeMembership.restaurante.organizacionId ?? null
    }
  } else {
    activeRestauranteId = null
    activeOrganizacionId = null
  }

  const { effectiveRolId, usedLegacyFallback } = resolveEffectiveRoleId(
    activeRestauranteId,
    user.sucursales.map((m) => ({ restauranteId: m.restauranteId, rolId: m.rolId ?? null })),
    user.rolId
  )
  if (usedLegacyFallback) {
    logLegacyFallback({
      userId: user.id,
      activeRestauranteId,
      fallbackRolId: user.rolId,
      reason: hasMemberships ? 'membership_without_role' : 'missing_membership',
    })
  }

  let rol = await prisma.rol.findUnique({
    where: { id: effectiveRolId },
    select: { id: true, nombre: true, permisos: true },
  })
  if (!rol && effectiveRolId !== user.rolId) {
    rol = await prisma.rol.findUnique({
      where: { id: user.rolId },
      select: { id: true, nombre: true, permisos: true },
    })
  }

  if (
    activeRestauranteId !== user.activeRestauranteId ||
    activeOrganizacionId !== user.activeOrganizacionId
  ) {
    await prisma.usuario
      .update({
        where: { id: user.id },
        data: {
          activeRestauranteId,
          activeOrganizacionId,
        },
      })
      .catch(() => {})
  }

  const ctx = resolveTenantContext({
    restauranteId: user.restauranteId,
    activeRestauranteId,
    activeOrganizacionId,
  })

  return {
    ...user,
    legacyRolId: user.rolId,
    rolId: effectiveRolId,
    effectiveRolId,
    restauranteId: ctx.restauranteId,
    activeRestauranteId: ctx.activeRestauranteId,
    activeOrganizacionId: ctx.activeOrganizacionId,
    restauranteNombre: user.restaurante.nombre,
    restauranteSlug: user.restaurante.slug,
    organizacionId: user.restaurante.organizacionId,
    organizacionNombre: user.restaurante.organizacion?.nombre ?? null,
    rol,
  }
}
