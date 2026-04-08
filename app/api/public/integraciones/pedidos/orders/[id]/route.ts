import { NextRequest, NextResponse } from 'next/server'
import { parseIntegrationHeaders, resolveIntegrationContext } from '@/lib/orders/integration-auth'
import { getExternalOrderStatus } from '@/lib/orders/external-orders-service'
import { toCanonicalErrorResponse } from '@/lib/orders/public-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const creds = parseIntegrationHeaders(request, ['x-api-key', 'x-restaurante-slug'])
    const context = await resolveIntegrationContext({
      apiKey: creds.apiKey,
      slug: creds.slug,
    })

    const result = await getExternalOrderStatus({
      restauranteId: context.restauranteId,
      orderId: params.id,
    })

    return NextResponse.json({
      ...result,
      data: {
        ...result.data,
        restauranteId: context.restauranteId,
        restauranteSlug: context.restauranteSlug,
      },
    })
  } catch (error) {
    return toCanonicalErrorResponse(error)
  }
}
