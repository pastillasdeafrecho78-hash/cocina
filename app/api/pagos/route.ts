import { NextRequest, NextResponse } from 'next/server'
import { procesarPago, guardarPago } from '@/lib/pagos'
import { timbrarCFDI, almacenarCFDI, generarPDFCFDI } from '@/lib/facturacion'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'

/**
 * POST /api/pagos
 * Procesa un pago y genera la factura automáticamente
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['caja', 'comandas'])
    const tenant = requireActiveTenant(user)

    const body = await request.json()
    const {
      comandaId,
      metodo,
      datosTarjeta,
      receptor,
      detallesEmision,
      formaPago: formaPagoOverride,
      metodoPago: metodoPagoOverride,
      esFacturaGlobal,
    } = body

    if (!comandaId || !metodo) {
      raise(400, 'comandaId y metodo son requeridos')
    }

    // Obtener comanda con ítems
    const comanda = await prisma.comanda.findFirst({
      where: { id: comandaId, restauranteId: tenant.restauranteId },
      include: { items: true },
    })

    if (!comanda) {
      raise(404, 'Comanda no encontrada')
    }

    const itemsPendientes = comanda.items.filter(
      (i) => i.estado !== 'LISTO' && i.estado !== 'ENTREGADO'
    )
    if (itemsPendientes.length > 0) {
      raise(400, 'No se puede pagar hasta que todos los productos estén marcados como listos.')
    }

    // Calcular monto total: subtotal * (1 + propina%) - descuento
    const totalConPropina = comanda.total * (1 + (comanda.propina || 0) / 100)
    const total = totalConPropina - (comanda.descuento || 0)

    // Procesar pago
    const resultadoPago = await procesarPago({
      comandaId,
      restauranteId: comanda.restauranteId,
      monto: total,
      metodo,
      datosTarjeta,
    })

    // Guardar pago en BD
    const pago = await guardarPago(comandaId, resultadoPago, metodo)

    // Si el pago fue completado: marcar comanda PAGADO y liberar mesa (siempre)
    // La factura es opcional; si el PAC no está configurado, el pago se registra igual
    let factura = null
    if (resultadoPago.estado === 'completado') {
      await prisma.comanda.update({
        where: { id: comandaId },
        data: { estado: 'PAGADO', fechaCompletado: new Date() },
      })
      if (comanda.mesaId) {
        await prisma.mesa.update({
          where: { id: comanda.mesaId },
          data: { estado: 'LIBRE' },
        })
      }

      try {
        const cfdi = await timbrarCFDI({
          comandaId,
          receptor,
          formaPago: formaPagoOverride ?? (metodo === 'efectivo' ? '01' : metodo === 'tarjeta_credito' ? '04' : metodo === 'tarjeta_debito' ? '28' : '03'),
          metodoPago: metodoPagoOverride ?? 'PUE',
          ...(typeof esFacturaGlobal === 'boolean' && { esFacturaGlobal }),
        })
        const pdf = await generarPDFCFDI(cfdi)
        factura = await almacenarCFDI(
          comandaId,
          pago.id,
          { ...cfdi, pdf: pdf.toString('base64') },
          cfdi.conceptos,
          detallesEmision ?? undefined
        )
      } catch (errFactura) {
        console.warn('Factura no emitida (PAC no configurado o error):', errFactura)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        pago: {
          id: pago.id,
          estado: pago.estado,
          monto: pago.monto,
          referencia: pago.referencia,
        },
        factura: factura ? {
          uuid: factura.uuid,
          folio: factura.folio,
          qr: factura.qrCode,
        } : null,
      },
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/pagos:')
  }
}
