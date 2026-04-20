-- AlterTable
ALTER TABLE "MesaPublicLink" ADD COLUMN IF NOT EXISTS "publicCode" TEXT;

-- CreateIndex (PostgreSQL permite varios NULL en índice único)
CREATE UNIQUE INDEX IF NOT EXISTS "MesaPublicLink_publicCode_key" ON "MesaPublicLink"("publicCode");
