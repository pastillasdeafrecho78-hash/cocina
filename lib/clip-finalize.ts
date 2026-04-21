import { prisma } from '@/lib/prisma'
import { timbrarCFDI, almacenarCFDI, generarPDFCFDI } from '@/lib/facturacion'
import { obtenerConfiguracion } from '@/lib/configuracion-restaurante'
import {
  isFullyPaidAfterPayment,
  sumPagosCompletadosMonto,
  totalComandaCobrar,
} from '@/lib/split-cuenta'

/**
 * Tras pago Clip completado: idempotente. Marca pago COMPLETADO.
 * Solo marca comanda PAGADO y libera mesa si el acumulado de pagos completados cubre el total.
 * Timbra CFDI solo en ese cierre total (misma política que POST /api/pagos).
 */
export async function finalizarComandaTrasPagoClip(params: {
  pagoId: string
  comandaId: string
  pinpadRequestId?: string
  detallesExtra?: Record<string, unknown>
}): Promise<{ yaEstaba: boolean }> {
  const pago = await prisma.pago.findUnique({
    where: { id: params.pagoId },
    include: { comanda: { include: { mesa: true, items: true } } },
  })
  if (!pago || pago.comandaId !== params.comandaId) {
    throw new Error('Pago no encontrado')
  }
  if (pago.estado === 'COMPLETADO') {
    return { yaEstaba: true }
  }

  const detalles = {
    ...((pago.detalles as object) || {}),
    ...params.detallesExtra,
    clipPinpadRequestId: params.pinpadRequestId,
    finalizadoAt: new Date().toISOString(),
  }

  const comanda = pago.comanda
  const totalDue = totalComandaCobrar(comanda)

  let saldadaEnEstaTransaccion = false
  await prisma.$transaction(async (tx) => {
    await tx.pago.update({
      where: { id: params.pagoId },
      data: {
        estado: 'COMPLETADO',
        procesadorId: params.pinpadRequestId || pago.procesadorId,
        detalles: detalles as object,
      },
    })

    const pagosCompletados = await tx.pago.findMany({
      where: { comandaId: params.comandaId, estado: 'COMPLETADO' },
    })
    const paidSum = sumPagosCompletadosMonto(pagosCompletados)

    if (isFullyPaidAfterPayment(0, paidSum, totalDue)) {
      saldadaEnEstaTransaccion = true
      await tx.comanda.update({
        where: { id: params.comandaId },
        data: { estado: 'PAGADO', fechaCompletado: new Date() },
      })
      if (comanda.mesaId) {
        await tx.mesa.update({
          where: { id: comanda.mesaId },
          data: { estado: 'LIBRE' },
        })
      }
    }
  })

  if (!saldadaEnEstaTransaccion) {
    return { yaEstaba: false }
  }

  try {
    const config = await obtenerConfiguracion(pago.comanda.restauranteId)
    const puedeTimbrar = Boolean(config?.pacApiKey && config?.csdCerPath && config?.rfc)
    if (!puedeTimbrar) {
      return { yaEstaba: false }
    }

    const cfdi = await timbrarCFDI({
      comandaId: params.comandaId,
      formaPago: '04',
      metodoPago: 'PUE',
      esFacturaGlobal: true,
    })
    const pdf = await generarPDFCFDI(cfdi)
    await almacenarCFDI(
      params.comandaId,
      params.pagoId,
      { ...cfdi, pdf: pdf.toString('base64') },
      cfdi.conceptos,
      undefined,
    )
  } catch (e) {
    console.warn('[Clip] Factura no emitida tras pago:', e)
  }

  return { yaEstaba: false }
}
