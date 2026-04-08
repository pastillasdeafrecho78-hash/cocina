import { NextRequest, NextResponse } from 'next/server'
import { createExternalOrderBodySchema } from '@/lib/orders/public-contract'
import { parseIntegrationHeaders, resolveIntegrationContext } from '@/lib/orders/integration-auth'
import { createExternalOrder } from '@/lib/orders/external-orders-service'
import { jsonError, toCanonicalErrorResponse } from '@/lib/orders/public-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const creds = parseIntegrationHeaders(request, [
      'x-api-key',
      'x-restaurante-slug',
      'x-idempotency-key',
    ])
    const body = await request.json()
    const data = createExternalOrderBodySchema.parse(body)
    if (creds.idempotencyKey !== data.externalOrderId) {
      return jsonError(
        409,
        'idempotency_payload_mismatch',
        'x-idempotency-key debe coincidir con externalOrderId en v1'
      )
    }

    const context = await resolveIntegrationContext({
      apiKey: creds.apiKey,
      slug: creds.slug,
    })

    const result = await createExternalOrder({
      restauranteId: context.restauranteId,
      restauranteSlug: context.restauranteSlug,
      data,
    })

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return toCanonicalErrorResponse(error)
  }
}
