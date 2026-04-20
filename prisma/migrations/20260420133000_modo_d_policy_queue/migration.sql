ALTER TYPE "EstadoSolicitudPedido" ADD VALUE IF NOT EXISTS 'EN_COLA';

ALTER TABLE "SucursalMiembro"
ADD COLUMN "horarioInicioMin" INTEGER,
ADD COLUMN "horarioFinMin" INTEGER,
ADD COLUMN "diasLaborales" TEXT;

ALTER TABLE "ConfiguracionRestaurante"
ADD COLUMN "modoDPedidosHabilitado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "queueEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "qrMesaEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "maxComandasActivas" INTEGER DEFAULT 25,
ADD COLUMN "tiempoEsperaSaturacionMin" INTEGER DEFAULT 15,
ADD COLUMN "mensajeSaturacion" TEXT DEFAULT 'Ahorita estamos a tope. Tu pedido podría iniciar en unos minutos. ¿Deseas entrar a la cola?',
ADD COLUMN "autoAprobarSolicitudes" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SolicitudPedido"
ADD COLUMN "decisionSource" TEXT,
ADD COLUMN "decisionReason" TEXT,
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "enColaAt" TIMESTAMP(3),
ADD COLUMN "prioridadColaAt" TIMESTAMP(3);

CREATE INDEX "SolicitudPedido_prioridadColaAt_idx" ON "SolicitudPedido"("prioridadColaAt");

ALTER TABLE "SolicitudPedido"
ADD CONSTRAINT "SolicitudPedido_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "Usuario"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ComandaColaborador" (
  "id" TEXT NOT NULL,
  "comandaId" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL DEFAULT 'APOYO_ENTREGA',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComandaColaborador_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ComandaColaborador_comandaId_createdAt_idx" ON "ComandaColaborador"("comandaId", "createdAt");
CREATE INDEX "ComandaColaborador_usuarioId_createdAt_idx" ON "ComandaColaborador"("usuarioId", "createdAt");
CREATE UNIQUE INDEX "ComandaColaborador_comandaId_usuarioId_tipo_key" ON "ComandaColaborador"("comandaId", "usuarioId", "tipo");

ALTER TABLE "ComandaColaborador"
ADD CONSTRAINT "ComandaColaborador_comandaId_fkey"
FOREIGN KEY ("comandaId") REFERENCES "Comanda"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComandaColaborador"
ADD CONSTRAINT "ComandaColaborador_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
