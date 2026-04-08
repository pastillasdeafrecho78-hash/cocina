import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireActiveTenant, requireAuthenticatedUser } from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'
import { tienePermiso } from '@/lib/permisos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  status: z.enum(['PENDIENTE', 'CONFIRMADA', 'ASIGNADA', 'CANCELADA', 'COMPLETADA']).optional(),
  notes: z.string().trim().max(300).optional(),
  reservedFor: z.string().datetime().optional(),
  durationMinutes: z.coerce.number().int().min(30).max(360).optional(),
  mesaId: z.string().min(1).nullable().optional(),
})

async function ensureReservationsTable() {
  await prisma.$executeRawUnsafe(`
    create table if not exists "Reservacion" (
      "id" text primary key,
      "restauranteId" text not null,
      "mesaId" text null,
      "ownerUserId" text null,
      "createdByUserId" text not null,
      "clienteNombre" text not null,
      "clienteEmail" text null,
      "clienteTelefono" text null,
      "partySize" integer not null,
      "reservedFor" timestamp without time zone not null,
      "durationMinutes" integer not null default 90,
      "status" text not null default 'PENDIENTE',
      "notes" text null,
      "createdAt" timestamp without time zone not null default current_timestamp,
      "updatedAt" timestamp without time zone not null default current_timestamp
    )
  `)
  await prisma.$executeRawUnsafe(`
    create index if not exists "Reservacion_restauranteId_idx" on "Reservacion" ("restauranteId")
  `)
  await prisma.$executeRawUnsafe(`
    create index if not exists "Reservacion_reservedFor_idx" on "Reservacion" ("reservedFor")
  `)
  await prisma.$executeRawUnsafe(`
    create index if not exists "Reservacion_status_idx" on "Reservacion" ("status")
  `)
}

async function existsOverlap(input: {
  restauranteId: string
  reservationId: string
  mesaId: string
  reservedFor: Date
  durationMinutes: number
}) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    select "id"
    from "Reservacion"
    where "restauranteId" = ${input.restauranteId}
      and "id" != ${input.reservationId}
      and "mesaId" = ${input.mesaId}
      and "status" in (${Prisma.join(['PENDIENTE', 'CONFIRMADA', 'ASIGNADA'])})
      and "reservedFor" < ${new Date(input.reservedFor.getTime() + input.durationMinutes * 60_000)}
      and ("reservedFor" + make_interval(mins => "durationMinutes")) > ${input.reservedFor}
    limit 1
  `)
  return Boolean(rows[0])
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureReservationsTable()
    const user = await requireAuthenticatedUser()
    const tenant = requireActiveTenant(user)
    if (!(tienePermiso(user, 'reservations.view') || tienePermiso(user, 'mesas') || tienePermiso(user, 'settings.manage'))) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }
    const { id } = await context.params
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      select r.*, m."numero" as "mesaNumero"
      from "Reservacion" r
      left join "Mesa" m on m."id" = r."mesaId"
      where r."id" = ${id}
        and r."restauranteId" = ${tenant.restauranteId}
      limit 1
    `)
    if (!rows[0]) return NextResponse.json({ success: false, error: 'Reservacion no encontrada' }, { status: 404 })
    return NextResponse.json({ success: true, data: rows[0] })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/reservaciones/[id]:')
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureReservationsTable()
    const user = await requireAuthenticatedUser()
    const tenant = requireActiveTenant(user)
    const { id } = await context.params
    const body = updateSchema.parse(await request.json())

    const rows = await prisma.$queryRaw<
      Array<{
        id: string
        restauranteId: string
        ownerUserId: string | null
        mesaId: string | null
        status: string
        reservedFor: Date
        durationMinutes: number
      }>
    >(Prisma.sql`
      select "id","restauranteId","ownerUserId","mesaId","status","reservedFor","durationMinutes"
      from "Reservacion"
      where "id" = ${id}
      limit 1
    `)
    const current = rows[0]
    if (!current || current.restauranteId !== tenant.restauranteId) {
      return NextResponse.json({ success: false, error: 'Reservacion no encontrada' }, { status: 404 })
    }

    const canManage = tienePermiso(user, 'reservations.manage') || tienePermiso(user, 'settings.manage')
    const isOwner = current.ownerUserId === user.id
    if (!canManage && !isOwner) {
      return NextResponse.json({ success: false, error: 'Sin permisos para modificar esta reservacion' }, { status: 403 })
    }
    if (!canManage && body.status && body.status !== 'CANCELADA') {
      return NextResponse.json({ success: false, error: 'Solo puedes cancelar tu propia reservacion' }, { status: 403 })
    }

    const nextReservedFor = body.reservedFor ? new Date(body.reservedFor) : current.reservedFor
    const nextDuration = body.durationMinutes ?? current.durationMinutes
    const nextMesaId = typeof body.mesaId !== 'undefined' ? body.mesaId : current.mesaId
    if (nextMesaId) {
      const hasConflict = await existsOverlap({
        restauranteId: tenant.restauranteId,
        reservationId: current.id,
        mesaId: nextMesaId,
        reservedFor: nextReservedFor,
        durationMinutes: nextDuration,
      })
      if (hasConflict) {
        return NextResponse.json({ success: false, error: 'La mesa no esta disponible en ese horario' }, { status: 409 })
      }
    }

    await prisma.$executeRaw(
      Prisma.sql`
        update "Reservacion"
        set
          "status" = ${body.status ?? current.status},
          "notes" = ${typeof body.notes === 'undefined' ? null : body.notes},
          "reservedFor" = ${nextReservedFor},
          "durationMinutes" = ${nextDuration},
          "mesaId" = ${nextMesaId ?? null},
          "updatedAt" = ${new Date()}
        where "id" = ${current.id}
      `
    )

    await prisma.auditoria.create({
      data: {
        restauranteId: tenant.restauranteId,
        usuarioId: user.id,
        accion: 'ACTUALIZAR_RESERVACION',
        entidad: 'Reservacion',
        entidadId: current.id,
        detalles: {
          status: body.status ?? current.status,
          mesaId: nextMesaId ?? null,
        },
      },
    })

    return NextResponse.json({ success: true, data: { id: current.id } })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en PATCH /api/reservaciones/[id]:')
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureReservationsTable()
    const user = await requireAuthenticatedUser()
    const tenant = requireActiveTenant(user)
    const { id } = await context.params
    const canManage = tienePermiso(user, 'reservations.manage') || tienePermiso(user, 'settings.manage')
    const rows = await prisma.$queryRaw<Array<{ id: string; ownerUserId: string | null; restauranteId: string }>>(Prisma.sql`
      select "id","ownerUserId","restauranteId"
      from "Reservacion"
      where "id" = ${id}
      limit 1
    `)
    const current = rows[0]
    if (!current || current.restauranteId !== tenant.restauranteId) {
      return NextResponse.json({ success: false, error: 'Reservacion no encontrada' }, { status: 404 })
    }
    if (!canManage && current.ownerUserId !== user.id) {
      return NextResponse.json({ success: false, error: 'Sin permisos para cancelar esta reservacion' }, { status: 403 })
    }
    await prisma.$executeRaw(
      Prisma.sql`
        update "Reservacion"
        set "status" = 'CANCELADA', "updatedAt" = ${new Date()}
        where "id" = ${current.id}
      `
    )
    await prisma.auditoria.create({
      data: {
        restauranteId: tenant.restauranteId,
        usuarioId: user.id,
        accion: 'CANCELAR_RESERVACION',
        entidad: 'Reservacion',
        entidadId: current.id,
        detalles: { hardDelete: false },
      },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en DELETE /api/reservaciones/[id]:')
  }
}
