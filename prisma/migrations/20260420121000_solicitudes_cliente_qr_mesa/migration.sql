CREATE TYPE "EstadoSolicitudPedido" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'EXPIRADA');
CREATE TYPE "OrigenSolicitudPedido" AS ENUM ('PUBLIC_LINK_GENERAL', 'PUBLIC_LINK_MESA');
CREATE TYPE "TipoPedidoSolicitud" AS ENUM ('MESA', 'PARA_LLEVAR', 'ENVIO');

ALTER TABLE "ConfiguracionRestaurante"
ADD COLUMN "pedidosClienteSolicitudHabilitado" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "MesaPublicLink" (
  "id" TEXT NOT NULL,
  "restauranteId" TEXT NOT NULL,
  "mesaId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "activa" BOOLEAN NOT NULL DEFAULT true,
  "expiraEn" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MesaPublicLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MesaPublicLink_mesaId_key" ON "MesaPublicLink"("mesaId");
CREATE UNIQUE INDEX "MesaPublicLink_codeHash_key" ON "MesaPublicLink"("codeHash");
CREATE INDEX "MesaPublicLink_restauranteId_idx" ON "MesaPublicLink"("restauranteId");
CREATE INDEX "MesaPublicLink_activa_idx" ON "MesaPublicLink"("activa");

ALTER TABLE "MesaPublicLink"
ADD CONSTRAINT "MesaPublicLink_restauranteId_fkey"
  FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MesaPublicLink"
ADD CONSTRAINT "MesaPublicLink_mesaId_fkey"
  FOREIGN KEY ("mesaId") REFERENCES "Mesa"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SolicitudPedido" (
  "id" TEXT NOT NULL,
  "restauranteId" TEXT NOT NULL,
  "mesaId" TEXT,
  "tipoPedido" "TipoPedidoSolicitud" NOT NULL,
  "origen" "OrigenSolicitudPedido" NOT NULL,
  "estado" "EstadoSolicitudPedido" NOT NULL DEFAULT 'PENDIENTE',
  "nombreCliente" TEXT NOT NULL,
  "telefono" TEXT,
  "notas" TEXT,
  "observaciones" TEXT,
  "totalEstimado" DOUBLE PRECISION NOT NULL,
  "approvedComandaId" TEXT,
  "aprobadaAt" TIMESTAMP(3),
  "rechazadaAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SolicitudPedido_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SolicitudPedido_restauranteId_idx" ON "SolicitudPedido"("restauranteId");
CREATE INDEX "SolicitudPedido_estado_createdAt_idx" ON "SolicitudPedido"("estado", "createdAt");
CREATE INDEX "SolicitudPedido_mesaId_idx" ON "SolicitudPedido"("mesaId");

ALTER TABLE "SolicitudPedido"
ADD CONSTRAINT "SolicitudPedido_restauranteId_fkey"
  FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SolicitudPedido"
ADD CONSTRAINT "SolicitudPedido_mesaId_fkey"
  FOREIGN KEY ("mesaId") REFERENCES "Mesa"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SolicitudPedido"
ADD CONSTRAINT "SolicitudPedido_approvedComandaId_fkey"
  FOREIGN KEY ("approvedComandaId") REFERENCES "Comanda"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SolicitudPedidoItem" (
  "id" TEXT NOT NULL,
  "solicitudPedidoId" TEXT NOT NULL,
  "productoId" TEXT NOT NULL,
  "tamanoId" TEXT,
  "cantidad" INTEGER NOT NULL,
  "precioUnitario" DOUBLE PRECISION NOT NULL,
  "subtotal" DOUBLE PRECISION NOT NULL,
  "notas" TEXT,
  "destino" "DestinoItem" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SolicitudPedidoItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SolicitudPedidoItem_solicitudPedidoId_idx" ON "SolicitudPedidoItem"("solicitudPedidoId");
CREATE INDEX "SolicitudPedidoItem_productoId_idx" ON "SolicitudPedidoItem"("productoId");
CREATE INDEX "SolicitudPedidoItem_destino_idx" ON "SolicitudPedidoItem"("destino");

ALTER TABLE "SolicitudPedidoItem"
ADD CONSTRAINT "SolicitudPedidoItem_solicitudPedidoId_fkey"
  FOREIGN KEY ("solicitudPedidoId") REFERENCES "SolicitudPedido"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SolicitudPedidoItem"
ADD CONSTRAINT "SolicitudPedidoItem_productoId_fkey"
  FOREIGN KEY ("productoId") REFERENCES "Producto"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SolicitudPedidoItem"
ADD CONSTRAINT "SolicitudPedidoItem_tamanoId_fkey"
  FOREIGN KEY ("tamanoId") REFERENCES "ProductoTamano"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SolicitudItemModificador" (
  "id" TEXT NOT NULL,
  "solicitudPedidoItemId" TEXT NOT NULL,
  "modificadorId" TEXT NOT NULL,
  "precioExtra" DOUBLE PRECISION NOT NULL DEFAULT 0,
  CONSTRAINT "SolicitudItemModificador_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SolicitudItemModificador_solicitudPedidoItemId_modificadorId_key"
  ON "SolicitudItemModificador"("solicitudPedidoItemId", "modificadorId");

ALTER TABLE "SolicitudItemModificador"
ADD CONSTRAINT "SolicitudItemModificador_solicitudPedidoItemId_fkey"
  FOREIGN KEY ("solicitudPedidoItemId") REFERENCES "SolicitudPedidoItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SolicitudItemModificador"
ADD CONSTRAINT "SolicitudItemModificador_modificadorId_fkey"
  FOREIGN KEY ("modificadorId") REFERENCES "Modificador"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
