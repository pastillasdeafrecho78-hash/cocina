-- CreateTable Rol
CREATE TABLE "Rol" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "descripcion" TEXT,
    "permisos" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Rol_codigo_key" ON "Rol"("codigo");

-- Insert default roles
INSERT INTO "Rol" ("id", "nombre", "codigo", "descripcion", "permisos") VALUES
  (gen_random_uuid()::text, 'Administrador', 'ADMIN', 'Acceso total', '["*"]'),
  (gen_random_uuid()::text, 'Gerente', 'GERENTE', 'Gestión operativa', '["mesas","comandas","carta","cocina","barra","reportes","caja"]'),
  (gen_random_uuid()::text, 'Cajero', 'CAJERO', 'Caja y reportes', '["mesas","comandas","reportes","caja"]'),
  (gen_random_uuid()::text, 'Mesero', 'MESERO', 'Mesas y comandas', '["mesas","comandas","reportes"]'),
  (gen_random_uuid()::text, 'Cocinero', 'COCINERO', 'Cocina KDS', '["cocina"]'),
  (gen_random_uuid()::text, 'Bartender', 'BARTENDER', 'Barra KDS', '["barra"]');

-- Add rolId to Usuario (nullable first)
ALTER TABLE "Usuario" ADD COLUMN "rolId" TEXT;

-- Backfill rolId from rol enum
UPDATE "Usuario" u SET "rolId" = r."id"
FROM "Rol" r
WHERE r."codigo" = u."rol"::text;

-- Drop old rol column
ALTER TABLE "Usuario" DROP COLUMN "rol";

-- Make rolId NOT NULL
ALTER TABLE "Usuario" ALTER COLUMN "rolId" SET NOT NULL;

-- Add FK
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Usuario_rolId_idx" ON "Usuario"("rolId");
