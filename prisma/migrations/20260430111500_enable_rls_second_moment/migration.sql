-- Harden second-moment tables exposed in the public schema.
-- The application accesses these tables through the backend/Prisma connection;
-- no public PostgREST policies are required for the current product surface.
ALTER TABLE "KdsSeccion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventarioArticulo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventarioMovimiento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reembolso" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItemTiempoEvento" ENABLE ROW LEVEL SECURITY;
