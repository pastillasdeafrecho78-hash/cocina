CREATE TYPE "MenuStrategy" AS ENUM ('EMPTY', 'CLONE', 'SHARED');

ALTER TABLE "Restaurante"
ADD COLUMN "menuStrategy" "MenuStrategy" NOT NULL DEFAULT 'EMPTY',
ADD COLUMN "menuSourceRestauranteId" TEXT;

CREATE INDEX "Restaurante_menuSourceRestauranteId_idx" ON "Restaurante"("menuSourceRestauranteId");

ALTER TABLE "Restaurante"
ADD CONSTRAINT "Restaurante_menuSourceRestauranteId_fkey"
FOREIGN KEY ("menuSourceRestauranteId") REFERENCES "Restaurante"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
