import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { tienePermiso } from './permisos'
export {
  generateToken,
  getTokenFromRequest,
  verifyToken,
  type JWTPayload,
} from './auth-jwt'
import { verifyToken } from './auth-jwt'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

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
      activo: true,
      rol: {
        select: {
          id: true,
          nombre: true,
          permisos: true,
        },
      },
    },
  })

  return user
}
/**
 * Comprueba si el usuario tiene permiso de administración (usuarios_roles o *).
 */
export function isAdmin(user: { rol?: { permisos?: unknown } } | null | undefined): boolean {
  return tienePermiso(user, 'usuarios_roles')
}








