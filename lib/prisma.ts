import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getPrismaDatabaseUrl() {
  const rawUrl = process.env.DATABASE_URL

  if (!rawUrl) {
    return undefined
  }

  try {
    const url = new URL(rawUrl)
    const isPostgres = url.protocol === 'postgres:' || url.protocol === 'postgresql:'

    if (isPostgres && !url.searchParams.has('sslmode') && !url.searchParams.has('sslaccept')) {
      url.searchParams.set('sslmode', 'require')
    }

    return url.toString()
  } catch {
    return rawUrl
  }
}

const prismaClientOptions = (() => {
  const databaseUrl = getPrismaDatabaseUrl()

  if (!databaseUrl) {
    return undefined
  }

  return {
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  }
})()

export const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaClientOptions)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma








