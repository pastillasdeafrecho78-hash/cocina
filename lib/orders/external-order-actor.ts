import type { Prisma, PrismaClient } from '@prisma/client'

/** Email estable por sucursal: único con @@unique([restauranteId, email]). Sin login humano. */
export function externalOrderActorEmail(restauranteId: string): string {
  return `pedidos-externos.${restauranteId}@servimos.internal`
}

const ROL_CODIGO = 'INTEGRACION_PEDIDOS_EXTERNA'

/**
 * Usuario técnico para EXTERNAL_API y canal público (no es el admin sembrado).
 * Crea rol mínimo (sin permisos de panel) y membresías si no existía.
 */
export async function resolveExternalOrderActorUserId(
  prisma: PrismaClient,
  restauranteId: string
): Promise<string> {
  const email = externalOrderActorEmail(restauranteId)

  const existing = await prisma.usuario.findFirst({
    where: { restauranteId, email },
    select: { id: true, activo: true },
  })
  if (existing?.id) {
    if (existing.activo === false) {
      await prisma.usuario.update({
        where: { id: existing.id },
        data: { activo: true },
      })
    }
    return existing.id
  }

  return prisma.$transaction(async (tx) => {
    const again = await tx.usuario.findFirst({
      where: { restauranteId, email },
      select: { id: true },
    })
    if (again) return again.id

    const rol = await tx.rol.upsert({
      where: { codigo: ROL_CODIGO },
      update: {},
      create: {
        nombre: 'Integración pedidos externos',
        codigo: ROL_CODIGO,
        descripcion: 'Actor técnico para comandas desde API/canal público; no usar para sesión humana.',
        permisos: [] as Prisma.InputJsonValue,
      },
    })

    const restaurante = await tx.restaurante.findUnique({
      where: { id: restauranteId },
      select: { id: true, organizacionId: true },
    })
    if (!restaurante) {
      throw new Error(`Sucursal no encontrada: ${restauranteId}`)
    }

    const orgId = restaurante.organizacionId ?? null

    const usuario = await tx.usuario.create({
      data: {
        restauranteId,
        activeRestauranteId: restauranteId,
        activeOrganizacionId: orgId,
        email,
        nombre: 'Pedidos externos',
        apellido: '(integración)',
        password: null,
        rolId: rol.id,
        activo: true,
      },
      select: { id: true },
    })

    await tx.sucursalMiembro.upsert({
      where: {
        usuarioId_restauranteId: { usuarioId: usuario.id, restauranteId },
      },
      create: {
        usuarioId: usuario.id,
        restauranteId,
        rolId: rol.id,
        esPrincipal: false,
        activo: true,
      },
      update: { activo: true, rolId: rol.id },
    })

    if (orgId) {
      await tx.organizacionMiembro.upsert({
        where: {
          usuarioId_organizacionId: { usuarioId: usuario.id, organizacionId: orgId },
        },
        create: {
          usuarioId: usuario.id,
          organizacionId: orgId,
          rolId: rol.id,
          esOwner: false,
          activo: true,
        },
        update: { activo: true, rolId: rol.id },
      })
    }

    return usuario.id
  })
}

