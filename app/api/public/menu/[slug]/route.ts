import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveEffectiveMenu } from '@/lib/menu-effective'
import { toErrorResponse } from '@/lib/authz/http'
import { hashSecretToken } from '@/lib/public-ordering'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  try {
    const slug = params.slug.trim().toLowerCase()
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Sucursal inválida' }, { status: 400 })
    }

    const restaurante = await prisma.restaurante.findFirst({
      where: { slug, activo: true },
      select: { id: true, nombre: true, slug: true },
    })
    if (!restaurante) {
      return NextResponse.json({ success: false, error: 'Sucursal no encontrada' }, { status: 404 })
    }

    const menuCtx = await resolveEffectiveMenu(restaurante.id)
    const menuRestauranteId = menuCtx.menuRestauranteId
    const url = new URL(request.url)
    const mesaCode = url.searchParams.get('mesa')?.trim()
    let mesaData: { id: string; numero: number } | null = null

    if (mesaCode) {
      const mesaLink = await prisma.mesaPublicLink.findFirst({
        where: {
          restauranteId: restaurante.id,
          codeHash: hashSecretToken(mesaCode),
          activa: true,
          OR: [{ expiraEn: null }, { expiraEn: { gt: new Date() } }],
          mesa: { activa: true },
        },
        select: {
          mesa: {
            select: {
              id: true,
              numero: true,
            },
          },
        },
      })
      if (!mesaLink) {
        return NextResponse.json(
          { success: false, error: 'Código de mesa inválido o expirado' },
          { status: 404 }
        )
      }
      mesaData = mesaLink.mesa
    }

    const categorias = await prisma.categoria.findMany({
      where: {
        restauranteId: menuRestauranteId,
        activa: true,
      },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        tipo: true,
        modificadores: {
          select: {
            id: true,
            modificadorId: true,
            modificador: {
              select: {
                id: true,
                nombre: true,
                tipo: true,
                precioExtra: true,
                activo: true,
              },
            },
          },
        },
        productos: {
          where: { activo: true },
          orderBy: { nombre: 'asc' },
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            precio: true,
            imagenUrl: true,
            modificadores: {
              select: {
                id: true,
                modificadorId: true,
                modificador: {
                  select: {
                    id: true,
                    nombre: true,
                    tipo: true,
                    precioExtra: true,
                    activo: true,
                  },
                },
              },
            },
            tamanos: {
              orderBy: { orden: 'asc' },
              select: {
                id: true,
                nombre: true,
                precio: true,
                orden: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        restaurante,
        mesa: mesaData,
        categorias,
      },
    })
  } catch (error) {
    return toErrorResponse(error, 'Error al obtener el menú', 'Error en GET /api/public/menu/[slug]:')
  }
}
