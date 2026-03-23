/**
 * Migración: enum Rol -> modelo Rol con permisos
 * Ejecutar: npx tsx scripts/migrate-roles.ts
 * Requiere: DATABASE_URL en .env
 *
 * Pasos:
 * 1. Crear tabla Rol e insertar 6 roles
 * 2. Agregar columna rolId a Usuario
 * 3. Actualizar Usuario.rolId según Usuario.rol (enum)
 * 4. Eliminar columna rol
 * 5. Agregar FK y constraint
 */
import { PrismaClient } from '@prisma/client'

const ROLES = [
  {
    codigo: 'ADMIN',
    nombre: 'Administrador',
    descripcion: 'Acceso total al sistema',
    permisos: ['*'],
  },
  {
    codigo: 'GERENTE',
    nombre: 'Gerente',
    descripcion: 'Gestión operativa y reportes',
    permisos: ['mesas', 'comandas', 'carta', 'cocina', 'barra', 'reportes', 'caja'],
  },
  {
    codigo: 'CAJERO',
    nombre: 'Cajero',
    descripcion: 'Caja, reportes y cobro',
    permisos: ['mesas', 'comandas', 'reportes', 'caja'],
  },
  {
    codigo: 'MESERO',
    nombre: 'Mesero',
    descripcion: 'Mesas y comandas',
    permisos: ['mesas', 'comandas', 'reportes'],
  },
  {
    codigo: 'COCINERO',
    nombre: 'Cocinero',
    descripcion: 'Cocina KDS',
    permisos: ['cocina'],
  },
  {
    codigo: 'BARTENDER',
    nombre: 'Bartender',
    descripcion: 'Barra KDS',
    permisos: ['barra'],
  },
]

async function main() {
  const prisma = new PrismaClient()

  try {
    // 1. Verificar si ya migrado (Usuario tiene rolId)
    const columnasUsuario = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Usuario'`
    )
    if (columnasUsuario.some((c) => c.column_name === 'rolId')) {
      console.log('Migración ya aplicada (Usuario.rolId existe). Saltando.')
      return
    }

    // 2. Crear tabla Rol_tmp primero (para no chocar con enum "Rol" existente)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Rol_new" (
        "id" TEXT NOT NULL,
        "nombre" TEXT NOT NULL,
        "codigo" TEXT,
        "descripcion" TEXT,
        "permisos" JSONB NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Rol_new_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Rol_new_codigo_key" ON "Rol_new"("codigo")`)

    // 3. Insertar roles en Rol_new
    const countBefore = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "Rol_new"`
    )
    if (Number(countBefore[0]?.count ?? 0) === 0) {
      for (const r of ROLES) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "Rol_new" ("id", "nombre", "codigo", "descripcion", "permisos") 
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4::jsonb)`,
          r.nombre,
          r.codigo,
          r.descripcion,
          JSON.stringify(r.permisos)
        )
      }
    }
    // Usar upsert para asegurar los 6
    const roles = await prisma.$queryRawUnsafe<{ id: string; codigo: string }[]>(
      `SELECT id, "codigo" FROM "Rol_new"`
    )
    const rolesByCodigo = Object.fromEntries(roles.map((r) => [r.codigo, r.id]))

    // 4. Verificar si Usuario tiene columna rol (enum)
    const tieneRolEnum = columnasUsuario.some((c) => c.column_name === 'rol')
    if (tieneRolEnum) {
      // Agregar rolId
      await prisma.$executeRawUnsafe(`ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "rolId" TEXT`)
      // Actualizar según rol enum
      for (const codigo of ['ADMIN', 'GERENTE', 'CAJERO', 'MESERO', 'COCINERO', 'BARTENDER']) {
        const rolId = rolesByCodigo[codigo]
        if (rolId) {
          await prisma.$executeRawUnsafe(
            `UPDATE "Usuario" SET "rolId" = $1 WHERE "rol"::text = $2`,
            rolId,
            codigo
          )
        }
      }
      // Hacer NOT NULL (solo si todos tienen rolId)
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Usuario" ALTER COLUMN "rolId" SET NOT NULL`
      )
      await prisma.$executeRawUnsafe(`ALTER TABLE "Usuario" DROP COLUMN "rol"`)
      // Eliminar enum Rol (ya no se usa)
      await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "Rol"`)
      // Renombrar Rol_new -> Rol
      await prisma.$executeRawUnsafe(`ALTER TABLE "Rol_new" RENAME TO "Rol"`)
      await prisma.$executeRawUnsafe(`ALTER INDEX "Rol_new_pkey" RENAME TO "Rol_pkey"`)
      await prisma.$executeRawUnsafe(`ALTER INDEX "Rol_new_codigo_key" RENAME TO "Rol_codigo_key"`)
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
      )
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "Usuario_rolId_idx" ON "Usuario"("rolId")`
      )
      console.log('Migración completada.')
    } else {
      console.log('Esquema ya actualizado o migración no necesaria.')
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
