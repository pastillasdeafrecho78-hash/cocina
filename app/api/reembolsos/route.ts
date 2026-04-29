import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'
import { validarMontoReembolso } from '@/lib/reembolsos/validacion'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const prismaReembolsos = prisma as any

const createReembolsoSchema = z.object({
  pagoId: z.string().min(1),
  pagoLineaId: z.string().min(1).optional().nullable(),
  tipo: z.enum(['OPERATIVO_CAJA', 'PROVEEDOR_PAGO']).default('OPERATIVO_CAJA'),
  monto: z.number().positive(),
  motivo: z.string().trim().min(4, 'El motivo es requerido'),
  referencia: z.string().trim().optional().nullable(),
  procesadorId: z.string().trim().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['payments.view', 'payments.manage', 'caja'])
    const tenant = requireActiveTenant(user)

    const { searchParams } = new URL(request.url)
    const comandaId = searchParams.get('comandaId')
    const pagoId = searchParams.get('pagoId')

    const reembolsos = await prismaReembolsos.reembolso.findMany({
      where: {
        restauranteId: tenant.restauranteId,
        ...(comandaId && { comandaId }),
        ...(pagoId && { pagoId }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        pago: true,
        pagoLinea: true,
        usuario: {
          select: { id: true, nombre: true, apellido: true },
        },
        comanda: {
          select: { id: true, numeroComanda: true },
        },
      },
      take: 100,
    })

    return NextResponse.json({ success: true, data: reembolsos })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/reembolsos:')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['payments.manage', 'caja'])
    const tenant = requireActiveTenant(user)

    const data = createReembolsoSchema.parse(await request.json())
    const pago = await prismaReembolsos.pago.findFirst({
      where: {
        id: data.pagoId,
        estado: 'COMPLETADO',
        comanda: { restauranteId: tenant.restauranteId },
      },
      include: {
        reembolsos: true,
        lineas: true,
        comanda: { select: { id: true, restauranteId: true } },
      },
    })

    if (!pago) raise(404, 'Pago completado no encontrado')

    if (data.pagoLineaId && !pago.lineas.some((linea: { id: string }) => linea.id === data.pagoLineaId)) {
      raise(400, 'La línea de pago no pertenece al pago indicado')
    }

    const validacion = validarMontoReembolso({
      pagoMonto: pago.monto,
      reembolsos: pago.reembolsos,
      montoSolicitado: data.monto,
    })
    if (!validacion.ok) raise(400, validacion.error)

    const reembolso = await prismaReembolsos.reembolso.create({
      data: {
        restauranteId: tenant.restauranteId,
        comandaId: pago.comandaId,
        pagoId: pago.id,
        pagoLineaId: data.pagoLineaId || null,
        tipo: data.tipo,
        monto: data.monto,
        motivo: data.motivo,
        referencia: data.referencia || null,
        procesadorId: data.procesadorId || null,
        usuarioId: user.id,
      },
      include: {
        pago: true,
        pagoLinea: true,
        usuario: {
          select: { id: true, nombre: true, apellido: true },
        },
      },
    })

    await prisma.auditoria
      .create({
        data: {
          restauranteId: tenant.restauranteId,
          usuarioId: user.id,
          accion: 'CREAR_REEMBOLSO',
          entidad: 'Reembolso',
          entidadId: reembolso.id,
          detalles: {
            pagoId: pago.id,
            comandaId: pago.comandaId,
            monto: reembolso.monto,
            tipo: reembolso.tipo,
          },
        },
      })
      .catch((error) => console.warn('No se pudo registrar auditoría de reembolso:', error))

    return NextResponse.json({ success: true, data: reembolso }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/reembolsos:')
  }
}
