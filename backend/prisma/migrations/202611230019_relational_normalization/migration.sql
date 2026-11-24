PRAGMA foreign_keys=OFF;
BEGIN IMMEDIATE;

-- Validate the source before replacing either table. A failed check rolls back the migration.
CREATE TEMP TABLE "_normalizacion_019_guard" ("ok" INTEGER NOT NULL CHECK("ok"=1));
INSERT INTO "_normalizacion_019_guard" SELECT NOT EXISTS(SELECT 1 FROM pragma_foreign_key_check);
INSERT INTO "_normalizacion_019_guard" SELECT NOT EXISTS(SELECT 1 FROM "AdminMfa" WHERE CASE WHEN json_valid("recoveryHashes") THEN json_type("recoveryHashes")!='array' ELSE 1 END);
INSERT INTO "_normalizacion_019_guard" SELECT NOT EXISTS(SELECT 1 FROM "AdminMfa",json_each("recoveryHashes") AS code WHERE code.type!='text' OR length(code.value)!=64 OR code.value GLOB '*[^a-f0-9]*');
INSERT INTO "_normalizacion_019_guard" SELECT NOT EXISTS(SELECT 1 FROM "AdminMfa",json_each("recoveryHashes") AS code GROUP BY "usuarioId",code.value HAVING count(*)>1);
INSERT INTO "_normalizacion_019_guard" SELECT NOT EXISTS(SELECT 1 FROM "MovimientoInventario" AS m JOIN "Lote" AS l ON l."id"=m."loteId" WHERE m."productoId"!=l."productoId");
INSERT INTO "_normalizacion_019_guard" SELECT NOT EXISTS(SELECT 1 FROM "PedidoDetalleLote" AS a JOIN "PedidoDetalle" AS d ON d."id"=a."detalleId" JOIN "Lote" AS l ON l."id"=a."loteId" WHERE d."productoId"!=l."productoId");
INSERT INTO "_normalizacion_019_guard" SELECT NOT EXISTS(SELECT 1 FROM "ResenaProducto" AS r JOIN "PedidoDetalle" AS d ON d."id"=r."detalleId" JOIN "Pedido" AS p ON p."id"=d."pedidoId" WHERE r."productoId"!=d."productoId" OR r."userId"!=p."userId");
CREATE TEMP TABLE "_normalizacion_019_lotes" AS SELECT "id" AS "movimientoId","loteId" FROM "MovimientoInventario" WHERE "loteId" IS NOT NULL;
CREATE TEMP TABLE "_normalizacion_019_codigos" AS SELECT "usuarioId",code.value AS "hash" FROM "AdminMfa",json_each("recoveryHashes") AS code;

CREATE TABLE "new_MovimientoInventario" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "productoId" TEXT NOT NULL,
 "actorId" TEXT,
 "pedidoId" TEXT,
 "tipo" TEXT NOT NULL CHECK("tipo" IN ('entrada','salida','venta','devolucion')),
 "cantidad" INTEGER NOT NULL CHECK(typeof("cantidad")='integer' AND "cantidad" BETWEEN 1 AND 100000),
 "motivo" TEXT NOT NULL CHECK(length("motivo") BETWEEN 8 AND 300),
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY("actorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 FOREIGN KEY("pedidoId") REFERENCES "Pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MovimientoInventario" SELECT "id","productoId","actorId","pedidoId","tipo","cantidad","motivo","createdAt" FROM "MovimientoInventario";
DROP TABLE "MovimientoInventario";
ALTER TABLE "new_MovimientoInventario" RENAME TO "MovimientoInventario";
CREATE INDEX "MovimientoInventario_productoId_createdAt_idx" ON "MovimientoInventario"("productoId","createdAt");
CREATE TABLE "MovimientoLote" (
 "movimientoId" TEXT NOT NULL PRIMARY KEY REFERENCES "MovimientoInventario"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "loteId" TEXT NOT NULL REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "MovimientoLote" SELECT "movimientoId","loteId" FROM "_normalizacion_019_lotes";
CREATE INDEX "MovimientoLote_loteId_idx" ON "MovimientoLote"("loteId");

CREATE TABLE "new_AdminMfa" (
 "usuarioId" TEXT NOT NULL PRIMARY KEY REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "secretCipher" TEXT NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT false CHECK("enabled" IN (0,1)),
 "setupExpiresAt" DATETIME,
 "lastCounter" INTEGER NOT NULL DEFAULT -1 CHECK("lastCounter">=-1),
 "challengeHash" TEXT,
 "challengeUntil" DATETIME,
 "failedAttempts" INTEGER NOT NULL DEFAULT 0 CHECK("failedAttempts">=0),
 "blockedUntil" DATETIME
);
INSERT INTO "new_AdminMfa" SELECT "usuarioId","secretCipher","enabled","setupExpiresAt","lastCounter","challengeHash","challengeUntil","failedAttempts","blockedUntil" FROM "AdminMfa";
DROP TABLE "AdminMfa";
ALTER TABLE "new_AdminMfa" RENAME TO "AdminMfa";
CREATE TABLE "AdminMfaRecuperacion" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "usuarioId" TEXT NOT NULL REFERENCES "AdminMfa"("usuarioId") ON DELETE CASCADE ON UPDATE CASCADE,
 "hash" TEXT NOT NULL CHECK(length("hash")=64 AND "hash" NOT GLOB '*[^a-f0-9]*'),
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "usedAt" DATETIME
);
INSERT INTO "AdminMfaRecuperacion" ("id","usuarioId","hash") SELECT lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-a'||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))),"usuarioId","hash" FROM "_normalizacion_019_codigos";
CREATE UNIQUE INDEX "AdminMfaRecuperacion_usuarioId_hash_key" ON "AdminMfaRecuperacion"("usuarioId","hash");

CREATE TRIGGER "MovimientoLote_producto_insert" BEFORE INSERT ON "MovimientoLote" WHEN NOT EXISTS(SELECT 1 FROM "MovimientoInventario" m JOIN "Lote" l ON l."id"=NEW."loteId" WHERE m."id"=NEW."movimientoId" AND m."productoId"=l."productoId") BEGIN SELECT RAISE(ABORT,'El lote no pertenece al producto del movimiento.'); END;
CREATE TRIGGER "MovimientoLote_producto_update" BEFORE UPDATE ON "MovimientoLote" WHEN NOT EXISTS(SELECT 1 FROM "MovimientoInventario" m JOIN "Lote" l ON l."id"=NEW."loteId" WHERE m."id"=NEW."movimientoId" AND m."productoId"=l."productoId") BEGIN SELECT RAISE(ABORT,'El lote no pertenece al producto del movimiento.'); END;
CREATE TRIGGER "MovimientoInventario_producto_update" BEFORE UPDATE OF "productoId" ON "MovimientoInventario" WHEN EXISTS(SELECT 1 FROM "MovimientoLote" a JOIN "Lote" l ON l."id"=a."loteId" WHERE a."movimientoId"=OLD."id" AND l."productoId"!=NEW."productoId") BEGIN SELECT RAISE(ABORT,'El producto conserva el vínculo de su lote.'); END;
CREATE TRIGGER "PedidoDetalleLote_producto_insert" BEFORE INSERT ON "PedidoDetalleLote" WHEN NOT EXISTS(SELECT 1 FROM "PedidoDetalle" d JOIN "Lote" l ON l."id"=NEW."loteId" WHERE d."id"=NEW."detalleId" AND d."productoId"=l."productoId") BEGIN SELECT RAISE(ABORT,'El lote no pertenece al producto del detalle.'); END;
CREATE TRIGGER "PedidoDetalleLote_producto_update" BEFORE UPDATE ON "PedidoDetalleLote" WHEN NOT EXISTS(SELECT 1 FROM "PedidoDetalle" d JOIN "Lote" l ON l."id"=NEW."loteId" WHERE d."id"=NEW."detalleId" AND d."productoId"=l."productoId") BEGIN SELECT RAISE(ABORT,'El lote no pertenece al producto del detalle.'); END;
CREATE TRIGGER "ResenaProducto_compra_insert" BEFORE INSERT ON "ResenaProducto" WHEN NOT EXISTS(SELECT 1 FROM "PedidoDetalle" d JOIN "Pedido" p ON p."id"=d."pedidoId" WHERE d."id"=NEW."detalleId" AND d."productoId"=NEW."productoId" AND p."userId"=NEW."userId") BEGIN SELECT RAISE(ABORT,'La reseña debe conservar su compra y propietario.'); END;
CREATE TRIGGER "ResenaProducto_compra_update" BEFORE UPDATE ON "ResenaProducto" WHEN NOT EXISTS(SELECT 1 FROM "PedidoDetalle" d JOIN "Pedido" p ON p."id"=d."pedidoId" WHERE d."id"=NEW."detalleId" AND d."productoId"=NEW."productoId" AND p."userId"=NEW."userId") BEGIN SELECT RAISE(ABORT,'La reseña debe conservar su compra y propietario.'); END;
CREATE TRIGGER "PedidoDetalle_relaciones_update" BEFORE UPDATE OF "productoId","pedidoId" ON "PedidoDetalle" WHEN EXISTS(SELECT 1 FROM "PedidoDetalleLote" a JOIN "Lote" l ON l."id"=a."loteId" WHERE a."detalleId"=OLD."id" AND l."productoId"!=NEW."productoId") OR EXISTS(SELECT 1 FROM "ResenaProducto" r JOIN "Pedido" p ON p."id"=NEW."pedidoId" WHERE r."detalleId"=OLD."id" AND (r."productoId"!=NEW."productoId" OR r."userId"!=p."userId")) BEGIN SELECT RAISE(ABORT,'El detalle conserva sus lotes y reseñas.'); END;
CREATE TRIGGER "Pedido_resenas_update" BEFORE UPDATE OF "userId" ON "Pedido" WHEN EXISTS(SELECT 1 FROM "ResenaProducto" r JOIN "PedidoDetalle" d ON d."id"=r."detalleId" WHERE d."pedidoId"=OLD."id" AND r."userId"!=NEW."userId") BEGIN SELECT RAISE(ABORT,'El pedido conserva al propietario de sus reseñas.'); END;

INSERT INTO "_normalizacion_019_guard" SELECT NOT EXISTS(SELECT 1 FROM pragma_foreign_key_check);
DROP TABLE "_normalizacion_019_guard";
DROP TABLE "_normalizacion_019_lotes";
DROP TABLE "_normalizacion_019_codigos";
COMMIT;
PRAGMA foreign_keys=ON;
