import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveEffectiveMenu } from '@/lib/menu-effective'
import { toErrorResponse } from '@/lib/authz/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
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

    const categorias = await prisma.categoria.findMany({
      where: {
        restauranteId: menuRestauranteId,
        activa: true,
      },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        productos: {
          where: { activo: true },
          orderBy: { nombre: 'asc' },
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            precio: true,
            imagenUrl: true,
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
        categorias,
      },
    })
  } catch (error) {
    return toErrorResponse(error, 'Error al obtener el menú', 'Error en GET /api/public/menu/[slug]:')
  }
}
