-- AlterTable
ALTER TABLE "Comanda"
ADD COLUMN "motivoCancelacion" TEXT,
ADD COLUMN "fechaCancelacion" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ComandaItem"
ADD COLUMN "numeroRonda" INTEGER NOT NULL DEFAULT 1;

-- Backfill defensivo en caso de datos legacy con null
UPDATE "ComandaItem"
SET "numeroRonda" = 1
WHERE "numeroRonda" IS NULL;

-- Index
CREATE INDEX "Comanda_fechaCancelacion_idx" ON "Comanda"("fechaCancelacion");
