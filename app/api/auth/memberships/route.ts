import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { tienePermiso } from '@/lib/permisos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const querySchema = z.object({
  scope: z.enum(['branch', 'organization']),
  id: z.string().min(1),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'usuarios_roles')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

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
      const allowed = await prisma.sucursalMiembro.findFirst({
        where: {
          usuarioId: user.id,
          restauranteId: id,
          activo: true,
        },
      })
      if (!allowed) {
        return NextResponse.json(
          { success: false, error: 'No tienes acceso a esta sucursal' },
          { status: 403 }
        )
      }

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

    const allowedOrg = await prisma.organizacionMiembro.findFirst({
      where: {
        usuarioId: user.id,
        organizacionId: id,
        activo: true,
      },
    })
    if (!allowedOrg) {
      return NextResponse.json(
        { success: false, error: 'No tienes acceso a esta organización' },
        { status: 403 }
      )
    }

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
    console.error('Error en /api/auth/memberships:', error)
    return NextResponse.json(
      { success: false, error: 'Error al cargar membresías' },
      { status: 500 }
    )
  }
}
