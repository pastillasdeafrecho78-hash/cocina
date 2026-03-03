/**
 * Registro de proveedores de pago. El core obtiene el plugin por nombre.
 */

import type { PaymentProvider } from './provider-interface'
import type { PaymentProviderId } from './types'

const providers = new Map<PaymentProviderId, PaymentProvider>()

export function registerPaymentProvider(provider: PaymentProvider): void {
  providers.set(provider.id, provider)
}

export function getPaymentProvider(id: PaymentProviderId): PaymentProvider | null {
  return providers.get(id) ?? null
}

export function getAvailablePaymentProviders(): PaymentProviderId[] {
  return Array.from(providers.keys())
}
