import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth'
import { tienePermiso } from '@/lib/permisos'
import { getClipApiKey } from '@/lib/clip-config'
import { clipPaymentDetail } from '@/lib/clip-payclip'
import { finalizarComandaTrasPagoClip } from '@/lib/clip-finalize'

/**
 * Polling: consulta detalle en Clip y, si COMPLETED, finaliza pago/comanda (idempotente).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user || (!tienePermiso(user, 'caja') && !tienePermiso(user, 'comandas'))) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }
    const pinpadRequestId = request.nextUrl.searchParams.get('pinpadRequestId')
    const pagoId = request.nextUrl.searchParams.get('pagoId')
    if (!pinpadRequestId || !pagoId) {
      return NextResponse.json(
        { success: false, error: 'pinpadRequestId y pagoId requeridos' },
        { status: 400 }
      )
    }
    const pago = await prisma.pago.findFirst({
      where: {
        id: pagoId,
        procesador: 'clip',
        comanda: { restauranteId: user.restauranteId },
      },
      include: { comanda: true },
    })
    if (!pago) {
      return NextResponse.json({ success: false, error: 'Pago no encontrado' }, { status: 404 })
    }
    if (pago.estado === 'COMPLETADO') {
      return NextResponse.json({
        success: true,
        data: { status: 'COMPLETADO', yaCompletado: true },
      })
    }
    const apiKey = await getClipApiKey(user.restauranteId)
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Clip no configurado' }, { status: 400 })
    }
    const detail = await clipPaymentDetail(apiKey, pinpadRequestId)
    const status = String(detail.status || detail.payment_status || '').toUpperCase()
    const completed = status === 'COMPLETED' || status === 'APPROVED' || status === 'PAID'

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
  } catch (e: any) {
    console.error(e)
    return NextResponse.json(
      { success: false, error: e?.message || 'Error consultando estado' },
      { status: 502 }
    )
  }
}
