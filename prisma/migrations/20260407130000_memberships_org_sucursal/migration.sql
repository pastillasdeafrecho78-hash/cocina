-- Multi-sucursal memberships with backward compatibility.
ALTER TABLE "Usuario"
ADD COLUMN "activeOrganizacionId" TEXT,
ADD COLUMN "activeRestauranteId" TEXT;

CREATE TABLE "OrganizacionMiembro" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "organizacionId" TEXT NOT NULL,
  "esOwner" BOOLEAN NOT NULL DEFAULT false,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizacionMiembro_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SucursalMiembro" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "restauranteId" TEXT NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SucursalMiembro_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizacionMiembro_usuarioId_organizacionId_key"
  ON "OrganizacionMiembro"("usuarioId", "organizacionId");
CREATE INDEX "OrganizacionMiembro_organizacionId_idx"
  ON "OrganizacionMiembro"("organizacionId");

CREATE UNIQUE INDEX "SucursalMiembro_usuarioId_restauranteId_key"
  ON "SucursalMiembro"("usuarioId", "restauranteId");
CREATE INDEX "SucursalMiembro_restauranteId_idx"
  ON "SucursalMiembro"("restauranteId");

CREATE INDEX "Usuario_activeOrganizacionId_idx" ON "Usuario"("activeOrganizacionId");
CREATE INDEX "Usuario_activeRestauranteId_idx" ON "Usuario"("activeRestauranteId");

ALTER TABLE "Usuario"
ADD CONSTRAINT "Usuario_activeOrganizacionId_fkey"
  FOREIGN KEY ("activeOrganizacionId") REFERENCES "Organizacion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Usuario"
ADD CONSTRAINT "Usuario_activeRestauranteId_fkey"
  FOREIGN KEY ("activeRestauranteId") REFERENCES "Restaurante"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrganizacionMiembro"
ADD CONSTRAINT "OrganizacionMiembro_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizacionMiembro"
ADD CONSTRAINT "OrganizacionMiembro_organizacionId_fkey"
  FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SucursalMiembro"
ADD CONSTRAINT "SucursalMiembro_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SucursalMiembro"
ADD CONSTRAINT "SucursalMiembro_restauranteId_fkey"
  FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill base memberships from existing usuario/restaurante relation.
INSERT INTO "SucursalMiembro" ("id", "usuarioId", "restauranteId", "activo", "esPrincipal", "createdAt", "updatedAt")
SELECT
  'sm_' || md5(u."id" || '_' || u."restauranteId"),
  u."id",
  u."restauranteId",
  u."activo",
  true,
  COALESCE(u."createdAt", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "Usuario" u
ON CONFLICT ("usuarioId", "restauranteId") DO NOTHING;

INSERT INTO "OrganizacionMiembro" ("id", "usuarioId", "organizacionId", "esOwner", "activo", "createdAt", "updatedAt")
SELECT
  'om_' || md5(u."id" || '_' || r."organizacionId"),
  u."id",
  r."organizacionId",
  false,
  u."activo",
  COALESCE(u."createdAt", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "Usuario" u
JOIN "Restaurante" r ON r."id" = u."restauranteId"
WHERE r."organizacionId" IS NOT NULL
ON CONFLICT ("usuarioId", "organizacionId") DO NOTHING;

-- Initialize active context from current restaurante and its organización.
UPDATE "Usuario" u
SET
  "activeRestauranteId" = u."restauranteId",
  "activeOrganizacionId" = r."organizacionId"
FROM "Restaurante" r
WHERE r."id" = u."restauranteId";
