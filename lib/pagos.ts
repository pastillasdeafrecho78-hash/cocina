import { obtenerConfiguracion } from './configuracion-restaurante'
import { prisma } from './prisma'

/**
 * Tipos de métodos de pago
 */
export type MetodoPago = 
  | 'tarjeta_credito'
  | 'tarjeta_debito'
  | 'efectivo'
  | 'oxxo'
  | 'spei'
  | 'apple_pay'
  | 'google_pay'

/**
 * Datos para procesar un pago
 */
export interface DatosPago {
  comandaId: string
  restauranteId: string
  monto: number
  metodo: MetodoPago
  datosTarjeta?: {
    token: string // Token de Conekta
  }
  referenciaOXXO?: string
  referenciaSPEI?: string
}

/**
 * Resultado de un pago procesado
 */
export interface ResultadoPago {
  id: string // ID del procesador
  estado: 'completado' | 'pendiente' | 'fallido'
  monto: number
  comision: number
  referencia?: string
  fecha: Date
  detalles?: any
}

/**
 * Procesa un pago usando Conekta
 */
export async function procesarPago(datos: DatosPago): Promise<ResultadoPago> {
  // Efectivo no requiere procesador ni configuración
  if (datos.metodo === 'efectivo') {
    return {
      id: `cash-${Date.now()}`,
      estado: 'completado',
      monto: datos.monto,
      comision: 0,
      fecha: new Date(),
    }
  }

  const config = await obtenerConfiguracion(datos.restauranteId)
  if (!config || !config.conektaPrivateKey) {
    throw new Error('Procesador de pagos no configurado. Configure Conekta para tarjeta/OXXO/SPEI.')
  }

  if (datos.metodo === 'oxxo') {
    // Generar referencia OXXO
    const referencia = `OXXO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    return {
      id: `oxxo-${Date.now()}`,
      estado: 'pendiente',
      monto: datos.monto,
      comision: 10, // $10 MXN por transacción OXXO
      referencia,
      fecha: new Date(),
    }
  }

  if (datos.metodo === 'spei') {
    // Generar referencia SPEI
    const referencia = `SPEI-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    return {
      id: `spei-${Date.now()}`,
      estado: 'pendiente',
      monto: datos.monto,
      comision: 5, // $5 MXN por transacción SPEI
      referencia,
      fecha: new Date(),
    }
  }

  // Para tarjetas, Apple Pay, Google Pay - requiere integración con Conekta
  if (datos.metodo === 'tarjeta_credito' || datos.metodo === 'tarjeta_debito' || 
      datos.metodo === 'apple_pay' || datos.metodo === 'google_pay') {
    
    if (!datos.datosTarjeta?.token) {
      throw new Error('Token de tarjeta requerido')
    }
    const tokenTarjeta = datos.datosTarjeta.token

    // Inicializar Conekta
    const conektaModule = (await import('conekta')) as any
    const Conekta = conektaModule.default ?? conektaModule

    Conekta.apiKey = config.conektaPrivateKey
    Conekta.apiVersion = config.conektaApiVersion || '2.0'

    try {
      // Crear orden en Conekta
      const order = await new Promise((resolve, reject) => {
        Conekta.Order.create({
          currency: 'MXN',
          metadata: {
            restauranteId: datos.restauranteId,
            comandaId: datos.comandaId,
          },
          customer_info: {
            name: 'Cliente',
            email: 'cliente@example.com',
          },
          line_items: [{
            name: `Comanda ${datos.comandaId}`,
            unit_price: Math.round(datos.monto * 100), // En centavos
            quantity: 1,
          }],
          charges: [{
            payment_method: {
              type: 'card',
              token_id: tokenTarjeta,
            }
          }]
        }, (err: any, res: any) => {
          if (err) reject(err)
          else resolve(res)
        })
      }) as any

      const charge = order.charges.data[0]
      const comision = (charge.payment_method.fee || 0) / 100 // Convertir de centavos a pesos

      return {
        id: charge.id,
        estado: charge.status === 'paid' ? 'completado' : 'pendiente',
        monto: datos.monto,
        comision,
        fecha: new Date(),
        detalles: order,
      }
    } catch (error: any) {
      console.error('Error procesando pago con Conekta:', error)
      throw new Error(`Error al procesar pago: ${error.message || 'Error desconocido'}`)
    }
  }

  throw new Error(`Método de pago no soportado: ${datos.metodo}`)
}

/**
 * Guarda un pago en la base de datos
 */
export async function guardarPago(
  comandaId: string,
  resultado: ResultadoPago,
  metodo: MetodoPago
) {
  return await prisma.pago.create({
    data: {
      comandaId,
      monto: resultado.monto,
      metodoPago: metodo,
      procesador: 'conekta',
      procesadorId: resultado.id,
      estado: resultado.estado === 'completado' ? 'COMPLETADO' : 
              resultado.estado === 'pendiente' ? 'PENDIENTE' : 'FALLIDO',
      comision: resultado.comision,
      referencia: resultado.referencia || null,
    }
  })
}

/**
 * Verifica el estado de un pago pendiente (OXXO, SPEI)
 */
export async function verificarPagoPendiente(pagoId: string): Promise<ResultadoPago | null> {
  const pago = await prisma.pago.findUnique({
    where: { id: pagoId }
  })

  if (!pago || pago.estado !== 'PENDIENTE') {
    return null
  }

  // TODO: Consultar estado en Conekta
  // Por ahora retornamos null (no hay cambios)
  return null
}
