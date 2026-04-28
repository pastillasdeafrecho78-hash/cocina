import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'
import { ensureDefaultKdsSections, normalizeKdsSlug } from '@/lib/kds'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const prismaKds = prisma as any

const createKdsSeccionSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido'),
  slug: z.string().trim().min(1).optional(),
  color: z.string().trim().min(1).optional().nullable(),
  orden: z.number().int().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['kitchen.view', 'bar.view', 'cocina', 'barra', 'menu.view'])
    const tenant = requireActiveTenant(user)

    await ensureDefaultKdsSections(tenant.restauranteId)

    const secciones = await prismaKds.kdsSeccion.findMany({
      where: {
        restauranteId: tenant.restauranteId,
        activa: true,
      },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    })

    return NextResponse.json({
      success: true,
      data: secciones,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/kds/secciones:')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['settings.manage', 'menu.manage', 'configuracion'])
    const tenant = requireActiveTenant(user)

    await ensureDefaultKdsSections(tenant.restauranteId)

    const body = await request.json()
    const data = createKdsSeccionSchema.parse(body)
    const slug = normalizeKdsSlug(data.slug ?? data.nombre)
    if (!slug) {
      raise(400, 'El slug de la sección KDS es inválido')
    }

    const seccion = await prismaKds.kdsSeccion.create({
      data: {
        restauranteId: tenant.restauranteId,
        nombre: data.nombre,
        slug,
        tipoLegacy: null,
        color: data.color || null,
        orden: data.orden ?? 100,
      },
    })

    await prisma.auditoria
      .create({
        data: {
          restauranteId: tenant.restauranteId,
          usuarioId: user.id,
          accion: 'CREAR_KDS_SECCION',
          entidad: 'KdsSeccion',
          entidadId: seccion.id,
          detalles: {
            nombre: seccion.nombre,
            slug: seccion.slug,
          },
        },
      })
      .catch((error) => {
        console.warn('No se pudo registrar auditoría de KDS:', error)
      })

    return NextResponse.json(
      {
        success: true,
        data: seccion,
      },
      { status: 201 }
    )
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/kds/secciones:')
  }
}
