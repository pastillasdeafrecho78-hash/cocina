import { prisma } from '@/lib/prisma'
import { timbrarCFDI, almacenarCFDI, generarPDFCFDI } from '@/lib/facturacion'

/**
 * Tras pago Clip completado: idempotente. Marca pago, comanda PAGADO, mesa libre; timbra factura global si PAC configurado.
 */
export async function finalizarComandaTrasPagoClip(params: {
  pagoId: string
  comandaId: string
  pinpadRequestId?: string
  detallesExtra?: Record<string, unknown>
}): Promise<{ yaEstaba: boolean }> {
  const pago = await prisma.pago.findUnique({
    where: { id: params.pagoId },
    include: { comanda: { include: { mesa: true } } },
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

  await prisma.$transaction(async (tx) => {
    await tx.pago.update({
      where: { id: params.pagoId },
      data: {
        estado: 'COMPLETADO',
        procesadorId: params.pinpadRequestId || pago.procesadorId,
        detalles: detalles as object,
      },
    })
    await tx.comanda.update({
      where: { id: params.comandaId },
      data: { estado: 'PAGADO', fechaCompletado: new Date() },
    })
    const comanda = pago.comanda
    if (comanda.mesaId) {
      await tx.mesa.update({
        where: { id: comanda.mesaId },
        data: { estado: 'LIBRE' },
      })
    }
  })

  try {
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
      undefined
    )
  } catch (e) {
    console.warn('[Clip] Factura no emitida tras pago:', e)
  }

  return { yaEstaba: false }
}
