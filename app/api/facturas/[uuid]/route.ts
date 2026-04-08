import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

/**
 * GET /api/facturas/[uuid]
 * Obtiene una factura por su UUID (con scope de tenant)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['reportes', 'caja', 'comandas'])
    const tenant = requireActiveTenant(user)

    const factura = await prisma.factura.findFirst({
      where: {
        uuid: params.uuid,
        comanda: { restauranteId: tenant.restauranteId },
      },
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
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/facturas/[uuid]:')
  }
}
