import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      endpoint: '/api/public/integraciones/pedidos/orders',
      method: 'POST',
      headers: {
        'x-api-key': 'string',
        'x-restaurante-slug': 'string',
      },
      idempotencyKey: 'externalOrderId',
      payload: {
        externalOrderId: 'partner-order-123',
        source: 'whatsapp-bot',
        tipoPedido: 'A_DOMICILIO',
        observaciones: 'Sin cebolla',
        cliente: {
          nombre: 'Juan Perez',
          telefono: '+52...',
          direccion: 'Calle 123',
          notas: 'Tocar timbre',
        },
        items: [
          {
            productoId: 'cuid',
            tamanoId: 'cuid-opcional',
            cantidad: 2,
            notas: 'extra salsa',
          },
        ],
      },
    },
  })
}
