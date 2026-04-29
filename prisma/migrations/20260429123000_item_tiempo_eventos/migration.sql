CREATE TYPE "TipoEventoItem" AS ENUM ('ENTRADA', 'TOMADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO');

CREATE TABLE "ItemTiempoEvento" (
  "id" TEXT NOT NULL,
  "restauranteId" TEXT NOT NULL,
  "comandaId" TEXT NOT NULL,
  "comandaItemId" TEXT,
  "productoId" TEXT,
  "kdsSeccionId" TEXT,
  "usuarioId" TEXT,
  "tipo" "TipoEventoItem" NOT NULL,
  "estadoPrevio" "EstadoItem",
  "estadoNuevo" "EstadoItem",
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "ItemTiempoEvento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ItemTiempoEvento_restauranteId_occurredAt_idx" ON "ItemTiempoEvento"("restauranteId", "occurredAt");
CREATE INDEX "ItemTiempoEvento_comandaId_occurredAt_idx" ON "ItemTiempoEvento"("comandaId", "occurredAt");
CREATE INDEX "ItemTiempoEvento_comandaItemId_occurredAt_idx" ON "ItemTiempoEvento"("comandaItemId", "occurredAt");
CREATE INDEX "ItemTiempoEvento_productoId_occurredAt_idx" ON "ItemTiempoEvento"("productoId", "occurredAt");
CREATE INDEX "ItemTiempoEvento_kdsSeccionId_occurredAt_idx" ON "ItemTiempoEvento"("kdsSeccionId", "occurredAt");
CREATE INDEX "ItemTiempoEvento_tipo_occurredAt_idx" ON "ItemTiempoEvento"("tipo", "occurredAt");

ALTER TABLE "ItemTiempoEvento"
ADD CONSTRAINT "ItemTiempoEvento_restauranteId_fkey"
FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ItemTiempoEvento"
ADD CONSTRAINT "ItemTiempoEvento_comandaId_fkey"
FOREIGN KEY ("comandaId") REFERENCES "Comanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ItemTiempoEvento"
ADD CONSTRAINT "ItemTiempoEvento_comandaItemId_fkey"
FOREIGN KEY ("comandaItemId") REFERENCES "ComandaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ItemTiempoEvento"
ADD CONSTRAINT "ItemTiempoEvento_productoId_fkey"
FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ItemTiempoEvento"
ADD CONSTRAINT "ItemTiempoEvento_kdsSeccionId_fkey"
FOREIGN KEY ("kdsSeccionId") REFERENCES "KdsSeccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ItemTiempoEvento"
ADD CONSTRAINT "ItemTiempoEvento_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
