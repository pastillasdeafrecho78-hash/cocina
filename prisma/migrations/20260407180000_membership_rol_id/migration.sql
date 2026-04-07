-- AlterTable
ALTER TABLE "OrganizacionMiembro" ADD COLUMN "rolId" TEXT;

-- AlterTable
ALTER TABLE "SucursalMiembro" ADD COLUMN "rolId" TEXT;

-- Backfill desde Usuario.rolId (fuente de verdad previa)
UPDATE "SucursalMiembro" sm
SET "rolId" = u."rolId"
FROM "Usuario" u
WHERE sm."usuarioId" = u.id AND sm."rolId" IS NULL;

UPDATE "OrganizacionMiembro" om
SET "rolId" = u."rolId"
FROM "Usuario" u
WHERE om."usuarioId" = u.id AND om."rolId" IS NULL;

-- CreateIndex
CREATE INDEX "OrganizacionMiembro_rolId_idx" ON "OrganizacionMiembro"("rolId");

-- CreateIndex
CREATE INDEX "SucursalMiembro_rolId_idx" ON "SucursalMiembro"("rolId");

-- AddForeignKey
ALTER TABLE "OrganizacionMiembro" ADD CONSTRAINT "OrganizacionMiembro_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SucursalMiembro" ADD CONSTRAINT "SucursalMiembro_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE SET NULL ON UPDATE CASCADE;
