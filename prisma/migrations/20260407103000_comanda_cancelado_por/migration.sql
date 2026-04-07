-- AlterTable
ALTER TABLE "Comanda"
ADD COLUMN "canceladoPorId" TEXT;

-- Index
CREATE INDEX "Comanda_canceladoPorId_idx" ON "Comanda"("canceladoPorId");

-- AddForeignKey
ALTER TABLE "Comanda"
ADD CONSTRAINT "Comanda_canceladoPorId_fkey"
FOREIGN KEY ("canceladoPorId") REFERENCES "Usuario"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
