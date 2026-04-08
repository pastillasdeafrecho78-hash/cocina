import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireActiveTenant, requireAuthenticatedUser } from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'
import { tienePermiso } from '@/lib/permisos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const reservationSchema = z.object({
  clienteNombre: z.string().trim().min(2).max(120),
  clienteEmail: z.string().trim().email().max(190).optional(),
  clienteTelefono: z.string().trim().min(7).max(30).optional(),
  partySize: z.coerce.number().int().min(1).max(30),
  reservedFor: z.string().datetime(),
  durationMinutes: z.coerce.number().int().min(30).max(360).default(90),
  notes: z.string().trim().max(300).optional(),
  mesaId: z.string().min(1).optional(),
})

const ACTIVE_STATUSES = ['PENDIENTE', 'CONFIRMADA', 'ASIGNADA'] as const

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

async function pickAvailableMesa(input: {
  restauranteId: string
  partySize: number
  reservedFor: Date
  durationMinutes: number
}) {
  const mesas = await prisma.mesa.findMany({
    where: {
      restauranteId: input.restauranteId,
      activa: true,
      capacidad: { gte: input.partySize },
    },
    orderBy: [{ capacidad: 'asc' }, { numero: 'asc' }],
    select: { id: true, numero: true, capacidad: true },
  })
  if (!mesas.length) return null

  for (const mesa of mesas) {
    const overlaps = await prisma.$queryRaw<Array<{ id: string }>>`
      select "id"
      from "Reservacion"
      where "restauranteId" = ${input.restauranteId}
        and "mesaId" = ${mesa.id}
        and "status" in (${Prisma.join(ACTIVE_STATUSES)})
        and "reservedFor" < ${new Date(input.reservedFor.getTime() + input.durationMinutes * 60_000)}
        and ("reservedFor" + make_interval(mins => "durationMinutes")) > ${input.reservedFor}
      limit 1
    `
    if (!overlaps[0]) return mesa
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    await ensureReservationsTable()
    const user = await requireAuthenticatedUser()
    const tenant = requireActiveTenant(user)
    const canView = tienePermiso(user, 'reservations.view') || tienePermiso(user, 'mesas') || tienePermiso(user, 'settings.manage')
    if (!canView) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const url = new URL(request.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      select
        r."id",
        r."restauranteId",
        r."mesaId",
        r."ownerUserId",
        r."createdByUserId",
        r."clienteNombre",
        r."clienteEmail",
        r."clienteTelefono",
        r."partySize",
        r."reservedFor",
        r."durationMinutes",
        r."status",
        r."notes",
        r."createdAt",
        r."updatedAt",
        m."numero" as "mesaNumero"
      from "Reservacion" r
      left join "Mesa" m on m."id" = r."mesaId"
      where r."restauranteId" = ${tenant.restauranteId}
        ${from ? Prisma.sql`and r."reservedFor" >= ${new Date(from)}` : Prisma.empty}
        ${to ? Prisma.sql`and r."reservedFor" <= ${new Date(to)}` : Prisma.empty}
      order by r."reservedFor" asc
      limit 300
    `)
    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en GET /api/reservaciones:')
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureReservationsTable()
    const user = await requireAuthenticatedUser()
    const tenant = requireActiveTenant(user)
    const canCreate = tienePermiso(user, 'reservations.manage') || tienePermiso(user, 'mesas') || tienePermiso(user, 'settings.manage')
    if (!canCreate) {
      return NextResponse.json({ success: false, error: 'Sin permisos para crear reservaciones' }, { status: 403 })
    }

    const body = reservationSchema.parse(await request.json())
    const reservedFor = new Date(body.reservedFor)
    if (reservedFor.getTime() < Date.now() - 5 * 60_000) {
      return NextResponse.json({ success: false, error: 'La reservacion no puede ser en el pasado' }, { status: 400 })
    }

    let mesaId = body.mesaId ?? null
    if (!mesaId) {
      const picked = await pickAvailableMesa({
        restauranteId: tenant.restauranteId,
        partySize: body.partySize,
        reservedFor,
        durationMinutes: body.durationMinutes,
      })
      if (!picked) {
        return NextResponse.json({ success: false, error: 'No hay mesas disponibles para ese horario' }, { status: 409 })
      }
      mesaId = picked.id
    }

    const id = randomUUID()
    await prisma.$executeRawUnsafe(
      `
        insert into "Reservacion" (
          "id","restauranteId","mesaId","ownerUserId","createdByUserId",
          "clienteNombre","clienteEmail","clienteTelefono","partySize",
          "reservedFor","durationMinutes","status","notes","createdAt","updatedAt"
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'CONFIRMADA',$12,now(),now()
        )
      `,
      id,
      tenant.restauranteId,
      mesaId,
      user.id,
      user.id,
      body.clienteNombre,
      body.clienteEmail ?? null,
      body.clienteTelefono ?? null,
      body.partySize,
      reservedFor.toISOString(),
      body.durationMinutes,
      body.notes ?? null
    )

    await prisma.auditoria.create({
      data: {
        restauranteId: tenant.restauranteId,
        usuarioId: user.id,
        accion: 'CREAR_RESERVACION',
        entidad: 'Reservacion',
        entidadId: id,
        detalles: {
          mesaId,
          reservedFor: reservedFor.toISOString(),
          partySize: body.partySize,
        },
      },
    })

    return NextResponse.json({ success: true, data: { id } }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en POST /api/reservaciones:')
  }
}
