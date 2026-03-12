import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/health
 * Comprueba conexión a la base de datos (útil cuando "no carga la BD").
 */
export async function GET() {
  const hasUrl = !!(
    process.env.DATABASE_URL &&
    process.env.DATABASE_URL.trim().length > 0
  )

  if (!hasUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: 'DATABASE_URL no está configurada',
        hint: 'Crea o edita .env.local con DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/comandas_db"',
      },
      { status: 503 }
    )
  }

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (e: unknown) {
    const err = e as Error
    const msg = err?.message ?? String(e)
    return NextResponse.json(
      {
        ok: false,
        error: 'No se pudo conectar a la base de datos',
        detail: msg,
        hints: [
          'Verifica que PostgreSQL esté corriendo (pgAdmin conectado no basta: el servidor debe estar activo).',
          'Comprueba en .env.local: usuario, contraseña, host (localhost), puerto (5432) y nombre de BD (comandas_db).',
          'Si las tablas no existen, ejecuta: npm run db:push y luego npm run db:seed',
        ],
      },
      { status: 503 }
    )
  }

  let tablesOk = false
  try {
    await prisma.usuario.count()
    tablesOk = true
  } catch {
    // Tablas no creadas
  }

  const jwtOk =
    !!process.env.JWT_SECRET &&
    process.env.JWT_SECRET.length >= 16 &&
    process.env.JWT_SECRET !== 'default-secret-key-change-in-production'

  return NextResponse.json({
    ok: true,
    database: 'conectada',
    tables: tablesOk ? 'ok' : 'no creadas',
    jwt: jwtOk ? 'ok' : 'no_configurado',
    hint: !jwtOk
      ? 'En Vercel: añade JWT_SECRET en Environment Variables (mín. 16 caracteres)'
      : tablesOk
        ? undefined
        : 'Ejecuta en la raíz del proyecto: npm run db:push y luego npm run db:seed',
  })
}
