import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth'
import { tienePermiso } from '@/lib/permisos'
import { prisma } from '@/lib/prisma'
import { getPaymentProvider } from '@/lib/payments'

/**
 * POST /api/pagos/stripe/create-payment-intent
 * Crea una intención de pago vía capa de abstracción (plugin Stripe).
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

    const user = await getUserFromToken(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }
    if (!tienePermiso(user, 'caja') && !tienePermiso(user, 'comandas')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para procesar pagos' },
        { status: 403 }
      )
    }

    const provider = getPaymentProvider('stripe')
    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Stripe no configurado. Añade STRIPE_SECRET_KEY en .env.local' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { comandaId } = body

    if (!comandaId) {
      return NextResponse.json(
        { success: false, error: 'comandaId es requerido' },
        { status: 400 }
      )
    }

    const comanda = await prisma.comanda.findFirst({
      where: { id: comandaId, restauranteId: user.restauranteId },
      include: { items: true },
    })

    if (!comanda) {
      return NextResponse.json(
        { success: false, error: 'Comanda no encontrada' },
        { status: 404 }
      )
    }

    const itemsPendientes = comanda.items.filter(
      (i) => i.estado !== 'LISTO' && i.estado !== 'ENTREGADO'
    )
    if (itemsPendientes.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No se puede pagar hasta que todos los productos estén marcados como listos.',
        },
        { status: 400 }
      )
    }

    if (comanda.estado === 'PAGADO') {
      return NextResponse.json(
        { success: false, error: 'Esta comanda ya está pagada' },
        { status: 400 }
      )
    }

    const total = comanda.total + (comanda.propina || 0) - (comanda.descuento || 0)
    if (total <= 0) {
      return NextResponse.json(
        { success: false, error: 'El total debe ser mayor a 0' },
        { status: 400 }
      )
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al crear intención de pago'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
