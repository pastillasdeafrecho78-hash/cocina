import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

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
      activo: true,
    },
  })

  if (!user?.activo) return null

  const rol = await prisma.rol.findUnique({
    where: { id: user.rolId },
    select: { id: true, nombre: true, permisos: true },
  })

  return {
    ...user,
    rol,
  }
}
