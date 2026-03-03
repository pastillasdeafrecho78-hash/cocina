/**
 * Interfaz que debe implementar cada plugin de pago (Stripe, Conekta, etc.).
 * El core solo depende de esta interfaz.
 */

import type {
  CreatePaymentInput,
  CreatePaymentResult,
  ConfirmPaymentInput,
  ConfirmPaymentResult,
  PaymentConfirmedEvent,
  PaymentProviderId,
} from './types'

export interface PaymentProvider {
  readonly id: PaymentProviderId

  /**
   * Crea una intención de pago en el proveedor.
   * En Stripe: PaymentIntent; en Conekta: Order, etc.
   */
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>

  /**
   * Confirma/registra un pago ya cobrado (idempotente).
   * Se usa desde el frontend (tras éxito) o desde handleWebhook.
   * Debe crear/actualizar Pago en BD y ejecutar efectos (comanda PAGADO, mesa LIBRE, etc.).
   */
  confirmPayment(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult>

  /**
   * Procesa el payload crudo del webhook del proveedor.
   * Verifica firma, extrae evento de "pago confirmado" y llama a confirmPayment
   * (o devuelve el evento para que el core lo procese).
   * Retorna el evento normalizado si hubo pago confirmado; null si no aplica o falla verificación.
   */
  handleWebhook(rawBody: string | Buffer, signature: string | null): Promise<PaymentConfirmedEvent | null>
}
