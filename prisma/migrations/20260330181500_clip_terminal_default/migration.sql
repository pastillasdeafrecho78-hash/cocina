-- Add default-terminal support for Clip terminals
ALTER TABLE "ClipTerminal"
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Ensure only one active default terminal per restaurant
CREATE UNIQUE INDEX "ClipTerminal_default_active_unique"
ON "ClipTerminal" ("restauranteId")
WHERE "isDefault" = true AND "activo" = true;

