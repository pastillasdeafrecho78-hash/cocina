/**
 * Tipos de la capa de abstracción de pagos (Payment Abstraction Layer).
 * El core y las API no dependen de un proveedor específico.
 */

/** Identificador del proveedor (plugin) de pagos */
export type PaymentProviderId = 'stripe' | 'conekta'

/** Método de pago desde el punto de vista del negocio */
export type MetodoPago =
  | 'tarjeta_credito'
  | 'tarjeta_debito'
  | 'efectivo'
  | 'oxxo'
  | 'spei'
  | 'apple_pay'
  | 'google_pay'

/** Entrada para crear una intención de pago */
export interface CreatePaymentInput {
  comandaId: string
  /** Total a cobrar (en unidad monetaria, ej. MXN) */
  monto: number
  /** Número de comanda para mostrar en el proveedor */
  numeroComanda?: string
  /** Metadata opcional para el proveedor */
  metadata?: Record<string, string>
}

/** Resultado de crear una intención de pago */
export interface CreatePaymentResult {
  /** ID de la intención/pago en el proveedor (ej. pi_xxx de Stripe) */
  paymentId: string
  /** Cliente secret para confirmar en frontend (Stripe Elements, etc.); opcional */
  clientSecret?: string | null
  /** Estado inicial */
  status: 'pending' | 'requires_action' | 'succeeded'
  /** Monto (por si el proveedor lo redondea) */
  amount: number
}

/** Entrada para confirmar un pago (tras éxito en proveedor o webhook) */
export interface ConfirmPaymentInput {
  /** ID del pago en el proveedor (paymentIntentId, charge.id, etc.) */
  paymentId: string
  comandaId: string
  /** Monto cobrado (en unidad monetaria) */
  amount: number
  metodoPago: MetodoPago
  /** Referencia externa (OXXO, SPEI, etc.) */
  referencia?: string | null
  /** Comisión si aplica */
  comision?: number
  /** Datos crudos del proveedor para auditoría */
  detalles?: Record<string, unknown> | null
}

/** Resultado de confirmar un pago (registro en BD + efectos) */
export interface ConfirmPaymentResult {
  /** ID del registro Pago en nuestra BD */
  pagoId: string
  estado: 'COMPLETADO' | 'PENDIENTE' | 'FALLIDO'
  procesadorId: string
}

/** Evento normalizado que emite el proveedor al procesar un webhook */
export interface PaymentConfirmedEvent {
  provider: PaymentProviderId
  paymentId: string
  comandaId: string
  amount: number
  metodoPago: MetodoPago
  referencia?: string | null
  comision?: number
  detalles?: Record<string, unknown> | null
}
