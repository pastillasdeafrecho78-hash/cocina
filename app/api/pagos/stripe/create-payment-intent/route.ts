import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPaymentProvider } from '@/lib/payments'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'

/**
 * POST /api/pagos/stripe/create-payment-intent
 * Crea una intención de pago vía capa de abstracción (plugin Stripe).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['caja', 'comandas'])
    const tenant = requireActiveTenant(user)

    const provider = getPaymentProvider('stripe')
    if (!provider) {
      raise(500, 'Stripe no configurado. Añade STRIPE_SECRET_KEY en .env.local')
    }

    const body = await request.json()
    const { comandaId } = body

    if (!comandaId) {
      raise(400, 'comandaId es requerido')
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

    const total = comanda.total + (comanda.propina || 0) - (comanda.descuento || 0)
    if (total <= 0) {
      raise(400, 'El total debe ser mayor a 0')
    }

    const result = await provider.createPayment({
      comandaId,
      monto: total,
      numeroComanda: comanda.numeroComanda,
    })

    return NextResponse.json({
      success: true,
      data: {
        clientSecret: result.clientSecret,
        paymentId: result.paymentId,
        amount: result.amount,
      },
    })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error al crear intención de pago',
      'Error en POST /api/pagos/stripe/create-payment-intent:'
    )
  }
}
