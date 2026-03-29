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
    const isSupabase = msg.includes('supabase.co')
    const looksLikeDirect5432 =
      msg.includes(':5432') || /supabase\.co:5432/.test(msg)

    const hints: string[] = []

    if (isSupabase && looksLikeDirect5432) {
      hints.push(
        'En Vercel/serverless no uses la conexión directa :5432 de Supabase. En Supabase → Settings → Database → copia la URI del "Transaction pooler" (puerto 6543) y ponla como DATABASE_URL en Vercel. El código añade pgbouncer=true automáticamente con :6543.'
      )
    }

    hints.push(
      'Local: verifica que PostgreSQL esté corriendo y que .env.local tenga DATABASE_URL correcta.',
      'Si las tablas no existen: npm run db:push y npm run db:seed (con la misma URL que producción si aplica).'
    )

    return NextResponse.json(
      {
        ok: false,
        error: 'No se pudo conectar a la base de datos',
        detail: msg,
        hints,
      },
      { status: 503 }
    )
  }

  let tablesOk = false
  let schemaOk = true
  let schemaHint: string | undefined
  try {
    await prisma.usuario.count()
    tablesOk = true
    // Verificar que la columna listoPorDefault existe (migración común no aplicada)
    try {
      await prisma.$queryRaw`SELECT "listoPorDefault" FROM "Producto" LIMIT 1`
    } catch {
      schemaOk = false
      schemaHint =
        'Falta columna Producto.listoPorDefault. Ejecuta el SQL en scripts/fix-listopordefault.sql en tu BD, o: DATABASE_URL="tu-url-prod" npm run db:migrate:deploy'
    }
  } catch {
    // Tablas no creadas
  }

  const jwtOk =
    !!process.env.JWT_SECRET &&
    process.env.JWT_SECRET.length >= 16 &&
    process.env.JWT_SECRET !== 'default-secret-key-change-in-production'

  const ok = hasUrl && tablesOk && schemaOk && jwtOk
  return NextResponse.json({
    ok,
    database: 'conectada',
    tables: tablesOk ? 'ok' : 'no creadas',
    schema: schemaOk ? 'ok' : 'falta listoPorDefault',
    jwt: jwtOk ? 'ok' : 'no_configurado',
    hint: !jwtOk
      ? 'En Vercel: añade JWT_SECRET en Environment Variables (mín. 16 caracteres)'
      : !tablesOk
        ? 'Ejecuta en la raíz del proyecto: npm run db:push y luego npm run db:seed'
        : schemaHint,
  })
}
