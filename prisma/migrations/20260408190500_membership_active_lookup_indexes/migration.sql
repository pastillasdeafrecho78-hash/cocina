-- Defensive precheck (run manually before deploy if needed):
-- SELECT "usuarioId", "restauranteId", COUNT(*)
-- FROM "SucursalMiembro"
-- GROUP BY 1, 2
-- HAVING COUNT(*) > 1;
--
-- SELECT "usuarioId", "organizacionId", COUNT(*)
-- FROM "OrganizacionMiembro"
-- GROUP BY 1, 2
-- HAVING COUNT(*) > 1;
--
-- Existing UNIQUE constraints already prevent duplicates:
-- - SucursalMiembro(usuarioId, restauranteId)
-- - OrganizacionMiembro(usuarioId, organizacionId)

CREATE INDEX "SucursalMiembro_restauranteId_activo_idx"
ON "SucursalMiembro"("restauranteId", "activo");

CREATE INDEX "SucursalMiembro_usuarioId_activo_idx"
ON "SucursalMiembro"("usuarioId", "activo");

CREATE INDEX "OrganizacionMiembro_organizacionId_activo_idx"
ON "OrganizacionMiembro"("organizacionId", "activo");

CREATE INDEX "OrganizacionMiembro_usuarioId_activo_idx"
ON "OrganizacionMiembro"("usuarioId", "activo");
