CREATE TABLE "CodigoVinculacionSucursal" (
  "id" TEXT NOT NULL,
  "restauranteId" TEXT NOT NULL,
  "codigoHash" TEXT NOT NULL,
  "expiraEn" TIMESTAMP(3) NOT NULL,
  "usadaEn" TIMESTAMP(3),
  "creadoPorId" TEXT,
  "rolId" TEXT,
  "organizacionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CodigoVinculacionSucursal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CodigoVinculacionSucursal_codigoHash_key"
  ON "CodigoVinculacionSucursal"("codigoHash");
CREATE INDEX "CodigoVinculacionSucursal_restauranteId_idx"
  ON "CodigoVinculacionSucursal"("restauranteId");
CREATE INDEX "CodigoVinculacionSucursal_expiraEn_idx"
  ON "CodigoVinculacionSucursal"("expiraEn");
CREATE INDEX "CodigoVinculacionSucursal_usadaEn_idx"
  ON "CodigoVinculacionSucursal"("usadaEn");

ALTER TABLE "CodigoVinculacionSucursal"
ADD CONSTRAINT "CodigoVinculacionSucursal_restauranteId_fkey"
  FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CodigoVinculacionSucursal"
ADD CONSTRAINT "CodigoVinculacionSucursal_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CodigoVinculacionSucursal"
ADD CONSTRAINT "CodigoVinculacionSucursal_rolId_fkey"
  FOREIGN KEY ("rolId") REFERENCES "Rol"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CodigoVinculacionSucursal"
ADD CONSTRAINT "CodigoVinculacionSucursal_organizacionId_fkey"
  FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
