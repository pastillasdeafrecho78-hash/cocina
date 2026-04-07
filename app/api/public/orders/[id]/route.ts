import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashSecretToken } from '@/lib/public-ordering'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token de seguimiento requerido' },
        { status: 400 }
      )
    }
    const tokenHash = hashSecretToken(token)

    const comanda = await prisma.comanda.findFirst({
      where: {
        id: params.id,
        origen: 'PUBLIC_LINK',
        publicTokenHash: tokenHash,
      },
      select: {
        id: true,
        numeroComanda: true,
        estado: true,
        tipoPedido: true,
        total: true,
        fechaCreacion: true,
        fechaEntrega: true,
        restaurante: {
          select: {
            nombre: true,
          },
        },
        items: {
          select: {
            id: true,
            cantidad: true,
            estado: true,
            precioUnitario: true,
            subtotal: true,
            producto: {
              select: { nombre: true },
            },
            tamano: {
              select: { nombre: true },
            },
          },
        },
      },
    })

    if (!comanda) {
      return NextResponse.json(
        { success: false, error: 'Pedido no encontrado o token inválido' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: comanda })
  } catch (error) {
    console.error('Error en GET /api/public/orders/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo consultar el pedido' },
      { status: 500 }
    )
  }
}
