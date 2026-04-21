-- Detalle por ítem para pagos (separación de cuenta)
CREATE TABLE "PagoLinea" (
    "id" TEXT NOT NULL,
    "pagoId" TEXT NOT NULL,
    "comandaItemId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "importe" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoLinea_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PagoLinea_pagoId_idx" ON "PagoLinea"("pagoId");
CREATE INDEX "PagoLinea_comandaItemId_idx" ON "PagoLinea"("comandaItemId");

ALTER TABLE "PagoLinea" ADD CONSTRAINT "PagoLinea_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PagoLinea" ADD CONSTRAINT "PagoLinea_comandaItemId_fkey" FOREIGN KEY ("comandaItemId") REFERENCES "ComandaItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
