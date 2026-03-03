import { NextRequest, NextResponse } from 'next/server'
import { procesarPago, guardarPago } from '@/lib/pagos'
import { timbrarCFDI, almacenarCFDI, generarPDFCFDI } from '@/lib/facturacion'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/pagos
 * Procesa un pago y genera la factura automáticamente
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 401 }
      )
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    const rolesPago = ['CAJERO', 'ADMIN', 'GERENTE', 'MESERO']
    if (!rolesPago.includes(payload.rol)) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para procesar pagos' },
        { status: 403 }
      )
    }

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
      return NextResponse.json(
        { success: false, error: 'comandaId y metodo son requeridos' },
        { status: 400 }
      )
    }

    // Obtener comanda
    const comanda = await prisma.comanda.findUnique({
      where: { id: comandaId },
    })

    if (!comanda) {
      return NextResponse.json(
        { success: false, error: 'Comanda no encontrada' },
        { status: 404 }
      )
    }

    // Calcular monto total
    const total = comanda.total + (comanda.propina || 0) - (comanda.descuento || 0)

    // Procesar pago
    const resultadoPago = await procesarPago({
      comandaId,
      monto: total,
      metodo,
      datosTarjeta,
    })

    // Guardar pago en BD
    const pago = await guardarPago(comandaId, resultadoPago, metodo)

    // Si el pago fue completado, generar factura
    let factura = null
    if (resultadoPago.estado === 'completado') {
      // Timbrar CFDI (override desde Asistente Modo Fácil si se envían)
      const cfdi = await timbrarCFDI({
        comandaId,
        receptor,
        formaPago: formaPagoOverride ?? (metodo === 'efectivo' ? '01' : metodo === 'tarjeta_credito' ? '04' : metodo === 'tarjeta_debito' ? '28' : '03'),
        metodoPago: metodoPagoOverride ?? 'PUE',
        ...(typeof esFacturaGlobal === 'boolean' && { esFacturaGlobal }),
      })

      // Generar PDF
      const pdf = await generarPDFCFDI(cfdi)

      // Almacenar CFDI con conceptos (detallesEmision = log Modo Fácil para auditoría)
      factura = await almacenarCFDI(
        comandaId,
        pago.id,
        { ...cfdi, pdf: pdf.toString('base64') },
        cfdi.conceptos,
        detallesEmision ?? undefined
      )

      // Actualizar comanda
      await prisma.comanda.update({
        where: { id: comandaId },
        data: {
          estado: 'PAGADO',
        },
      })

      // Si tiene mesa, liberarla
      if (comanda.mesaId) {
        await prisma.mesa.update({
          where: { id: comanda.mesaId },
          data: {
            estado: 'LIBRE',
          },
        })
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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
