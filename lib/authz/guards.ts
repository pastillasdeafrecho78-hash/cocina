import { prisma } from '@/lib/prisma'
import { getSessionUser, type SessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { logAuthzEvent } from '@/lib/authz/logging'
import { raise } from '@/lib/authz/http'

export async function requireAuthenticatedUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) raise(401, 'No autenticado')
  return user
}

export function requireCapability(user: SessionUser, permission: string) {
  if (!tienePermiso(user, permission)) {
    logAuthzEvent('capability_denied', {
      userId: user.id,
      permission,
      restauranteId: user.restauranteId,
    })
    raise(403, 'Sin permisos')
  }
}

export function requireActiveTenant(user: SessionUser) {
  if (!user.restauranteId) {
    raise(403, 'No hay sucursal activa')
  }
  return {
    restauranteId: user.restauranteId,
    organizacionId: user.activeOrganizacionId ?? null,
  }
}

export async function requireBranchMembership(userId: string, restauranteId: string) {
  const membership = await prisma.sucursalMiembro.findFirst({
    where: {
      usuarioId: userId,
      restauranteId,
      activo: true,
      restaurante: { activo: true },
    },
    select: {
      id: true,
      restauranteId: true,
      rolId: true,
      restaurante: {
        select: { organizacionId: true },
      },
    },
  })
  if (!membership) {
    logAuthzEvent('branch_membership_denied', { userId, restauranteId })
    raise(403, 'No tienes acceso a esta sucursal')
  }
  return membership
}

export async function requireOrganizationMembership(userId: string, organizacionId: string) {
  const membership = await prisma.organizacionMiembro.findFirst({
    where: {
      usuarioId: userId,
      organizacionId,
      activo: true,
    },
    select: { id: true, organizacionId: true, esOwner: true, rolId: true },
  })
  if (!membership) {
    logAuthzEvent('organization_membership_denied', { userId, organizacionId })
    raise(403, 'No tienes acceso a esta organización')
  }
  return membership
}

export async function requireUserScopedToTenant(targetUserId: string, restauranteId: string) {
  const membership = await prisma.sucursalMiembro.findFirst({
    where: {
      usuarioId: targetUserId,
      restauranteId,
      activo: true,
    },
    select: { id: true },
  })
  if (!membership) raise(404, 'Usuario no encontrado')
  return membership
}

export async function requireRoleScopedToTenant(
  roleId: string,
  ctx: { restauranteId: string; organizacionId?: string | null; actorRoleId?: string | null }
) {
  const role = await prisma.rol.findUnique({
    where: { id: roleId },
    select: { id: true },
  })
  if (!role) raise(404, 'Rol no encontrado')

  if (ctx.actorRoleId && roleId === ctx.actorRoleId) return role

  const [branchLinked, orgLinked, userLinked] = await Promise.all([
    prisma.sucursalMiembro.findFirst({
      where: { restauranteId: ctx.restauranteId, rolId: roleId, activo: true },
      select: { id: true },
    }),
    ctx.organizacionId
      ? prisma.organizacionMiembro.findFirst({
          where: { organizacionId: ctx.organizacionId, rolId: roleId, activo: true },
          select: { id: true },
        })
      : Promise.resolve(null),
    prisma.usuario.findFirst({
      where: { restauranteId: ctx.restauranteId, rolId: roleId, activo: true },
      select: { id: true },
    }),
  ])

  if (!branchLinked && !orgLinked && !userLinked) {
    logAuthzEvent('role_scope_denied', {
      roleId,
      restauranteId: ctx.restauranteId,
      organizacionId: ctx.organizacionId ?? null,
    })
    raise(404, 'Rol no encontrado')
  }

  return role
}
