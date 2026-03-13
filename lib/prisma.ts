import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getPrismaDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL
  if (!raw || typeof raw !== 'string') return undefined

  // Asegurar SSL para Supabase/Postgres en serverless (evitar parsing que puede romper URLs con caracteres especiales)
  if (raw.includes('sslmode=') || raw.includes('sslaccept=')) return raw

  const sep = raw.includes('?') ? '&' : '?'
  let url = raw + sep + 'sslmode=require'

  // Pooler Supabase (puerto 6543) requiere pgbouncer=true para Prisma
  if (url.includes(':6543/') && !url.includes('pgbouncer=')) {
    url += (url.includes('?') ? '&' : '?') + 'pgbouncer=true'
  }

  return url
}

const prismaClientOptions = (() => {
  const url = getPrismaDatabaseUrl()
  if (!url) return undefined
  return { datasources: { db: { url } } }
})()

export const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaClientOptions)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma








