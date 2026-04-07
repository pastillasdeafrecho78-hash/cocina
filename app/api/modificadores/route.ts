import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { getMenuContext } from '@/lib/menu-context'
import { z } from 'zod'

const createModificadorSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  tipo: z.enum(['INGREDIENTE', 'COCCION', 'TAMANO', 'EXTRAS']),
  precioExtra: z.number().min(0, 'El precio no puede ser negativo').default(0),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }
    if (!tienePermiso(user, 'menu.view')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para ver extras de la carta' },
        { status: 403 }
      )
    }

    const menuCtx = await getMenuContext(user.restauranteId)
    if (!menuCtx) {
      return NextResponse.json({ success: false, error: 'Sucursal no encontrada' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const soloActivos = searchParams.get('activo')

    const where: any = { restauranteId: menuCtx.menuRestauranteId }
    if (soloActivos !== null) {
      where.activo = soloActivos === 'true'
    }

    const modificadores = await prisma.modificador.findMany({
      where,
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
    })

    return NextResponse.json({ success: true, data: modificadores })
  } catch (error) {
    console.error('Error en GET /api/modificadores:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    if (!tienePermiso(user, 'menu.manage')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para crear extras' },
        { status: 403 }
      )
    }

    const menuCtx = await getMenuContext(user.restauranteId)
    if (!menuCtx) {
      return NextResponse.json({ success: false, error: 'Sucursal no encontrada' }, { status: 404 })
    }
    if (menuCtx.isSharedConsumer) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Esta sucursal usa carta compartida. No puedes editarla directamente; usa la sucursal fuente o clona la carta.',
        },
        { status: 409 }
      )
    }

    const body = await request.json()
    const data = createModificadorSchema.parse(body)

    const modificadorExistente = await prisma.modificador.findFirst({
      where: {
        nombre: data.nombre,
        tipo: data.tipo,
        restauranteId: menuCtx.menuRestauranteId,
      },
    })

    if (modificadorExistente) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un extra con ese nombre y tipo' },
        { status: 400 }
      )
    }

    const modificador = await prisma.modificador.create({
      data: {
        restauranteId: menuCtx.menuRestauranteId,
        nombre: data.nombre,
        tipo: data.tipo,
        precioExtra: data.precioExtra,
        activo: true,
      },
    })

    await prisma.auditoria.create({
      data: {
        restauranteId: user.restauranteId,
        usuarioId: user.id,
        accion: 'CREAR_MODIFICADOR',
        entidad: 'Modificador',
        entidadId: modificador.id,
      },
    })

    return NextResponse.json({ success: true, data: modificador }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error en POST /api/modificadores:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
