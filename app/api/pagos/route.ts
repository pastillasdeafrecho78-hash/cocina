import { NextRequest, NextResponse } from 'next/server'
import { procesarPago, guardarPago, type MetodoPago } from '@/lib/pagos'
import { timbrarCFDI, almacenarCFDI, generarPDFCFDI } from '@/lib/facturacion'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { raise, toErrorResponse } from '@/lib/authz/http'
import {
  buildFullAllocationFromItems,
  computePagoLineasAndMonto,
  debeSaldarComandaYLiberarMesa,
  mergeAllocationsByItem,
  paidQuantitiesFromPagos,
  sumPagosCompletadosMonto,
  totalComandaCobrar,
  validateAllocations,
  wouldExceedTotal,
  type AllocationLine,
} from '@/lib/split-cuenta'

/**
 * POST /api/pagos
 * Procesa un pago (total o parcial con separación de cuenta) y timbra factura solo al saldar el total.
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
      allocations: rawAllocations,
    } = body as {
      comandaId?: string
      metodo?: string
      datosTarjeta?: unknown
      receptor?: unknown
      detallesEmision?: unknown
      formaPago?: string
      metodoPago?: string
      esFacturaGlobal?: boolean
      allocations?: AllocationLine[]
    }

    if (!comandaId || !metodo) {
      raise(400, 'comandaId y metodo son requeridos')
    }

    const metodoPago = metodo as MetodoPago

    const comanda = await prisma.comanda.findFirst({
      where: { id: comandaId, restauranteId: tenant.restauranteId },
      include: { items: true },
    })

    if (!comanda) {
      raise(404, 'Comanda no encontrada')
    }

    if (comanda.estado === 'PAGADO') {
      raise(400, 'La comanda ya está pagada')
    }
    if (comanda.estado === 'CANCELADO') {
      raise(400, 'La comanda está cancelada')
    }

    const itemsPendientes = comanda.items.filter(
      (i) => i.estado !== 'LISTO' && i.estado !== 'ENTREGADO',
    )
    if (itemsPendientes.length > 0) {
      raise(400, 'No se puede pagar hasta que todos los productos estén marcados como listos.')
    }

    const pagosPrev = await prisma.pago.findMany({
      where: { comandaId, estado: 'COMPLETADO' },
      include: { lineas: true },
    })

    const paidSum = sumPagosCompletadosMonto(pagosPrev)
    const paidQty = paidQuantitiesFromPagos(pagosPrev)
    const totalDue = totalComandaCobrar(comanda)

    let mergedAlloc: AllocationLine[]
    if (!rawAllocations || !Array.isArray(rawAllocations) || rawAllocations.length === 0) {
      if (paidSum > 0.01) {
        raise(400, 'Indica el reparto por ítem (allocations) para pagos parciales.')
      }
      mergedAlloc = buildFullAllocationFromItems(comanda.items)
    } else {
      mergedAlloc = mergeAllocationsByItem(rawAllocations)
    }

    const v = validateAllocations(comanda.items, mergedAlloc, paidQty)
    if (!v.ok) {
      raise(400, v.error)
    }

    const { monto, lineas } = computePagoLineasAndMonto(comanda, comanda.items, mergedAlloc)
    if (monto <= 0 || lineas.length === 0) {
      raise(400, 'Monto de pago inválido')
    }

    if (wouldExceedTotal(paidSum, monto, totalDue)) {
      raise(400, 'El monto excede el saldo pendiente de la comanda.')
    }

    const resultadoPago = await procesarPago({
      comandaId,
      restauranteId: comanda.restauranteId,
      monto,
      metodo: metodoPago,
      datosTarjeta: datosTarjeta as { token: string } | undefined,
    })

    const pago = await guardarPago(
      comandaId,
      resultadoPago,
      metodoPago,
      resultadoPago.estado === 'completado' ? lineas : undefined,
    )

    const pagosTrasPago = await prisma.pago.findMany({
      where: { comandaId, estado: 'COMPLETADO' },
      include: { lineas: true },
    })
    const fullyPaid =
      resultadoPago.estado === 'completado' &&
      debeSaldarComandaYLiberarMesa(comanda.items, pagosTrasPago, totalDue)

    let factura = null
    if (resultadoPago.estado === 'completado') {
      if (fullyPaid) {
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

        // Política CFDI: solo al saldar el total (un comprobante alineado al cierre completo).
        try {
          const cfdi = await timbrarCFDI({
            comandaId,
            receptor: receptor as Parameters<typeof timbrarCFDI>[0]['receptor'],
            formaPago:
              formaPagoOverride ??
              (metodoPago === 'efectivo'
                ? '01'
                : metodoPago === 'tarjeta_credito'
                  ? '04'
                  : metodoPago === 'tarjeta_debito'
                    ? '28'
                    : '03'),
            metodoPago: metodoPagoOverride ?? 'PUE',
            ...(typeof esFacturaGlobal === 'boolean' && { esFacturaGlobal }),
          })
          const pdf = await generarPDFCFDI(cfdi)
          factura = await almacenarCFDI(
            comandaId,
            pago.id,
            { ...cfdi, pdf: pdf.toString('base64') },
            cfdi.conceptos,
            (detallesEmision as Record<string, unknown> | undefined) ?? undefined,
          )
        } catch (errFactura) {
          console.warn('Factura no emitida (PAC no configurado o error):', errFactura)
        }
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
        factura: factura
          ? {
              uuid: factura.uuid,
              folio: factura.folio,
              qr: factura.qrCode,
            }
          : null,
        comandaSaldada: fullyPaid,
      },
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/pagos:')
  }
}
