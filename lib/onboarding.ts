import { PrismaClient } from '@prisma/client'

export const PENDING_ACCESS_SLUG = '__pending_access__'
export const PENDING_ACCESS_ROLE_CODE = 'PENDING_ACCESS'

type PrismaLike = PrismaClient | Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

export async function ensurePendingAccessContext(db: PrismaLike) {
  const rol =
    (await db.rol.findUnique({
      where: { codigo: PENDING_ACCESS_ROLE_CODE },
      select: { id: true },
    })) ??
    (await db.rol.create({
      data: {
        nombre: 'Acceso pendiente',
        codigo: PENDING_ACCESS_ROLE_CODE,
        descripcion: 'Cuenta sin sucursal vinculada',
        permisos: [],
      },
      select: { id: true },
    }))

  const restaurante =
    (await db.restaurante.findUnique({
      where: { slug: PENDING_ACCESS_SLUG },
      select: { id: true },
    })) ??
    (await db.restaurante.create({
      data: {
        nombre: 'Acceso pendiente',
        slug: PENDING_ACCESS_SLUG,
        activo: true,
      },
      select: { id: true },
    }))

  return {
    rolId: rol.id,
    restauranteId: restaurante.id,
  }
}
