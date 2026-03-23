import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyClipWebhookToken } from '@/lib/clip-config'
import { finalizarComandaTrasPagoClip } from '@/lib/clip-finalize'

function parseBody(raw: string): Record<string, unknown> {
  try {
    const j = JSON.parse(raw) as unknown
    if (j && typeof j === 'object' && !Array.isArray(j)) return j as Record<string, unknown>
  } catch {
    /* ignore */
  }
  return {}
}

/**
 * Webhook público. URL: /api/webhooks/clip/{slugRestaurante}
 * Opcional: header x-clip-webhook-secret debe coincidir con el secreto configurado (en claro al guardarlo se compara).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = decodeURIComponent(params.slug)
    const restaurante = await prisma.restaurante.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
    })
    if (!restaurante) {
      return NextResponse.json({ ok: false }, { status: 404 })
    }
    const raw = await request.text()
    const body = parseBody(raw)
    const secretOk = await verifyClipWebhookToken(
      restaurante.id,
      request.headers.get('x-clip-webhook-secret')
    )
    if (!secretOk) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const status = String(
      body.status ?? body.payment_status ?? body.state ?? body.paymentStatus ?? ''
    ).toUpperCase()
    const reference = String(body.reference ?? body.external_reference ?? body.comandaId ?? '')
    const pinpadRequestId = String(
      body.pinpad_request_id ?? body.pinpadRequestId ?? body.payment_id ?? body.id ?? ''
    )

    const completed =
      status === 'COMPLETED' ||
      status === 'APPROVED' ||
      status === 'PAID' ||
      status === 'SUCCESS'

    if (!completed) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    let pago = pinpadRequestId
      ? await prisma.pago.findFirst({
          where: {
            procesador: 'clip',
            procesadorId: pinpadRequestId,
            estado: 'PENDIENTE',
            comanda: { restauranteId: restaurante.id },
          },
        })
      : null

    if (!pago && reference) {
      pago = await prisma.pago.findFirst({
        where: {
          procesador: 'clip',
          comandaId: reference,
          estado: 'PENDIENTE',
          comanda: { restauranteId: restaurante.id },
        },
        orderBy: { createdAt: 'desc' },
      })
    }

    if (!pago) {
      return NextResponse.json({ ok: true, message: 'pago no encontrado o ya procesado' })
    }

    await finalizarComandaTrasPagoClip({
      pagoId: pago.id,
      comandaId: pago.comandaId,
      pinpadRequestId: pinpadRequestId || pago.procesadorId || undefined,
      detallesExtra: { webhook: body },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[webhook clip]', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
