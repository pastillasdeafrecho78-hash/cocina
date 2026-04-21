import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClipApiKey } from '@/lib/clip-config'
import { clipPinpadCreatePayment, extractPinpadRequestId } from '@/lib/clip-payclip'
import { getPublicBaseUrl } from '@/lib/public-base-url'
import { listClipTerminals } from '@/lib/clip-terminal-compat'
import { formatClipPaymentErrorForUser } from '@/lib/clip-error-messages'
import { z } from 'zod'
import {
  requireActiveTenant,
  requireAnyCapability,
  requireAuthenticatedUser,
} from '@/lib/authz/guards'
import { toErrorResponse, raise } from '@/lib/authz/http'
import {
  buildFullAllocationFromItems,
  buildRemainingAllocationFromItems,
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

const schema = z.object({
  comandaId: z.string().min(1),
  serialNumber: z.string().min(1).optional(),
  tipAmount: z.number().min(0).optional(),
  allocations: z
    .array(z.object({ comandaItemId: z.string(), cantidad: z.number().int().min(0) }))
    .optional(),
})

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['caja', 'comandas'])
    const tenant = requireActiveTenant(user)
    const rid = tenant.restauranteId
    const body = schema.parse(await request.json())

    const apiKey = await getClipApiKey(rid)
    if (!apiKey) {
      raise(400, 'Clip no configurado o inactivo. Configura la API key en Configuración.')
    }

    const restaurante = await prisma.restaurante.findUnique({
      where: { id: rid },
      select: { slug: true },
    })
    const slug = restaurante?.slug || 'principal'

    const comanda = await prisma.comanda.findFirst({
      where: { id: body.comandaId, restauranteId: rid },
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
    const pendientes = comanda.items.filter(
      (i) => i.estado !== 'LISTO' && i.estado !== 'ENTREGADO',
    )
    if (pendientes.length > 0) {
      raise(400, 'Todos los productos deben estar listos o entregados antes de cobrar.')
    }

    const pagosPrev = await prisma.pago.findMany({
      where: { comandaId: comanda.id, estado: 'COMPLETADO' },
      include: { lineas: true },
    })
    const paidSum = sumPagosCompletadosMonto(pagosPrev)
    const paidQty = paidQuantitiesFromPagos(pagosPrev)
    const totalDue = totalComandaCobrar(comanda)

    let mergedAlloc: AllocationLine[]
    if (!body.allocations || body.allocations.length === 0) {
      mergedAlloc =
        paidSum > 0.01
          ? buildRemainingAllocationFromItems(comanda.items, paidQty)
          : buildFullAllocationFromItems(comanda.items)
    } else {
      mergedAlloc = mergeAllocationsByItem(body.allocations)
    }

    if (mergedAlloc.length === 0) {
      if (debeSaldarComandaYLiberarMesa(comanda.items, pagosPrev, totalDue)) {
        await prisma.comanda.update({
          where: { id: comanda.id },
          data: { estado: 'PAGADO', fechaCompletado: new Date() },
        })
        if (comanda.mesaId) {
          await prisma.mesa.update({
            where: { id: comanda.mesaId },
            data: { estado: 'LIBRE' },
          })
        }
        return NextResponse.json({
          success: true,
          data: {
            sincronizadoSinClip: true,
            mensaje:
              'No había saldo que cobrar con la terminal; la comanda se cerró y la mesa quedó libre.',
          },
        })
      }
      raise(400, 'No hay ítems para asignar a este cobro con Clip.')
    }

    const val = validateAllocations(comanda.items, mergedAlloc, paidQty)
    if (!val.ok) {
      raise(400, val.error)
    }

    const { monto, lineas } = computePagoLineasAndMonto(comanda, comanda.items, mergedAlloc)
    if (monto <= 0 || lineas.length === 0) {
      raise(400, 'Monto de cobro inválido')
    }

    const tip = body.tipAmount ?? 0
    if (wouldExceedTotal(paidSum, monto + tip, totalDue)) {
      raise(400, 'El monto excede el saldo pendiente de la comanda.')
    }

    const terminalesActivas = (await listClipTerminals(prisma, rid))
      .filter((t) => t.activo)
      .sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
        return a.createdAt.getTime() - b.createdAt.getTime()
      })
    if (terminalesActivas.length === 0) {
      raise(400, 'No hay terminales activas. Regístralas en Configuración.')
    }

    let serialSeleccionado = body.serialNumber?.trim() || ''
    if (!serialSeleccionado) {
      if (terminalesActivas.length === 1) {
        serialSeleccionado = terminalesActivas[0].serialNumber
      } else {
        const defaultTerminal = terminalesActivas.find((t) => t.isDefault)
        if (defaultTerminal) {
          serialSeleccionado = defaultTerminal.serialNumber
        } else {
          raise(400, 'Selecciona una terminal para cobrar con tarjeta.')
        }
      }
    }

    const ok = terminalesActivas.find((t) => t.serialNumber === serialSeleccionado)
    if (!ok) {
      raise(400, 'La terminal seleccionada no está activa para este restaurante.')
    }

    const amount = monto

    const pago = await prisma.$transaction(async (tx) => {
      const p = await tx.pago.create({
        data: {
          comandaId: comanda.id,
          monto: amount + tip,
          metodoPago: 'tarjeta_clip',
          procesador: 'clip',
          estado: 'PENDIENTE',
          detalles: {
            serialNumber: serialSeleccionado,
            intentCreatedAt: new Date().toISOString(),
            clipTipExtra: tip > 0 ? tip : undefined,
          } as object,
        },
      })
      await tx.pagoLinea.createMany({
        data: lineas.map((l) => ({
          pagoId: p.id,
          comandaItemId: l.comandaItemId,
          cantidad: l.cantidad,
          importe: l.importe,
        })),
      })
      return p
    })

    const webhook_url = `${getPublicBaseUrl()}/api/webhooks/clip/${encodeURIComponent(slug)}`

    try {
      const clipRes = await clipPinpadCreatePayment({
        apiKey,
        amount,
        tip_amount: tip,
        reference: comanda.id,
        serial_number_pos: serialSeleccionado,
        webhook_url,
      })
      const pinpadId = extractPinpadRequestId(clipRes)
      if (pinpadId) {
        await prisma.pago.update({
          where: { id: pago.id },
          data: {
            procesadorId: pinpadId,
            detalles: {
              ...(pago.detalles as object),
              clipCreateResponse: clipRes,
            } as object,
          },
        })
      }
      return NextResponse.json({
        success: true,
        data: {
          pagoId: pago.id,
          pinpadRequestId: pinpadId,
          serialNumber: serialSeleccionado,
          monto: amount + tip,
          webhook_url,
          clip: clipRes,
        },
      })
    } catch (err: unknown) {
      await prisma.pago.delete({ where: { id: pago.id } }).catch(() => undefined)
      const raw = err instanceof Error ? err.message : String(err)
      return NextResponse.json(
        { success: false, error: formatClipPaymentErrorForUser(raw) },
        { status: 502 },
      )
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
    }
    return toErrorResponse(error, 'Error al preparar el cobro', 'Error en POST /api/clip/crear-intencion:')
  }
}
