import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPaymentProvider } from '@/lib/payments'
import { timbrarCFDI, almacenarCFDI, generarPDFCFDI } from '@/lib/facturacion'

/**
 * POST /api/pagos/stripe/confirm
 * Confirma un pago Stripe ya cobrado vía capa de abstracción; opcionalmente timbra factura.
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 401 }
      )
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    const rolesPago = ['CAJERO', 'ADMIN', 'GERENTE', 'MESERO']
    if (!rolesPago.includes(payload.rol)) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para procesar pagos' },
        { status: 403 }
      )
    }

    const provider = getPaymentProvider('stripe')
    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Stripe no configurado' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const {
      comandaId,
      paymentIntentId,
      receptor,
      detallesEmision,
      formaPago: formaPagoOverride,
      metodoPago: metodoPagoOverride,
      esFacturaGlobal,
    } = body

    if (!comandaId || !paymentIntentId) {
      return NextResponse.json(
        { success: false, error: 'comandaId y paymentIntentId son requeridos' },
        { status: 400 }
      )
    }

    const comanda = await prisma.comanda.findUnique({
      where: { id: comandaId },
    })

    if (!comanda) {
      return NextResponse.json(
        { success: false, error: 'Comanda no encontrada' },
        { status: 404 }
      )
    }

    if (comanda.estado === 'PAGADO') {
      return NextResponse.json(
        { success: false, error: 'Esta comanda ya está pagada' },
        { status: 400 }
      )
    }

    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      return NextResponse.json(
        { success: false, error: 'Stripe no configurado' },
        { status: 500 }
      )
    }

    const stripe = new Stripe(secretKey)
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.metadata?.comandaId !== comandaId) {
      return NextResponse.json(
        { success: false, error: 'El pago no corresponde a esta comanda' },
        { status: 400 }
      )
    }

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { success: false, error: 'El pago aún no ha sido completado' },
        { status: 400 }
      )
    }

    const monto = (paymentIntent.amount ?? 0) / 100

    const confirmResult = await provider.confirmPayment({
      paymentId: paymentIntentId,
      comandaId,
      amount: monto,
      metodoPago: 'tarjeta_credito',
      comision: 0,
      detalles: paymentIntent as unknown as Record<string, unknown>,
    })

    let factura = null
    try {
      const cfdi = await timbrarCFDI({
        comandaId,
        receptor,
        formaPago: formaPagoOverride ?? '04',
        metodoPago: metodoPagoOverride ?? 'PUE',
        ...(typeof esFacturaGlobal === 'boolean' && { esFacturaGlobal }),
      })

      const pdf = await generarPDFCFDI(cfdi)
      factura = await almacenarCFDI(
        comandaId,
        confirmResult.pagoId,
        { ...cfdi, pdf: pdf.toString('base64') },
        cfdi.conceptos,
        detallesEmision ?? undefined
      )
    } catch (facturaError) {
      console.error('Error al timbrar factura tras pago Stripe:', facturaError)
    }

    const pago = await prisma.pago.findUnique({
      where: { id: confirmResult.pagoId },
    })

    return NextResponse.json({
      success: true,
      data: {
        pago: pago
          ? {
              id: pago.id,
              estado: pago.estado,
              monto: pago.monto,
              referencia: pago.referencia,
            }
          : { id: confirmResult.pagoId, estado: confirmResult.estado, monto, referencia: null },
        factura: factura
          ? {
              uuid: factura.uuid,
              folio: factura.folio,
              qr: factura.qrCode,
            }
          : null,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al confirmar pago'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
