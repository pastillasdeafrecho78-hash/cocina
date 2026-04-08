import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { allocateUniqueRestaurantSlug } from '@/lib/slug'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireBranchMembership,
  requireCapability,
  requireOrganizationMembership,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({
  nombre: z.string().min(2).max(120),
  organizacionId: z.string().min(1).optional(),
  menuStrategy: z.enum(['empty', 'clone', 'shared']).default('empty'),
  menuSourceRestauranteId: z.string().min(1).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'settings.manage')
    const tenant = requireActiveTenant(user)
    const body = schema.parse(await request.json())
    if (body.organizacionId) {
      await requireOrganizationMembership(user.id, body.organizacionId)
    } else if (tenant.organizacionId) {
      await requireOrganizationMembership(user.id, tenant.organizacionId)
    }
    const actorRolId = user.effectiveRolId ?? user.rolId
    const orgId = body.organizacionId ?? user.activeOrganizacionId ?? undefined
    const shouldUseSource = body.menuStrategy === 'clone' || body.menuStrategy === 'shared'
    if (shouldUseSource && !body.menuSourceRestauranteId) {
      return NextResponse.json(
        { success: false, error: 'Debes seleccionar una sucursal origen para clonar o compartir carta' },
        { status: 400 }
      )
    }

    let sourceData:
      | {
          id: string
          organizacionId: string | null
          categorias: Array<{
            id: string
            nombre: string
            descripcion: string | null
            tipo: 'COMIDA' | 'BEBIDA' | 'POSTRE' | 'ENTRADA'
            orden: number
            activa: boolean
            productos: Array<{
              id: string
              nombre: string
              descripcion: string | null
              precio: number
              activo: boolean
              listoPorDefault: boolean
              imagenUrl: string | null
              tamanos: Array<{
                nombre: string
                precio: number
                orden: number
              }>
              modificadores: Array<{ modificadorId: string }>
            }>
            modificadores: Array<{ modificadorId: string }>
          }>
          modificadores: Array<{
            id: string
            nombre: string
            tipo: 'INGREDIENTE' | 'COCCION' | 'TAMANO' | 'EXTRAS'
            precioExtra: number | null
            activo: boolean
          }>
        }
      | null = null

    if (shouldUseSource && body.menuSourceRestauranteId) {
      await requireBranchMembership(user.id, body.menuSourceRestauranteId)
      sourceData = await prisma.restaurante.findFirst({
        where: {
          id: body.menuSourceRestauranteId,
          activo: true,
          miembrosSucursal: {
            some: { usuarioId: user.id, activo: true },
          },
        },
        select: {
          id: true,
          organizacionId: true,
          categorias: {
            where: { activa: true },
            include: {
              modificadores: { select: { modificadorId: true } },
              productos: {
                where: { activo: true },
                include: {
                  tamanos: {
                    select: {
                      nombre: true,
                      precio: true,
                      orden: true,
                    },
                    orderBy: { orden: 'asc' },
                  },
                  modificadores: { select: { modificadorId: true } },
                },
              },
            },
            orderBy: { orden: 'asc' },
          },
          modificadores: {
            where: { activo: true },
            select: {
              id: true,
              nombre: true,
              tipo: true,
              precioExtra: true,
              activo: true,
            },
            orderBy: { nombre: 'asc' },
          },
        },
      })
      if (!sourceData) {
        return NextResponse.json(
          { success: false, error: 'No tienes acceso a la sucursal origen seleccionada' },
          { status: 403 }
        )
      }
    }

    const slug = await allocateUniqueRestaurantSlug(
      async (candidate) =>
        prisma.restaurante.findFirst({ where: { slug: candidate }, select: { slug: true } }),
      body.nombre
    )

    const created = await prisma.$transaction(async (tx) => {
      const restaurante = await tx.restaurante.create({
        data: {
          nombre: body.nombre.trim(),
          slug,
          organizacionId: orgId ?? null,
          activo: true,
          menuStrategy:
            body.menuStrategy === 'shared'
              ? 'SHARED'
              : body.menuStrategy === 'clone'
                ? 'CLONE'
                : 'EMPTY',
          menuSourceRestauranteId:
            body.menuStrategy === 'shared' ? (body.menuSourceRestauranteId ?? null) : null,
        },
        select: {
          id: true,
          nombre: true,
          slug: true,
          organizacionId: true,
          menuStrategy: true,
          menuSourceRestauranteId: true,
        },
      })

      await tx.sucursalMiembro.upsert({
        where: {
          usuarioId_restauranteId: {
            usuarioId: user.id,
            restauranteId: restaurante.id,
          },
        },
        create: {
          usuarioId: user.id,
          restauranteId: restaurante.id,
          rolId: actorRolId,
          esPrincipal: false,
          activo: true,
        },
        update: { activo: true, rolId: actorRolId },
      })

      if (restaurante.organizacionId) {
        await tx.organizacionMiembro.upsert({
          where: {
            usuarioId_organizacionId: {
              usuarioId: user.id,
              organizacionId: restaurante.organizacionId,
            },
          },
          create: {
            usuarioId: user.id,
            organizacionId: restaurante.organizacionId,
            rolId: actorRolId,
            activo: true,
          },
          update: { activo: true, rolId: actorRolId },
        })
      }

      if (body.menuStrategy === 'clone' && sourceData) {
        const modifierMap = new Map<string, string>()
        const categoryMap = new Map<string, string>()
        const productMap = new Map<string, string>()

        for (const modifier of sourceData.modificadores) {
          const createdModifier = await tx.modificador.create({
            data: {
              restauranteId: restaurante.id,
              nombre: modifier.nombre,
              tipo: modifier.tipo,
              precioExtra: modifier.precioExtra ?? 0,
              activo: modifier.activo,
            },
            select: { id: true },
          })
          modifierMap.set(modifier.id, createdModifier.id)
        }

        for (const category of sourceData.categorias) {
          const createdCategory = await tx.categoria.create({
            data: {
              restauranteId: restaurante.id,
              nombre: category.nombre,
              descripcion: category.descripcion,
              tipo: category.tipo,
              orden: category.orden,
              activa: category.activa,
            },
            select: { id: true },
          })
          categoryMap.set(category.id, createdCategory.id)

          for (const relation of category.modificadores) {
            const clonedModifierId = modifierMap.get(relation.modificadorId)
            if (!clonedModifierId) continue
            await tx.modificadorCategoria.create({
              data: {
                categoriaId: createdCategory.id,
                modificadorId: clonedModifierId,
              },
            })
          }
        }

        for (const category of sourceData.categorias) {
          const clonedCategoryId = categoryMap.get(category.id)
          if (!clonedCategoryId) continue

          for (const product of category.productos) {
            const createdProduct = await tx.producto.create({
              data: {
                nombre: product.nombre,
                descripcion: product.descripcion,
                precio: product.precio,
                categoriaId: clonedCategoryId,
                activo: product.activo,
                listoPorDefault: product.listoPorDefault,
                imagenUrl: product.imagenUrl,
              },
              select: { id: true },
            })
            productMap.set(product.id, createdProduct.id)

            for (const size of product.tamanos) {
              await tx.productoTamano.create({
                data: {
                  productoId: createdProduct.id,
                  nombre: size.nombre,
                  precio: size.precio,
                  orden: size.orden,
                },
              })
            }

            for (const relation of product.modificadores) {
              const clonedModifierId = modifierMap.get(relation.modificadorId)
              if (!clonedModifierId) continue
              await tx.modificadorProducto.create({
                data: {
                  productoId: createdProduct.id,
                  modificadorId: clonedModifierId,
                },
              })
            }
          }
        }
      }

      return restaurante
    })

    return NextResponse.json({ success: true, data: created })
  } catch (error) {
    return toErrorResponse(error, 'No se pudo crear la sucursal', 'POST /api/auth/branches')
  }
}

const deleteSchema = z.object({
  restauranteId: z.string().min(1),
  confirmNombre: z.string().min(1),
  acknowledge: z.literal(true),
})

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'settings.manage')
    const input = deleteSchema.parse(await request.json())
    await requireBranchMembership(user.id, input.restauranteId)
    const target = await prisma.restaurante.findFirst({
      where: {
        id: input.restauranteId,
        miembrosSucursal: {
          some: { usuarioId: user.id, activo: true },
        },
      },
      select: {
        id: true,
        nombre: true,
        activo: true,
        organizacionId: true,
      },
    })
    if (!target) {
      return NextResponse.json({ success: false, error: 'Sucursal no encontrada' }, { status: 404 })
    }
    if (!target.activo) {
      return NextResponse.json({ success: false, error: 'La sucursal ya está cerrada' }, { status: 400 })
    }
    if (target.nombre.trim() !== input.confirmNombre.trim()) {
      return NextResponse.json(
        { success: false, error: 'El nombre de confirmación no coincide' },
        { status: 400 }
      )
    }

    const activeBranches = await prisma.restaurante.count({
      where: {
        activo: true,
        miembrosSucursal: {
          some: { usuarioId: user.id, activo: true },
        },
      },
    })
    if (activeBranches <= 1) {
      return NextResponse.json(
        { success: false, error: 'No puedes cerrar tu última sucursal activa.' },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.restaurante.update({
        where: { id: target.id },
        data: { activo: false },
      })

      await tx.sucursalMiembro.updateMany({
        where: { restauranteId: target.id },
        data: { activo: false },
      })

      await tx.usuario.updateMany({
        where: {
          activeRestauranteId: target.id,
        },
        data: {
          activeRestauranteId: null,
          ...(target.organizacionId ? { activeOrganizacionId: null } : {}),
        },
      })

      await tx.auditoria.create({
        data: {
          restauranteId: target.id,
          usuarioId: user.id,
          accion: 'CERRAR_SUCURSAL',
          entidad: 'Restaurante',
          entidadId: target.id,
          detalles: {
            reason: 'destructive_action_soft_close',
            historicalDataRetained: true,
          },
        },
      })
    })

    return NextResponse.json({
      success: true,
      data: {
        restauranteId: target.id,
        nombre: target.nombre,
        closed: true,
        message:
          'Sucursal cerrada correctamente. Algunos datos históricos pueden conservarse por integridad del sistema y analítica.',
      },
    })
  } catch (error) {
    return toErrorResponse(error, 'No se pudo cerrar la sucursal', 'DELETE /api/auth/branches')
  }
}
