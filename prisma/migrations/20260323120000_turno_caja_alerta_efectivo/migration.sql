-- CreateTable TurnoCaja
CREATE TABLE "TurnoCaja" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),
    "fondoInicial" DOUBLE PRECISION NOT NULL,
    "fondoCierre" DOUBLE PRECISION,

    CONSTRAINT "TurnoCaja_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TurnoCaja_restauranteId_idx" ON "TurnoCaja"("restauranteId");
CREATE INDEX "TurnoCaja_fechaApertura_idx" ON "TurnoCaja"("fechaApertura");

ALTER TABLE "TurnoCaja" ADD CONSTRAINT "TurnoCaja_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TurnoCaja" ADD CONSTRAINT "TurnoCaja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable ConfiguracionRestaurante - add alertaEfectivoMinimo
ALTER TABLE "ConfiguracionRestaurante" ADD COLUMN IF NOT EXISTS "alertaEfectivoMinimo" DOUBLE PRECISION;
