-- KDS configurable, manteniendo DestinoItem como compatibilidad legacy.
CREATE TABLE "KdsSeccion" (
  "id" TEXT NOT NULL,
  "restauranteId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "tipoLegacy" TEXT,
  "color" TEXT,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "activa" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KdsSeccion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KdsSeccion_restauranteId_slug_key" ON "KdsSeccion"("restauranteId", "slug");
CREATE INDEX "KdsSeccion_restauranteId_activa_idx" ON "KdsSeccion"("restauranteId", "activa");

ALTER TABLE "KdsSeccion"
ADD CONSTRAINT "KdsSeccion_restauranteId_fkey"
FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Producto" ADD COLUMN "kdsSeccionId" TEXT;
CREATE INDEX "Producto_kdsSeccionId_idx" ON "Producto"("kdsSeccionId");

ALTER TABLE "Producto"
ADD CONSTRAINT "Producto_kdsSeccionId_fkey"
FOREIGN KEY ("kdsSeccionId") REFERENCES "KdsSeccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "KdsSeccion" ("id", "restauranteId", "nombre", "slug", "tipoLegacy", "color", "orden")
SELECT
  'kds_' || md5(r.id || ':cocina'),
  r.id,
  'Cocina',
  'cocina',
  'COCINA',
  '#15803d',
  10
FROM "Restaurante" r
ON CONFLICT ("restauranteId", "slug") DO NOTHING;

INSERT INTO "KdsSeccion" ("id", "restauranteId", "nombre", "slug", "tipoLegacy", "color", "orden")
SELECT
  'kds_' || md5(r.id || ':barra'),
  r.id,
  'Barra',
  'barra',
  'BARRA',
  '#1d4ed8',
  20
FROM "Restaurante" r
ON CONFLICT ("restauranteId", "slug") DO NOTHING;

UPDATE "Producto" p
SET "kdsSeccionId" = ks.id
FROM "Categoria" c
JOIN "KdsSeccion" ks
  ON ks."restauranteId" = c."restauranteId"
  AND ks.slug = CASE WHEN c.tipo = 'BEBIDA' THEN 'barra' ELSE 'cocina' END
WHERE p."categoriaId" = c.id
  AND p."kdsSeccionId" IS NULL;
