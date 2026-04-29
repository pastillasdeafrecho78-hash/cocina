CREATE TYPE "TipoMovimientoInventario" AS ENUM ('ENTRADA', 'AJUSTE_ABSOLUTO');

CREATE TABLE "InventarioArticulo" (
  "id" TEXT NOT NULL,
  "restauranteId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "unidad" TEXT NOT NULL,
  "sku" TEXT,
  "categoria" TEXT,
  "stockActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "stockMinimo" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "fechaCaducidad" TIMESTAMP(3),
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventarioArticulo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventarioMovimiento" (
  "id" TEXT NOT NULL,
  "restauranteId" TEXT NOT NULL,
  "articuloId" TEXT NOT NULL,
  "tipo" "TipoMovimientoInventario" NOT NULL,
  "cantidad" DOUBLE PRECISION NOT NULL,
  "stockAntes" DOUBLE PRECISION NOT NULL,
  "stockDespues" DOUBLE PRECISION NOT NULL,
  "costoUnitario" DOUBLE PRECISION,
  "proveedor" TEXT,
  "referencia" TEXT,
  "notas" TEXT,
  "usuarioId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventarioMovimiento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventarioArticulo_restauranteId_nombre_key"
ON "InventarioArticulo"("restauranteId", "nombre");

CREATE INDEX "InventarioArticulo_restauranteId_activo_idx"
ON "InventarioArticulo"("restauranteId", "activo");

CREATE INDEX "InventarioArticulo_restauranteId_fechaCaducidad_idx"
ON "InventarioArticulo"("restauranteId", "fechaCaducidad");

CREATE INDEX "InventarioMovimiento_restauranteId_createdAt_idx"
ON "InventarioMovimiento"("restauranteId", "createdAt");

CREATE INDEX "InventarioMovimiento_articuloId_createdAt_idx"
ON "InventarioMovimiento"("articuloId", "createdAt");

ALTER TABLE "InventarioArticulo"
ADD CONSTRAINT "InventarioArticulo_restauranteId_fkey"
FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventarioMovimiento"
ADD CONSTRAINT "InventarioMovimiento_restauranteId_fkey"
FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventarioMovimiento"
ADD CONSTRAINT "InventarioMovimiento_articuloId_fkey"
FOREIGN KEY ("articuloId") REFERENCES "InventarioArticulo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventarioMovimiento"
ADD CONSTRAINT "InventarioMovimiento_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
