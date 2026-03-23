-- CreateTable Restaurante
CREATE TABLE "Restaurante" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restaurante_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Restaurante_slug_key" ON "Restaurante"("slug");

INSERT INTO "Restaurante" ("id", "nombre", "slug", "activo", "createdAt", "updatedAt")
VALUES ('cm_default_restaurant_001', 'Restaurante principal', 'principal', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Usuario: add restauranteId, change unique email
ALTER TABLE "Usuario" ADD COLUMN "restauranteId" TEXT;
UPDATE "Usuario" SET "restauranteId" = 'cm_default_restaurant_001';
ALTER TABLE "Usuario" ALTER COLUMN "restauranteId" SET NOT NULL;
ALTER TABLE "Usuario" DROP CONSTRAINT IF EXISTS "Usuario_email_key";
CREATE UNIQUE INDEX "Usuario_restauranteId_email_key" ON "Usuario"("restauranteId", "email");
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Usuario_restauranteId_idx" ON "Usuario"("restauranteId");

-- Mesa
ALTER TABLE "Mesa" DROP CONSTRAINT IF EXISTS "Mesa_numero_key";
ALTER TABLE "Mesa" ADD COLUMN "restauranteId" TEXT;
UPDATE "Mesa" SET "restauranteId" = 'cm_default_restaurant_001';
ALTER TABLE "Mesa" ALTER COLUMN "restauranteId" SET NOT NULL;
ALTER TABLE "Mesa" ADD CONSTRAINT "Mesa_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Mesa_restauranteId_numero_key" ON "Mesa"("restauranteId", "numero");
CREATE INDEX "Mesa_restauranteId_idx" ON "Mesa"("restauranteId");

-- Cliente
ALTER TABLE "Cliente" ADD COLUMN "restauranteId" TEXT;
UPDATE "Cliente" SET "restauranteId" = 'cm_default_restaurant_001';
ALTER TABLE "Cliente" ALTER COLUMN "restauranteId" SET NOT NULL;
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Cliente_restauranteId_idx" ON "Cliente"("restauranteId");

-- Comanda
ALTER TABLE "Comanda" DROP CONSTRAINT IF EXISTS "Comanda_numeroComanda_key";
ALTER TABLE "Comanda" ADD COLUMN "restauranteId" TEXT;
UPDATE "Comanda" SET "restauranteId" = 'cm_default_restaurant_001';
ALTER TABLE "Comanda" ALTER COLUMN "restauranteId" SET NOT NULL;
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Comanda_restauranteId_numeroComanda_key" ON "Comanda"("restauranteId", "numeroComanda");
CREATE INDEX "Comanda_restauranteId_idx" ON "Comanda"("restauranteId");

-- Categoria
ALTER TABLE "Categoria" ADD COLUMN "restauranteId" TEXT;
UPDATE "Categoria" SET "restauranteId" = 'cm_default_restaurant_001';
ALTER TABLE "Categoria" ALTER COLUMN "restauranteId" SET NOT NULL;
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Categoria_restauranteId_idx" ON "Categoria"("restauranteId");

-- Modificador
ALTER TABLE "Modificador" ADD COLUMN "restauranteId" TEXT;
UPDATE "Modificador" SET "restauranteId" = 'cm_default_restaurant_001';
ALTER TABLE "Modificador" ALTER COLUMN "restauranteId" SET NOT NULL;
ALTER TABLE "Modificador" ADD CONSTRAINT "Modificador_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Modificador_restauranteId_idx" ON "Modificador"("restauranteId");

-- PlantaRestaurante
ALTER TABLE "PlantaRestaurante" ADD COLUMN "restauranteId" TEXT;
UPDATE "PlantaRestaurante" SET "restauranteId" = 'cm_default_restaurant_001' WHERE "restauranteId" IS NULL;
ALTER TABLE "PlantaRestaurante" ALTER COLUMN "restauranteId" SET NOT NULL;
ALTER TABLE "PlantaRestaurante" ADD CONSTRAINT "PlantaRestaurante_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "PlantaRestaurante_restauranteId_idx" ON "PlantaRestaurante"("restauranteId");

-- ConfiguracionRestaurante
ALTER TABLE "ConfiguracionRestaurante" DROP CONSTRAINT IF EXISTS "ConfiguracionRestaurante_rfc_key";
ALTER TABLE "ConfiguracionRestaurante" ADD COLUMN "restauranteId" TEXT;
UPDATE "ConfiguracionRestaurante" SET "restauranteId" = 'cm_default_restaurant_001';
ALTER TABLE "ConfiguracionRestaurante" ALTER COLUMN "restauranteId" SET NOT NULL;
CREATE UNIQUE INDEX "ConfiguracionRestaurante_restauranteId_key" ON "ConfiguracionRestaurante"("restauranteId");
ALTER TABLE "ConfiguracionRestaurante" ADD CONSTRAINT "ConfiguracionRestaurante_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Auditoria
ALTER TABLE "Auditoria" ADD COLUMN "restauranteId" TEXT;
UPDATE "Auditoria" SET "restauranteId" = 'cm_default_restaurant_001';
ALTER TABLE "Auditoria" ALTER COLUMN "restauranteId" SET NOT NULL;
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Auditoria_restauranteId_idx" ON "Auditoria"("restauranteId");

-- DashboardVista (puede no existir si nunca hubo migración de reportes)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'DashboardVista' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE "DashboardVista" ADD COLUMN IF NOT EXISTS "restauranteId" TEXT;
    UPDATE "DashboardVista" d SET "restauranteId" = COALESCE(
      (SELECT u."restauranteId" FROM "Usuario" u WHERE u.id = d."usuarioId"),
      'cm_default_restaurant_001'
    ) WHERE d."restauranteId" IS NULL;
    UPDATE "DashboardVista" SET "restauranteId" = 'cm_default_restaurant_001' WHERE "restauranteId" IS NULL;
    ALTER TABLE "DashboardVista" ALTER COLUMN "restauranteId" SET NOT NULL;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DashboardVista_restauranteId_fkey') THEN
      ALTER TABLE "DashboardVista" ADD CONSTRAINT "DashboardVista_restauranteId_fkey"
        FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  ELSE
    BEGIN
      CREATE TYPE "ScopeVistaDashboard" AS ENUM ('USER', 'GLOBAL', 'ROL');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
    CREATE TABLE "DashboardVista" (
      "id" TEXT NOT NULL,
      "restauranteId" TEXT NOT NULL,
      "nombre" TEXT NOT NULL,
      "descripcion" TEXT,
      "modulo" TEXT NOT NULL DEFAULT 'reportes',
      "scope" "ScopeVistaDashboard" NOT NULL DEFAULT 'USER',
      "usuarioId" TEXT,
      "rolId" TEXT,
      "esDefault" BOOLEAN NOT NULL DEFAULT false,
      "activa" BOOLEAN NOT NULL DEFAULT true,
      "filtros" JSONB NOT NULL,
      "widgets" JSONB NOT NULL,
      "layout" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DashboardVista_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "DashboardVista_scope_modulo_idx" ON "DashboardVista"("scope", "modulo");
    CREATE INDEX "DashboardVista_usuarioId_modulo_idx" ON "DashboardVista"("usuarioId", "modulo");
    CREATE INDEX "DashboardVista_rolId_modulo_idx" ON "DashboardVista"("rolId", "modulo");
    ALTER TABLE "DashboardVista" ADD CONSTRAINT "DashboardVista_restauranteId_fkey"
      FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    ALTER TABLE "DashboardVista" ADD CONSTRAINT "DashboardVista_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "DashboardVista" ADD CONSTRAINT "DashboardVista_rolId_fkey"
      FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CorteX
ALTER TABLE "CorteX" ADD COLUMN "restauranteId" TEXT;
UPDATE "CorteX" SET "restauranteId" = 'cm_default_restaurant_001';
ALTER TABLE "CorteX" ALTER COLUMN "restauranteId" SET NOT NULL;
ALTER TABLE "CorteX" ADD CONSTRAINT "CorteX_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "CorteX_restauranteId_idx" ON "CorteX"("restauranteId");

-- CorteZ
ALTER TABLE "CorteZ" ADD COLUMN "restauranteId" TEXT;
UPDATE "CorteZ" SET "restauranteId" = 'cm_default_restaurant_001';
ALTER TABLE "CorteZ" ALTER COLUMN "restauranteId" SET NOT NULL;
ALTER TABLE "CorteZ" ADD CONSTRAINT "CorteZ_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "CorteZ_restauranteId_idx" ON "CorteZ"("restauranteId");

-- IntegracionClip
CREATE TABLE "IntegracionClip" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "webhookSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegracionClip_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegracionClip_restauranteId_key" ON "IntegracionClip"("restauranteId");
ALTER TABLE "IntegracionClip" ADD CONSTRAINT "IntegracionClip_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ClipTerminal
CREATE TABLE "ClipTerminal" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "nombre" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClipTerminal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClipTerminal_restauranteId_serialNumber_key" ON "ClipTerminal"("restauranteId", "serialNumber");
CREATE INDEX "ClipTerminal_restauranteId_idx" ON "ClipTerminal"("restauranteId");
ALTER TABLE "ClipTerminal" ADD CONSTRAINT "ClipTerminal_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
