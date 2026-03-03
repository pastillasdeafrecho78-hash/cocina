/**
 * Payment Abstraction Layer — punto de entrada.
 * Exporta tipos, interfaz, registro y efectos; registra los plugins al importar.
 */

export * from './types'
export type { PaymentProvider } from './provider-interface'
export {
  registerPaymentProvider,
  getPaymentProvider,
  getAvailablePaymentProviders,
} from './registry'
export { onPaymentConfirmed } from './on-payment-confirmed'

import { registerPaymentProvider } from './registry'
import { stripeProvider } from './providers/stripe'
import { conektaProvider } from './providers/conekta'

registerPaymentProvider(stripeProvider)
registerPaymentProvider(conektaProvider)
