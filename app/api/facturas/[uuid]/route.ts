import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

/**
 * GET /api/facturas/[uuid]
 * Obtiene una factura por su UUID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    const factura = await prisma.factura.findUnique({
      where: { uuid: params.uuid },
      include: {
        comanda: {
          include: {
            mesa: true,
            cliente: true,
          }
        },
        conceptos: {
          include: {
            producto: true,
          }
        }
      }
    })

    if (!factura) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        uuid: factura.uuid,
        folio: factura.folio,
        serie: factura.serie,
        fechaEmision: factura.fechaEmision,
        emisorRfc: factura.emisorRfc,
        receptorNombre: factura.receptorNombre,
        subtotal: factura.subtotal,
        iva: factura.iva,
        total: factura.total,
        qrCode: factura.qrCode,
        xml: factura.xml,
        pdf: factura.pdf,
        conceptos: factura.conceptos,
        comanda: {
          numeroComanda: factura.comanda.numeroComanda,
          mesa: factura.comanda.mesa?.numero,
        }
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
