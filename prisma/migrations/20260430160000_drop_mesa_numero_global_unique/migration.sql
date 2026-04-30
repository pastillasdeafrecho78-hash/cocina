-- El scope correcto de mesa es por sucursal: (restauranteId, numero).
-- Este índice global puede quedar como drift en bases antiguas y bloquea
-- crear la misma mesa en dos sucursales distintas.
ALTER TABLE "Mesa" DROP CONSTRAINT IF EXISTS "Mesa_numero_key";
DROP INDEX IF EXISTS "Mesa_numero_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Mesa_restauranteId_numero_key"
  ON "Mesa"("restauranteId", "numero");
