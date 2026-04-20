import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireActiveTenant,
  requireAuthenticatedUser,
  requireAnyCapability,
} from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'
import { createMesaPublicCode } from '@/lib/public-mesa-links'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['tables.client_channel', 'tables.view', 'mesas'])
    const tenant = requireActiveTenant(user)

    const mesa = await prisma.mesa.findFirst({
      where: {
        id: params.id,
        restauranteId: tenant.restauranteId,
        activa: true,
      },
      select: {
        id: true,
        numero: true,
        publicLink: {
          select: {
            id: true,
            activa: true,
            expiraEn: true,
            updatedAt: true,
          },
        },
      },
    })
    if (!mesa) {
      return NextResponse.json({ success: false, error: 'Mesa no encontrada' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: mesa.publicLink
        ? {
            hasLink: true,
            ...mesa.publicLink,
          }
        : { hasLink: false },
    })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en GET /api/mesas/[id]/public-link:'
    )
  }
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthenticatedUser()
    requireAnyCapability(user, ['tables.client_channel', 'mesas'])
    const tenant = requireActiveTenant(user)

    const config = await prisma.configuracionRestaurante.findUnique({
      where: { restauranteId: tenant.restauranteId },
      select: { qrMesaEnabled: true },
    })
    if (config && config.qrMesaEnabled === false) {
      return NextResponse.json(
        { success: false, error: 'Los QR por mesa están deshabilitados para esta sucursal' },
        { status: 403 }
      )
    }

    const mesa = await prisma.mesa.findFirst({
      where: { id: params.id, restauranteId: tenant.restauranteId, activa: true },
      select: { id: true, numero: true },
    })
    if (!mesa) {
      return NextResponse.json({ success: false, error: 'Mesa no encontrada' }, { status: 404 })
    }

    const code = createMesaPublicCode()

    await prisma.mesaPublicLink.upsert({
      where: { mesaId: mesa.id },
      update: {
        codeHash: code.hash,
        activa: true,
        expiraEn: null,
      },
      create: {
        restauranteId: tenant.restauranteId,
        mesaId: mesa.id,
        codeHash: code.hash,
        activa: true,
      },
    })

    const restaurante = await prisma.restaurante.findUnique({
      where: { id: tenant.restauranteId },
      select: { slug: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        mesaId: mesa.id,
        mesaNumero: mesa.numero,
        mesaCode: code.raw,
        restauranteSlug: restaurante?.slug ?? null,
      },
    })
  } catch (error) {
    return toErrorResponse(
      error,
      'Error interno del servidor',
      'Error en POST /api/mesas/[id]/public-link:'
    )
  }
}
