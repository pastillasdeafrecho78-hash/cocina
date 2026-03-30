import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { getClipApiKey } from '@/lib/clip-config'
import { clipPinpadCreatePayment, extractPinpadRequestId } from '@/lib/clip-payclip'
import { getPublicBaseUrl } from '@/lib/public-base-url'
import { z } from 'zod'

const schema = z.object({
  comandaId: z.string().min(1),
  serialNumber: z.string().min(1).optional(),
  tipAmount: z.number().min(0).optional(),
})

export const dynamic = 'force-dynamic'

function montoComanda(comanda: { total: number; propina: number | null; descuento: number | null }) {
  const total = comanda.total || 0
  const propina = ((comanda.propina || 0) / 100) * total
  const descuento = comanda.descuento || 0
  return Math.max(0.01, total + propina - descuento)
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || (!tienePermiso(user, 'caja') && !tienePermiso(user, 'comandas'))) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }
    const rid = user.restauranteId
    const body = schema.parse(await request.json())

    const apiKey = await getClipApiKey(rid)
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Clip no configurado o inactivo. Configura la API key en Configuración.' },
        { status: 400 }
      )
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
      return NextResponse.json({ success: false, error: 'Comanda no encontrada' }, { status: 404 })
    }
    if (comanda.estado === 'PAGADO') {
      return NextResponse.json({ success: false, error: 'La comanda ya está pagada' }, { status: 400 })
    }
    const pendientes = comanda.items.filter(
      (i) => i.estado !== 'LISTO' && i.estado !== 'ENTREGADO'
    )
    if (pendientes.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Todos los productos deben estar listos o entregados antes de cobrar.' },
        { status: 400 }
      )
    }

    const terminalesActivas = await prisma.clipTerminal.findMany({
      where: { restauranteId: rid, activo: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })
    if (terminalesActivas.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay terminales activas. Regístralas en Configuración.' },
        { status: 400 }
      )
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
          return NextResponse.json(
            { success: false, error: 'Selecciona una terminal para cobrar con tarjeta.' },
            { status: 400 }
          )
        }
      }
    }

    const ok = terminalesActivas.find((t) => t.serialNumber === serialSeleccionado)
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'La terminal seleccionada no está activa para este restaurante.' },
        { status: 400 }
      )
    }

    const amount = montoComanda(comanda)
    const tip = body.tipAmount ?? 0

    const pago = await prisma.pago.create({
      data: {
        comandaId: comanda.id,
        monto: amount + tip,
        metodoPago: 'tarjeta_clip',
        procesador: 'clip',
        estado: 'PENDIENTE',
        detalles: {
          serialNumber: serialSeleccionado,
          intentCreatedAt: new Date().toISOString(),
        } as object,
      },
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
    } catch (err: any) {
      await prisma.pago.update({
        where: { id: pago.id },
        data: {
          estado: 'FALLIDO',
          detalles: {
            error: err?.message || String(err),
          } as object,
        },
      })
      return NextResponse.json(
        { success: false, error: err?.message || 'Error al crear intención en Clip' },
        { status: 502 }
      )
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
    }
    console.error(e)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}
