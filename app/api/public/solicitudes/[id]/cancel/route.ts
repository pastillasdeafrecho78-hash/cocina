import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashSecretToken } from '@/lib/public-ordering'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  token: z.string().min(1),
})

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const json = await request.json().catch(() => null)
    const body = bodySchema.parse(json)
    const tokenHash = hashSecretToken(body.token)

    const updated = await prisma.solicitudPedido.updateMany({
      where: {
        id: params.id,
        publicTokenHash: tokenHash,
        estado: { in: ['PENDIENTE', 'EN_COLA'] },
      },
      data: {
        estado: 'RECHAZADA',
        decisionSource: 'AUTO',
        decisionReason: 'cliente_cancela',
        rechazadaAt: new Date(),
      },
    })

    if (updated.count === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se puede cancelar (token inválido, ya procesada o no está pendiente / en cola).',
        },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true, data: { cancelled: true } })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Payload inválido' }, { status: 400 })
    }
    console.error('Error en POST /api/public/solicitudes/[id]/cancel:', error)
    return NextResponse.json({ success: false, error: 'No se pudo cancelar' }, { status: 500 })
  }
}
