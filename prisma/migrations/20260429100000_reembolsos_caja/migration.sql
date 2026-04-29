CREATE TYPE "TipoReembolso" AS ENUM ('OPERATIVO_CAJA', 'PROVEEDOR_PAGO');

ALTER TABLE "CorteX" ADD COLUMN "totalReembolsos" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CorteX" ADD COLUMN "totalNeto" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CorteZ" ADD COLUMN "totalReembolsos" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CorteZ" ADD COLUMN "totalNeto" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE "Reembolso" (
  "id" TEXT NOT NULL,
  "restauranteId" TEXT NOT NULL,
  "comandaId" TEXT NOT NULL,
  "pagoId" TEXT NOT NULL,
  "pagoLineaId" TEXT,
  "tipo" "TipoReembolso" NOT NULL,
  "monto" DOUBLE PRECISION NOT NULL,
  "motivo" TEXT NOT NULL,
  "referencia" TEXT,
  "procesadorId" TEXT,
  "usuarioId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Reembolso_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Reembolso_restauranteId_createdAt_idx" ON "Reembolso"("restauranteId", "createdAt");
CREATE INDEX "Reembolso_comandaId_idx" ON "Reembolso"("comandaId");
CREATE INDEX "Reembolso_pagoId_idx" ON "Reembolso"("pagoId");
CREATE INDEX "Reembolso_pagoLineaId_idx" ON "Reembolso"("pagoLineaId");
CREATE INDEX "Reembolso_procesadorId_idx" ON "Reembolso"("procesadorId");

ALTER TABLE "Reembolso"
ADD CONSTRAINT "Reembolso_restauranteId_fkey"
FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Reembolso"
ADD CONSTRAINT "Reembolso_comandaId_fkey"
FOREIGN KEY ("comandaId") REFERENCES "Comanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Reembolso"
ADD CONSTRAINT "Reembolso_pagoId_fkey"
FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Reembolso"
ADD CONSTRAINT "Reembolso_pagoLineaId_fkey"
FOREIGN KEY ("pagoLineaId") REFERENCES "PagoLinea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Reembolso"
ADD CONSTRAINT "Reembolso_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
