import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  requireAuthenticatedUser,
  requireBranchMembership,
  requireCapability,
  requireOrganizationMembership,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const querySchema = z.object({
  scope: z.enum(['branch', 'organization']),
  id: z.string().min(1),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'staff.manage')

    const parsed = querySchema.safeParse({
      scope: request.nextUrl.searchParams.get('scope'),
      id: request.nextUrl.searchParams.get('id'),
    })
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Parámetros inválidos', details: parsed.error.errors },
        { status: 400 }
      )
    }
    const { scope, id } = parsed.data

    if (scope === 'branch') {
      await requireBranchMembership(user.id, id)

      const members = await prisma.sucursalMiembro.findMany({
        where: { restauranteId: id, activo: true, usuario: { activo: true } },
        orderBy: { createdAt: 'asc' },
        select: {
          esPrincipal: true,
          rolId: true,
          rol: {
            select: {
              id: true,
              nombre: true,
            },
          },
          usuario: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true,
            },
          },
        },
      })

      return NextResponse.json({
        success: true,
        data: {
          scope,
          id,
          members: members.map((m) => ({
            id: m.usuario.id,
            nombre: m.usuario.nombre,
            apellido: m.usuario.apellido,
            email: m.usuario.email,
            rol: m.rol,
            rolId: m.rolId,
            esPrincipal: m.esPrincipal,
          })),
        },
      })
    }

    await requireOrganizationMembership(user.id, id)

    const members = await prisma.organizacionMiembro.findMany({
      where: { organizacionId: id, activo: true, usuario: { activo: true } },
      orderBy: { createdAt: 'asc' },
      select: {
        esOwner: true,
        rolId: true,
        rol: {
          select: {
            id: true,
            nombre: true,
          },
        },
        usuario: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            sucursales: {
              where: { activo: true, restaurante: { organizacionId: id, activo: true } },
              select: {
                restaurante: {
                  select: {
                    id: true,
                    nombre: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        scope,
        id,
        members: members.map((m) => ({
          id: m.usuario.id,
          nombre: m.usuario.nombre,
          apellido: m.usuario.apellido,
          email: m.usuario.email,
          rol: m.rol,
          rolId: m.rolId,
          esOwner: m.esOwner,
          sucursales: m.usuario.sucursales.map((s) => ({
            restauranteId: s.restaurante.id,
            restauranteNombre: s.restaurante.nombre,
          })),
        })),
      },
    })
  } catch (error) {
    return toErrorResponse(error, 'Error al cargar membresías', 'Error en /api/auth/memberships:')
  }
}
