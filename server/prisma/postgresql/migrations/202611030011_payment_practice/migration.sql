CREATE TABLE "PagoPractica" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "pedidoId" TEXT NOT NULL REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "metodo" TEXT NOT NULL CHECK("metodo" IN ('card','transfer')),
 "marca" TEXT,
 "totalCentavos" INTEGER NOT NULL CHECK("totalCentavos" BETWEEN 1 AND 2147483647),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(("metodo"='card' AND "marca" IS NOT NULL AND "marca" IN ('visa','mastercard','amex','diners','discover')) OR ("metodo"='transfer' AND "marca" IS NULL))
);
CREATE UNIQUE INDEX "PagoPractica_pedidoId_key" ON "PagoPractica"("pedidoId");
ALTER TABLE "PagoPractica" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PagoPractica" FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE "PagoPractica" FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE "PagoPractica" FROM authenticated; END IF; END $$;
