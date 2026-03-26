import { prisma } from './prisma'
import { tienePermiso } from './permisos'
export {
  generateToken,
  getTokenFromRequest,
  getAuthTokenFromRequest,
  verifyToken,
  type JWTPayload,
} from './auth-jwt'
import { verifyToken } from './auth-jwt'

export { hashPassword, verifyPassword } from './password'

async function getRolById(rolId: string | null | undefined) {
  if (!rolId) {
    return null
  }

  try {
    return await prisma.rol.findUnique({
      where: { id: rolId },
      select: {
        id: true,
        nombre: true,
        permisos: true,
      },
    })
  } catch (error) {
    console.error('No se pudo cargar el rol del usuario:', error)
    return null
  }
}

/** @deprecated Preferir getSessionUser() con NextAuth. */
export async function getUserFromToken(token: string | null) {
  if (!token) return null

  const payload = await verifyToken(token)
  if (!payload) return null

  const user = await prisma.usuario.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      nombre: true,
      apellido: true,
      rolId: true,
      restauranteId: true,
      activo: true,
    },
  })

  if (!user?.activo) {
    return null
  }
  if (payload.restauranteId && user.restauranteId !== payload.restauranteId) {
    return null
  }

  const rol = await getRolById(user.rolId)

  return {
    ...user,
    rol,
  }
}

export function isAdmin(user: { rol?: { permisos?: unknown } } | null | undefined): boolean {
  return tienePermiso(user, 'usuarios_roles')
}
