-- Ejecuta este SQL en tu base de datos de producción (Supabase SQL Editor, Neon, etc.)
-- para agregar la columna listoPorDefault que falta.

ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "listoPorDefault" BOOLEAN NOT NULL DEFAULT false;
