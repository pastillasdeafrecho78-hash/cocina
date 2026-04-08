import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMenuContext } from '@/lib/menu-context'
import { z } from 'zod'
import { requireAuthenticatedUser, requireCapability } from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'

const createModificadorSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  tipo: z.enum(['INGREDIENTE', 'COCCION', 'TAMANO', 'EXTRAS']),
  precioExtra: z.number().min(0, 'El precio no puede ser negativo').default(0),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'menu.view')

    const menuCtx = await getMenuContext(user.restauranteId)
    if (!menuCtx) {
      raise(404, 'Sucursal no encontrada')
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
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/modificadores:')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireCapability(user, 'menu.manage')

    const menuCtx = await getMenuContext(user.restauranteId)
    if (!menuCtx) {
      raise(404, 'Sucursal no encontrada')
    }
    if (menuCtx.isSharedConsumer) {
      raise(
        409,
        'Esta sucursal usa carta compartida. No puedes editarla directamente; usa la sucursal fuente o clona la carta.'
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
      raise(400, 'Ya existe un extra con ese nombre y tipo')
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
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/modificadores:')
  }
}
