import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const freshUser = await prisma.usuario.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        activeRestauranteId: true,
        activeOrganizacionId: true,
        sucursales: {
          where: { activo: true, restaurante: { activo: true } },
          orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'asc' }],
          select: {
            restauranteId: true,
            esPrincipal: true,
            restaurante: {
              select: {
                id: true,
                nombre: true,
                slug: true,
                menuStrategy: true,
                menuSourceRestauranteId: true,
                organizacionId: true,
                organizacion: {
                  select: {
                    id: true,
                    nombre: true,
                  },
                },
              },
            },
          },
        },
        organizaciones: {
          where: { activo: true, organizacion: { activo: true } },
          orderBy: { createdAt: 'asc' },
          select: {
            esOwner: true,
            organizacion: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
        cuentasOAuth: {
          select: {
            provider: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!freshUser) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    const currentBranch =
      freshUser.sucursales.find((s) => s.restauranteId === freshUser.activeRestauranteId) ??
      freshUser.sucursales[0] ??
      null

    const linkedProviders = freshUser.cuentasOAuth.map((c) => c.provider)
    const availableProviders = [
      {
        provider: 'google',
        enabled: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
      },
      {
        provider: 'facebook',
        enabled: Boolean(process.env.AUTH_META_ID && process.env.AUTH_META_SECRET),
      },
    ]

    return NextResponse.json({
      success: true,
      data: {
        activeOrganizacionId: freshUser.activeOrganizacionId,
        activeRestauranteId: freshUser.activeRestauranteId,
        current: currentBranch
          ? {
              restauranteId: currentBranch.restaurante.id,
              restauranteNombre: currentBranch.restaurante.nombre,
              restauranteSlug: currentBranch.restaurante.slug,
              menuStrategy: currentBranch.restaurante.menuStrategy,
              menuSourceRestauranteId: currentBranch.restaurante.menuSourceRestauranteId,
              organizacionId: currentBranch.restaurante.organizacionId,
              organizacionNombre: currentBranch.restaurante.organizacion?.nombre ?? null,
            }
          : null,
        branches: freshUser.sucursales.map((s) => ({
          restauranteId: s.restaurante.id,
          restauranteNombre: s.restaurante.nombre,
          restauranteSlug: s.restaurante.slug,
          menuStrategy: s.restaurante.menuStrategy,
          menuSourceRestauranteId: s.restaurante.menuSourceRestauranteId,
          organizacionId: s.restaurante.organizacionId,
          organizacionNombre: s.restaurante.organizacion?.nombre ?? null,
          esPrincipal: s.esPrincipal,
          isActive: s.restaurante.id === freshUser.activeRestauranteId,
        })),
        organizations: freshUser.organizaciones.map((m) => ({
          organizacionId: m.organizacion.id,
          organizacionNombre: m.organizacion.nombre,
          esOwner: m.esOwner,
        })),
        organizationBranches: freshUser.organizaciones.map((m) => ({
          organizacionId: m.organizacion.id,
          organizacionNombre: m.organizacion.nombre,
          branches: freshUser.sucursales
            .filter((s) => s.restaurante.organizacionId === m.organizacion.id)
            .map((s) => ({
              restauranteId: s.restaurante.id,
              restauranteNombre: s.restaurante.nombre,
              restauranteSlug: s.restaurante.slug,
              esPrincipal: s.esPrincipal,
              isActive: s.restaurante.id === freshUser.activeRestauranteId,
            })),
        })),
        oauth: {
          linkedProviders,
          availableProviders,
        },
      },
    })
  } catch (error) {
    console.error('Error en /api/auth/tenancy:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener contexto multitenant' },
      { status: 500 }
    )
  }
}
