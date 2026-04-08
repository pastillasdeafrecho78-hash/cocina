import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      createOrder: {
        endpoint: '/api/public/integraciones/pedidos/orders',
        method: 'POST',
        headers: {
          'x-api-key': 'string',
          'x-restaurante-slug': 'string',
          'x-idempotency-key': 'string (must match externalOrderId in v1)',
          'x-api-version': 'v1 (optional)',
          'x-correlation-id': 'string (optional)',
        },
        payload: {
          externalOrderId: 'partner-order-123',
          source: 'whatsapp-bot',
          canal: 'EXTERNAL_APP',
          tipoPedido: 'A_DOMICILIO | PARA_LLEVAR | WHATSAPP | DELIVERY',
          catalogVersion: '2026-04-08T00:00:00Z',
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
              modificadores: [{ modificadorId: 'cuid-mod' }],
            },
          ],
        },
      },
      getOrderStatus: {
        endpoint: '/api/public/integraciones/pedidos/orders/:id',
        method: 'GET',
        headers: {
          'x-api-key': 'string',
          'x-restaurante-slug': 'string',
        },
      },
      errorCodes: [
        'invalid_headers',
        'invalid_api_key',
        'branch_scope_mismatch',
        'branch_not_found',
        'branch_inactive',
        'integration_not_configured',
        'invalid_payload',
        'invalid_item_scope',
        'idempotency_payload_mismatch',
        'duplicate_external_order',
        'order_not_found',
        'internal_error',
      ],
      idempotency: {
        strategy: 'externalOrderId + x-idempotency-key (must match in v1)',
        duplicateResponse: '200 with data.idempotent=true',
      },
    },
  })
}
