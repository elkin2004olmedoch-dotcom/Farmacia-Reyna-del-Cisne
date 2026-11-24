CREATE TABLE "PagoPractica" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "pedidoId" TEXT NOT NULL REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "metodo" TEXT NOT NULL CHECK("metodo" IN ('card','transfer')),
 "marca" TEXT,
 "totalCentavos" INTEGER NOT NULL CHECK(typeof("totalCentavos")='integer' AND "totalCentavos" BETWEEN 1 AND 2147483647),
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(("metodo"='card' AND "marca" IS NOT NULL AND "marca" IN ('visa','mastercard','amex','diners','discover')) OR ("metodo"='transfer' AND "marca" IS NULL))
);
CREATE UNIQUE INDEX "PagoPractica_pedidoId_key" ON "PagoPractica"("pedidoId");
