import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({
  token: z.string().min(16),
  password: z.string().min(8).max(128),
  nombre: z.string().min(1).max(80),
  apellido: z.string().min(1).max(80),
})

function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = schema.parse(body)
    const tokenHash = hashToken(data.token)

    const inv = await prisma.invitacion.findUnique({
      where: { tokenHash },
      include: { restaurante: true, rol: true },
    })

    if (!inv || inv.usadaEn) {
      return NextResponse.json(
        { success: false, error: 'Invitación inválida o ya utilizada' },
        { status: 400 }
      )
    }
    if (inv.expiraEn.getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: 'Invitación expirada' },
        { status: 400 }
      )
    }

    const email = inv.email.toLowerCase()
    const existing = await prisma.usuario.findUnique({
      where: {
        restauranteId_email: { restauranteId: inv.restauranteId, email },
      },
    })
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un usuario con este email en el restaurante' },
        { status: 409 }
      )
    }

    const passwordHash = await hashPassword(data.password)

    await prisma.$transaction(async (tx) => {
      await tx.usuario.create({
        data: {
          email,
          nombre: data.nombre.trim(),
          apellido: data.apellido.trim(),
          password: passwordHash,
          restauranteId: inv.restauranteId,
          rolId: inv.rolId,
        },
      })
      await tx.invitacion.update({
        where: { id: inv.id },
        data: { usadaEn: new Date() },
      })
      if (inv.creadoPorId) {
        await tx.auditoria.create({
          data: {
            restauranteId: inv.restauranteId,
            usuarioId: inv.creadoPorId,
            accion: 'INVITACION_ACEPTADA',
            entidad: 'Invitacion',
            entidadId: inv.id,
            detalles: { email },
          },
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('invites/accept:', error)
    return NextResponse.json(
      { success: false, error: 'Error al aceptar invitación' },
      { status: 500 }
    )
  }
}
