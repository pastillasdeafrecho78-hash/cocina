import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClipApiKey } from '@/lib/clip-config'
import { clipPaymentDetail } from '@/lib/clip-payclip'
import { finalizarComandaTrasPagoClip } from '@/lib/clip-finalize'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'

export const dynamic = 'force-dynamic'

/**
 * Polling: consulta detalle en Clip y, si COMPLETED, finaliza pago/comanda (idempotente).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['caja', 'comandas'])
    const tenant = requireActiveTenant(user)
    const pinpadRequestId = request.nextUrl.searchParams.get('pinpadRequestId')
    const pagoId = request.nextUrl.searchParams.get('pagoId')
    if (!pinpadRequestId || !pagoId) {
      raise(400, 'pinpadRequestId y pagoId requeridos')
    }
    const pago = await prisma.pago.findFirst({
      where: {
        id: pagoId,
        procesador: 'clip',
        comanda: { restauranteId: tenant.restauranteId },
      },
      include: { comanda: true },
    })
    if (!pago) {
      raise(404, 'Pago no encontrado')
    }
    if (pago.estado === 'COMPLETADO') {
      return NextResponse.json({
        success: true,
        data: { status: 'COMPLETADO', yaCompletado: true },
      })
    }
    const apiKey = await getClipApiKey(tenant.restauranteId)
    if (!apiKey) {
      raise(400, 'Clip no configurado')
    }
    const detail = await clipPaymentDetail(apiKey, pinpadRequestId)
    const raw =
      detail.status ??
      detail.payment_status ??
      (detail.payment as Record<string, unknown> | undefined)?.status ??
      (detail.data as Record<string, unknown> | undefined)?.status
    const status = String(raw ?? '').toUpperCase().trim()
    // PinPad / Payclip puede usar nombres distintos según entorno o versión de API.
    const completed =
      status === 'COMPLETED' ||
      status === 'COMPLETE' ||
      status === 'APPROVED' ||
      status === 'PAID' ||
      status === 'SUCCESS' ||
      status === 'SUCCESSFUL' ||
      status === 'CAPTURED' ||
      status === 'SETTLED' ||
      status === 'PAYMENT_COMPLETED' ||
      status === 'PAYMENT_APPROVED'

    if (completed) {
      await finalizarComandaTrasPagoClip({
        pagoId: pago.id,
        comandaId: pago.comandaId,
        pinpadRequestId,
        detallesExtra: detail as Record<string, unknown>,
      })
      return NextResponse.json({
        success: true,
        data: { status: 'COMPLETADO', detail },
      })
    }
    return NextResponse.json({
      success: true,
      data: { status: status || 'PENDIENTE', detail },
    })
  } catch (error) {
    return toErrorResponse(error, 'Error consultando estado', 'Error en GET /api/clip/estado:')
  }
}
