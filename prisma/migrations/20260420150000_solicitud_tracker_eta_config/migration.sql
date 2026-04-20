-- Seguimiento público por solicitud + ETA cliente + saturación por ítems en preparación
ALTER TABLE "ConfiguracionRestaurante" ADD COLUMN IF NOT EXISTS "clienteEtaMinMinutos" INTEGER DEFAULT 45;
ALTER TABLE "ConfiguracionRestaurante" ADD COLUMN IF NOT EXISTS "clienteEtaMaxMinutos" INTEGER DEFAULT 60;
ALTER TABLE "ConfiguracionRestaurante" ADD COLUMN IF NOT EXISTS "maxItemsPreparacion" INTEGER;

ALTER TABLE "SolicitudPedido" ADD COLUMN IF NOT EXISTS "publicTokenHash" TEXT;
ALTER TABLE "SolicitudPedido" ADD COLUMN IF NOT EXISTS "publicTokenIssuedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "SolicitudPedido_publicTokenHash_key" ON "SolicitudPedido"("publicTokenHash");
