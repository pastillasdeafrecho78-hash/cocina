import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMenuContext } from '@/lib/menu-context'

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

    const menuCtx = await getMenuContext(restaurante.id)
    const menuRestauranteId = menuCtx?.menuRestauranteId ?? restaurante.id

    const categorias = await prisma.categoria.findMany({
      where: {
        restauranteId: menuRestauranteId,
        activa: true,
      },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: {
        productos: {
          where: { activo: true },
          orderBy: { nombre: 'asc' },
          include: {
            tamanos: {
              orderBy: { orden: 'asc' },
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
    console.error('Error en GET /api/public/menu/[slug]:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener el menú' },
      { status: 500 }
    )
  }
}
