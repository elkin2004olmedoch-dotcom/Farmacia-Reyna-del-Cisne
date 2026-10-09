ALTER TABLE "Promocion" ADD COLUMN "descuentoPorcentaje" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Promocion" ADD COLUMN "imagen" TEXT;
ALTER TABLE "Promocion" ADD COLUMN "alt" TEXT;
ALTER TABLE "PedidoDetalle" ADD COLUMN "precioOriginal" DECIMAL;
ALTER TABLE "PedidoDetalle" ADD COLUMN "descuentoPorcentaje" INTEGER NOT NULL DEFAULT 0;
UPDATE "PedidoDetalle" SET "precioOriginal" = "precioUnitario";

-- Rebuild Pedido to add a timestamp default while preserving historical rows.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Pedido" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "total" DECIMAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "entrega" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "provincia" TEXT,
    "ciudad" TEXT,
    "direccion" TEXT,
    "codigoPostal" TEXT,
    "requestKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pedido_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Pedido" ("id","userId","total","estado","entrega","nombre","email","telefono","documento","provincia","ciudad","direccion","codigoPostal","requestKey","fingerprint","createdAt","updatedAt")
SELECT "id","userId","total","estado","entrega","nombre","email","telefono","documento","provincia","ciudad","direccion","codigoPostal","requestKey","fingerprint","createdAt","createdAt" FROM "Pedido";
DROP TABLE "Pedido";
ALTER TABLE "new_Pedido" RENAME TO "Pedido";
CREATE INDEX "Pedido_userId_createdAt_idx" ON "Pedido"("userId","createdAt");
CREATE UNIQUE INDEX "Pedido_userId_requestKey_key" ON "Pedido"("userId","requestKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE TABLE "PedidoEstado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pedidoId" TEXT NOT NULL,
    "anterior" TEXT,
    "estado" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PedidoEstado_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PedidoEstado_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PedidoEstado_pedidoId_createdAt_idx" ON "PedidoEstado"("pedidoId","createdAt");
