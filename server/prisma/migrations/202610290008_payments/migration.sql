CREATE TABLE "Pago" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "pedidoId" TEXT NOT NULL REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "proveedor" TEXT NOT NULL DEFAULT 'payphone' CHECK("proveedor"='payphone'),
 "entorno" TEXT NOT NULL CHECK("entorno" IN ('sandbox','production')),
 "estado" TEXT NOT NULL DEFAULT 'creando' CHECK("estado" IN ('creando','pendiente','aprobado','cancelado','revision')),
 "moneda" TEXT NOT NULL DEFAULT 'USD' CHECK("moneda"='USD'),
 "totalCentavos" INTEGER NOT NULL CHECK(typeof("totalCentavos")='integer' AND "totalCentavos" BETWEEN 1 AND 2147483647),
 "sinIvaCentavos" INTEGER NOT NULL CHECK(typeof("sinIvaCentavos")='integer' AND "sinIvaCentavos">=0),
 "baseIvaCentavos" INTEGER NOT NULL CHECK(typeof("baseIvaCentavos")='integer' AND "baseIvaCentavos">=0),
 "ivaCentavos" INTEGER NOT NULL CHECK(typeof("ivaCentavos")='integer' AND "ivaCentavos">=0),
 "paymentId" TEXT,
 "providerTransactionId" INTEGER CHECK("providerTransactionId" IS NULL OR (typeof("providerTransactionId")='integer' AND "providerTransactionId">0)),
 "urlPago" TEXT,
 "confirmacionIniciadaAt" DATETIME,
 "confirmadaAt" DATETIME,
 "revisionMotivo" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL,
 CHECK(CAST("sinIvaCentavos" AS BIGINT)+"baseIvaCentavos"+"ivaCentavos"="totalCentavos"),
 CHECK("estado"!='aprobado' OR ("providerTransactionId" IS NOT NULL AND "confirmadaAt" IS NOT NULL))
);
CREATE UNIQUE INDEX "Pago_pedidoId_key" ON "Pago"("pedidoId");
CREATE UNIQUE INDEX "Pago_providerTransactionId_key" ON "Pago"("providerTransactionId");
CREATE UNIQUE INDEX "Pago_paymentId_key" ON "Pago"("paymentId");
CREATE TRIGGER "Pago_snapshot_immutable" BEFORE UPDATE ON "Pago"
WHEN NEW."id" IS NOT OLD."id" OR NEW."pedidoId" IS NOT OLD."pedidoId" OR NEW."proveedor" IS NOT OLD."proveedor" OR NEW."entorno" IS NOT OLD."entorno" OR NEW."moneda" IS NOT OLD."moneda" OR NEW."totalCentavos" IS NOT OLD."totalCentavos" OR NEW."sinIvaCentavos" IS NOT OLD."sinIvaCentavos" OR NEW."baseIvaCentavos" IS NOT OLD."baseIvaCentavos" OR NEW."ivaCentavos" IS NOT OLD."ivaCentavos" OR NEW."createdAt" IS NOT OLD."createdAt"
 OR (OLD."providerTransactionId" IS NOT NULL AND NEW."providerTransactionId" IS NOT OLD."providerTransactionId")
 OR (OLD."paymentId" IS NOT NULL AND NEW."paymentId" IS NOT OLD."paymentId")
 OR (OLD."confirmacionIniciadaAt" IS NOT NULL AND NEW."confirmacionIniciadaAt" IS NOT OLD."confirmacionIniciadaAt")
 OR (OLD."confirmadaAt" IS NOT NULL AND NEW."confirmadaAt" IS NOT OLD."confirmadaAt")
 OR (OLD."estado" IN ('aprobado','cancelado') AND NEW."estado"!=OLD."estado")
BEGIN SELECT RAISE(ABORT,'Pago snapshot immutable'); END;
