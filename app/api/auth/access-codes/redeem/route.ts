import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashAccessCode, normalizeAccessCode } from '@/lib/access-code'
import { requireAuthenticatedUser } from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({
  code: z.string().min(4).max(64),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser()
    const { code } = schema.parse(await request.json())
    const normalized = normalizeAccessCode(code)
    const hash = hashAccessCode(normalized)
    const now = new Date()

    const codeRow = await prisma.codigoVinculacionSucursal.findUnique({
      where: { codigoHash: hash },
      include: {
        restaurante: { select: { id: true, nombre: true, organizacionId: true } },
      },
    })

    if (!codeRow) {
      return NextResponse.json({ success: false, error: 'Código inválido' }, { status: 404 })
    }
    if (codeRow.usadaEn) {
      return NextResponse.json(
        { success: false, error: 'Este código ya fue usado' },
        { status: 409 }
      )
    }
    if (codeRow.expiraEn < now) {
      return NextResponse.json(
        { success: false, error: 'Este código ya expiró' },
        { status: 410 }
      )
    }

    const membershipRolId = codeRow.rolId ?? user.rolId

    await prisma.$transaction(async (tx) => {
      const consume = await tx.codigoVinculacionSucursal.updateMany({
        where: { id: codeRow.id, usadaEn: null },
        data: { usadaEn: now },
      })
      if (consume.count === 0) {
        throw new Error('CODIGO_YA_CONSUMIDO')
      }

      await tx.sucursalMiembro.upsert({
        where: {
          usuarioId_restauranteId: {
            usuarioId: user.id,
            restauranteId: codeRow.restauranteId,
          },
        },
        create: {
          usuarioId: user.id,
          restauranteId: codeRow.restauranteId,
          rolId: membershipRolId,
          activo: true,
          esPrincipal: false,
        },
        update: { activo: true, rolId: membershipRolId },
      })

      const orgId = codeRow.organizacionId ?? codeRow.restaurante.organizacionId
      if (orgId) {
        await tx.organizacionMiembro.upsert({
          where: {
            usuarioId_organizacionId: {
              usuarioId: user.id,
              organizacionId: orgId,
            },
          },
          create: {
            usuarioId: user.id,
            organizacionId: orgId,
            rolId: membershipRolId,
            activo: true,
          },
          update: { activo: true, rolId: membershipRolId },
        })
      }

      await tx.usuario.update({
        where: { id: user.id },
        data: {
          // LEGACY_AUTHZ_DEBT: mantener restauranteId/rolId por compatibilidad hasta deprecación total.
          restauranteId: codeRow.restauranteId,
          activeRestauranteId: codeRow.restauranteId,
          activeOrganizacionId: orgId ?? null,
          ...(codeRow.rolId ? { rolId: codeRow.rolId } : {}),
        },
      })
    })

    return NextResponse.json({
      success: true,
      data: {
        restauranteId: codeRow.restauranteId,
        restauranteNombre: codeRow.restaurante.nombre,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'CODIGO_YA_CONSUMIDO') {
      return NextResponse.json({ success: false, error: 'Este código ya fue canjeado' }, { status: 409 })
    }
    return toErrorResponse(error, 'No se pudo canjear el código', 'POST /api/auth/access-codes/redeem')
  }
}
