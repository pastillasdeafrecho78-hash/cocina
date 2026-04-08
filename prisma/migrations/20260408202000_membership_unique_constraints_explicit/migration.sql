-- Adds explicit UNIQUE constraints using existing unique indexes.
-- Safe path validated with read-only checks in production:
-- 1) no duplicate rows on membership key pairs
-- 2) unique indexes already present for both pairs

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SucursalMiembro_usuarioId_restauranteId_unique'
      AND conrelid = '"SucursalMiembro"'::regclass
  ) THEN
    ALTER TABLE "SucursalMiembro"
      ADD CONSTRAINT "SucursalMiembro_usuarioId_restauranteId_unique"
      UNIQUE USING INDEX "SucursalMiembro_usuarioId_restauranteId_key";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OrganizacionMiembro_usuarioId_organizacionId_unique'
      AND conrelid = '"OrganizacionMiembro"'::regclass
  ) THEN
    ALTER TABLE "OrganizacionMiembro"
      ADD CONSTRAINT "OrganizacionMiembro_usuarioId_organizacionId_unique"
      UNIQUE USING INDEX "OrganizacionMiembro_usuarioId_organizacionId_key";
  END IF;
END $$;
