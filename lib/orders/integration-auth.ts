import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashSecretToken } from '@/lib/public-ordering'
import { raiseApiError } from '@/lib/orders/public-errors'

type RequiredHeader = 'x-api-key' | 'x-restaurante-slug' | 'x-idempotency-key'

type HeaderValues = {
  apiKey: string
  slug: string
  idempotencyKey?: string
}

export function parseIntegrationHeaders(request: NextRequest, required: RequiredHeader[]): HeaderValues {
  const values: HeaderValues = {
    apiKey: request.headers.get('x-api-key')?.trim() ?? '',
    slug: request.headers.get('x-restaurante-slug')?.trim().toLowerCase() ?? '',
    idempotencyKey: request.headers.get('x-idempotency-key')?.trim() ?? undefined,
  }

  const missing = required.filter((header) => {
    if (header === 'x-api-key') return !values.apiKey
    if (header === 'x-restaurante-slug') return !values.slug
    return !values.idempotencyKey
  })

  if (missing.length > 0) {
    raiseApiError(
      400,
      'invalid_headers',
      `Headers requeridos faltantes: ${missing.join(', ')}`
    )
  }

  return values
}

export async function resolveIntegrationContext(input: { apiKey: string; slug: string }) {
  const restaurante = await prisma.restaurante.findFirst({
    where: { slug: input.slug },
    select: {
      id: true,
      slug: true,
      activo: true,
      integracionPedidosApi: { select: { apiKeyHash: true, activo: true } },
    },
  })

  if (!restaurante) {
    raiseApiError(404, 'branch_not_found', 'Sucursal no encontrada')
  }
  if (!restaurante.activo) {
    raiseApiError(409, 'branch_inactive', 'Sucursal inactiva')
  }
  if (!restaurante.integracionPedidosApi?.activo) {
    raiseApiError(403, 'integration_not_configured', 'Integración no configurada para esta sucursal')
  }

  const providedHash = hashSecretToken(input.apiKey)
  if (providedHash !== restaurante.integracionPedidosApi.apiKeyHash) {
    const keyOwner = await prisma.integracionPedidosApi.findFirst({
      where: {
        apiKeyHash: providedHash,
        activo: true,
      },
      select: {
        restauranteId: true,
      },
    })

    if (keyOwner && keyOwner.restauranteId !== restaurante.id) {
      raiseApiError(
        403,
        'branch_scope_mismatch',
        'API key no autorizada para la sucursal especificada'
      )
    }

    raiseApiError(401, 'invalid_api_key', 'API key inválida')
  }

  return {
    restauranteId: restaurante.id,
    restauranteSlug: restaurante.slug,
  }
}
