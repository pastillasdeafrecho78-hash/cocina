import { SignJWT, jwtVerify, type JWTPayload as JoseJWTPayload } from 'jose'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { tienePermiso } from './permisos'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-secret-key-change-in-production'
)

export interface JWTPayload extends JoseJWTPayload {
  userId: string
  email: string
  rolId: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export async function generateToken(payload: JWTPayload): Promise<string> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET)

  return token
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as JWTPayload
  } catch (error) {
    return null
  }
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

export function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization')
  return authHeader?.replace('Bearer ', '') || null
}

/**
 * Comprueba si el usuario tiene permiso de administración (usuarios_roles o *).
 */
export function isAdmin(user: { rol?: { permisos?: unknown } } | null | undefined): boolean {
  return tienePermiso(user, 'usuarios_roles')
}








