import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { getPaymentProvider } from '@/lib/payments'
import { timbrarCFDI, almacenarCFDI, generarPDFCFDI } from '@/lib/facturacion'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'

/**
 * POST /api/pagos/stripe/confirm
 * Confirma un pago Stripe ya cobrado vía capa de abstracción; opcionalmente timbra factura.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['caja', 'comandas'])
    const tenant = requireActiveTenant(user)

    const provider = getPaymentProvider('stripe')
    if (!provider) {
      raise(500, 'Stripe no configurado')
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
      raise(400, 'comandaId y paymentIntentId son requeridos')
    }

    const comanda = await prisma.comanda.findFirst({
      where: { id: comandaId, restauranteId: tenant.restauranteId },
      include: { items: true },
    })

    if (!comanda) {
      raise(404, 'Comanda no encontrada')
    }

    const itemsPendientes = comanda.items.filter(
      (i) => i.estado !== 'LISTO' && i.estado !== 'ENTREGADO'
    )
    if (itemsPendientes.length > 0) {
      raise(400, 'No se puede pagar hasta que todos los productos estén marcados como listos.')
    }

    if (comanda.estado === 'PAGADO') {
      raise(400, 'Esta comanda ya está pagada')
    }

    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      raise(500, 'Stripe no configurado')
    }

    const stripe = new Stripe(secretKey)
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.metadata?.comandaId !== comandaId) {
      raise(400, 'El pago no corresponde a esta comanda')
    }

    if (paymentIntent.status !== 'succeeded') {
      raise(400, 'El pago aún no ha sido completado')
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
  } catch (error) {
    return toErrorResponse(error, 'Error al confirmar pago', 'Error en POST /api/pagos/stripe/confirm:')
  }
}
