import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashSecretToken } from '@/lib/public-ordering'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { code: string } }) {
  try {
    const code = params.code?.trim()
    if (!code) {
      return NextResponse.json({ success: false, error: 'Código de mesa inválido' }, { status: 400 })
    }

    const mesaLink = await prisma.mesaPublicLink.findFirst({
      where: {
        codeHash: hashSecretToken(code),
        activa: true,
        OR: [{ expiraEn: null }, { expiraEn: { gt: new Date() } }],
        restaurante: { activo: true },
        mesa: { activa: true },
      },
      select: {
        mesa: {
          select: {
            id: true,
            numero: true,
          },
        },
        restaurante: {
          select: {
            id: true,
            nombre: true,
            slug: true,
            configuracion: {
              select: { qrMesaEnabled: true },
            },
          },
        },
      },
    })

    if (!mesaLink) {
      return NextResponse.json({ success: false, error: 'Código de mesa inválido o expirado' }, { status: 404 })
    }
    if (mesaLink.restaurante.configuracion && mesaLink.restaurante.configuracion.qrMesaEnabled === false) {
      return NextResponse.json(
        { success: false, error: 'Los pedidos por QR de mesa están deshabilitados' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        mesa: mesaLink.mesa,
        restaurante: {
          id: mesaLink.restaurante.id,
          nombre: mesaLink.restaurante.nombre,
          slug: mesaLink.restaurante.slug,
        },
      },
    })
  } catch (error) {
    console.error('Error en GET /api/public/mesas/[code]:', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo validar el código de mesa' },
      { status: 500 }
    )
  }
}
