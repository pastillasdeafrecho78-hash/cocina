import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { resolveTenantContext } from '@/lib/tenant'

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

  const rol = await prisma.rol.findUnique({
    where: { id: user.rolId },
    select: { id: true, nombre: true, permisos: true },
  })

  let activeRestauranteId = user.activeRestauranteId ?? user.restauranteId
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
