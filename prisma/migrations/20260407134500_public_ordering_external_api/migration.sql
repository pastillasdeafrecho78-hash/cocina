CREATE TYPE "OrigenComanda" AS ENUM ('STAFF_DASHBOARD', 'PUBLIC_LINK', 'EXTERNAL_API');

ALTER TABLE "Comanda"
ADD COLUMN "origen" "OrigenComanda" NOT NULL DEFAULT 'STAFF_DASHBOARD',
ADD COLUMN "publicTokenHash" TEXT,
ADD COLUMN "externalOrderId" TEXT,
ADD COLUMN "externalSource" TEXT;

CREATE UNIQUE INDEX "Comanda_publicTokenHash_key" ON "Comanda"("publicTokenHash");
CREATE UNIQUE INDEX "Comanda_restauranteId_externalOrderId_key"
  ON "Comanda"("restauranteId", "externalOrderId");

CREATE TABLE "IntegracionPedidosApi" (
  "id" TEXT NOT NULL,
  "restauranteId" TEXT NOT NULL,
  "apiKeyHash" TEXT NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegracionPedidosApi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegracionPedidosApi_restauranteId_key"
  ON "IntegracionPedidosApi"("restauranteId");

ALTER TABLE "IntegracionPedidosApi"
ADD CONSTRAINT "IntegracionPedidosApi_restauranteId_fkey"
  FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
