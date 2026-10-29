CREATE TABLE "Pago" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "pedidoId" TEXT NOT NULL REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "proveedor" TEXT NOT NULL DEFAULT 'payphone' CHECK("proveedor"='payphone'),
 "entorno" TEXT NOT NULL CHECK("entorno" IN ('sandbox','production')),
 "estado" TEXT NOT NULL DEFAULT 'creando' CHECK("estado" IN ('creando','pendiente','aprobado','cancelado','revision')),
 "moneda" TEXT NOT NULL DEFAULT 'USD' CHECK("moneda"='USD'),
 "totalCentavos" INTEGER NOT NULL CHECK("totalCentavos" BETWEEN 1 AND 2147483647),
 "sinIvaCentavos" INTEGER NOT NULL CHECK("sinIvaCentavos">=0),
 "baseIvaCentavos" INTEGER NOT NULL CHECK("baseIvaCentavos">=0),
 "ivaCentavos" INTEGER NOT NULL CHECK("ivaCentavos">=0),
 "paymentId" TEXT,
 "providerTransactionId" INTEGER CHECK("providerTransactionId" IS NULL OR "providerTransactionId">0),
 "urlPago" TEXT,
 "confirmacionIniciadaAt" TIMESTAMP(3),
 "confirmadaAt" TIMESTAMP(3),
 "revisionMotivo" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CHECK(CAST("sinIvaCentavos" AS BIGINT)+"baseIvaCentavos"+"ivaCentavos"="totalCentavos"),
 CHECK("estado"!='aprobado' OR ("providerTransactionId" IS NOT NULL AND "confirmadaAt" IS NOT NULL))
);
CREATE UNIQUE INDEX "Pago_pedidoId_key" ON "Pago"("pedidoId");
CREATE UNIQUE INDEX "Pago_providerTransactionId_key" ON "Pago"("providerTransactionId");
CREATE UNIQUE INDEX "Pago_paymentId_key" ON "Pago"("paymentId");
CREATE FUNCTION "pago_snapshot_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."pedidoId" IS DISTINCT FROM OLD."pedidoId" OR NEW."proveedor" IS DISTINCT FROM OLD."proveedor" OR NEW."entorno" IS DISTINCT FROM OLD."entorno" OR NEW."moneda" IS DISTINCT FROM OLD."moneda" OR NEW."totalCentavos" IS DISTINCT FROM OLD."totalCentavos" OR NEW."sinIvaCentavos" IS DISTINCT FROM OLD."sinIvaCentavos" OR NEW."baseIvaCentavos" IS DISTINCT FROM OLD."baseIvaCentavos" OR NEW."ivaCentavos" IS DISTINCT FROM OLD."ivaCentavos" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
 OR (OLD."providerTransactionId" IS NOT NULL AND NEW."providerTransactionId" IS DISTINCT FROM OLD."providerTransactionId")
 OR (OLD."paymentId" IS NOT NULL AND NEW."paymentId" IS DISTINCT FROM OLD."paymentId")
 OR (OLD."confirmacionIniciadaAt" IS NOT NULL AND NEW."confirmacionIniciadaAt" IS DISTINCT FROM OLD."confirmacionIniciadaAt")
 OR (OLD."confirmadaAt" IS NOT NULL AND NEW."confirmadaAt" IS DISTINCT FROM OLD."confirmadaAt")
 OR (OLD."estado" IN ('aprobado','cancelado') AND NEW."estado"!=OLD."estado") THEN
 RAISE EXCEPTION 'Pago snapshot immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Pago_snapshot_immutable" BEFORE UPDATE ON "Pago" FOR EACH ROW EXECUTE FUNCTION "pago_snapshot_immutable"();
ALTER TABLE "Pago" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Pago" FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE "Pago" FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE "Pago" FROM authenticated; END IF; END $$;
