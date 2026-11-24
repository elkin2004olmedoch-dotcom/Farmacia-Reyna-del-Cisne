ALTER TABLE "Producto" ADD COLUMN "advertencias" TEXT CHECK("advertencias" IS NULL OR length("advertencias") BETWEEN 1 AND 1000);
-- Numeric milliseconds preserve Prisma SQLite DateTime comparisons on legacy rows.
ALTER TABLE "Promocion" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT 0;
CREATE TABLE "RegistroPendiente" (
 "usuarioId" TEXT NOT NULL PRIMARY KEY,
 "email" TEXT NOT NULL CHECK(length("email") BETWEEN 3 AND 254),
 "secretHash" TEXT NOT NULL CHECK(length("secretHash")=64 AND "secretHash" NOT GLOB '*[^0-9a-f]*'),
 "tokenVersion" INTEGER NOT NULL CHECK("tokenVersion">=0),
 "tokenEpoch" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" DATETIME NOT NULL,
 "consumedAt" DATETIME,
 "sessionId" TEXT,
 CHECK("expiresAt">"createdAt"),
 CHECK("consumedAt" IS NULL OR "consumedAt">="createdAt"),
 FOREIGN KEY("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY("sessionId") REFERENCES "SesionWeb"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RegistroPendiente_secretHash_key" ON "RegistroPendiente"("secretHash");
CREATE UNIQUE INDEX "RegistroPendiente_sessionId_key" ON "RegistroPendiente"("sessionId");
CREATE TABLE "RevisionCatalogo" ("id" TEXT NOT NULL PRIMARY KEY CHECK("id"='catalogo'),"token" TEXT NOT NULL CHECK(length("token")=32));
INSERT INTO "RevisionCatalogo" ("id","token") VALUES ('catalogo',lower(hex(randomblob(16))));
CREATE TRIGGER "Producto_revision_insert" AFTER INSERT ON "Producto" BEGIN UPDATE "RevisionCatalogo" SET "token"=lower(hex(randomblob(16))) WHERE "id"='catalogo'; END;
CREATE TRIGGER "Producto_revision_update" AFTER UPDATE ON "Producto" BEGIN UPDATE "RevisionCatalogo" SET "token"=lower(hex(randomblob(16))) WHERE "id"='catalogo'; END;
CREATE TRIGGER "Producto_revision_delete" AFTER DELETE ON "Producto" BEGIN UPDATE "RevisionCatalogo" SET "token"=lower(hex(randomblob(16))) WHERE "id"='catalogo'; END;
CREATE TRIGGER "Promocion_revision_insert" AFTER INSERT ON "Promocion" BEGIN UPDATE "RevisionCatalogo" SET "token"=lower(hex(randomblob(16))) WHERE "id"='catalogo'; END;
CREATE TRIGGER "Promocion_revision_update" AFTER UPDATE ON "Promocion" BEGIN UPDATE "RevisionCatalogo" SET "token"=lower(hex(randomblob(16))) WHERE "id"='catalogo'; END;
CREATE TRIGGER "Promocion_revision_delete" AFTER DELETE ON "Promocion" BEGIN UPDATE "RevisionCatalogo" SET "token"=lower(hex(randomblob(16))) WHERE "id"='catalogo'; END;
CREATE TRIGGER "Lote_revision_insert" AFTER INSERT ON "Lote" BEGIN UPDATE "RevisionCatalogo" SET "token"=lower(hex(randomblob(16))) WHERE "id"='catalogo'; END;
CREATE TRIGGER "Lote_revision_update" AFTER UPDATE ON "Lote" BEGIN UPDATE "RevisionCatalogo" SET "token"=lower(hex(randomblob(16))) WHERE "id"='catalogo'; END;
CREATE TRIGGER "Lote_revision_delete" AFTER DELETE ON "Lote" BEGIN UPDATE "RevisionCatalogo" SET "token"=lower(hex(randomblob(16))) WHERE "id"='catalogo'; END;
CREATE TRIGGER "ConfiguracionFiscal_revision_insert" AFTER INSERT ON "ConfiguracionFiscal" BEGIN UPDATE "RevisionCatalogo" SET "token"=lower(hex(randomblob(16))) WHERE "id"='catalogo'; END;
CREATE TRIGGER "ConfiguracionFiscal_revision_update" AFTER UPDATE ON "ConfiguracionFiscal" BEGIN UPDATE "RevisionCatalogo" SET "token"=lower(hex(randomblob(16))) WHERE "id"='catalogo'; END;
CREATE TRIGGER "ConfiguracionFiscal_revision_delete" AFTER DELETE ON "ConfiguracionFiscal" BEGIN UPDATE "RevisionCatalogo" SET "token"=lower(hex(randomblob(16))) WHERE "id"='catalogo'; END;
CREATE TRIGGER "ZonaEntrega_revision_insert" AFTER INSERT ON "ZonaEntrega" BEGIN UPDATE "RevisionCatalogo" SET "token"=lower(hex(randomblob(16))) WHERE "id"='catalogo'; END;
CREATE TRIGGER "ZonaEntrega_revision_update" AFTER UPDATE ON "ZonaEntrega" BEGIN UPDATE "RevisionCatalogo" SET "token"=lower(hex(randomblob(16))) WHERE "id"='catalogo'; END;
CREATE TRIGGER "ZonaEntrega_revision_delete" AFTER DELETE ON "ZonaEntrega" BEGIN UPDATE "RevisionCatalogo" SET "token"=lower(hex(randomblob(16))) WHERE "id"='catalogo'; END;
CREATE TRIGGER "ResenaProducto_revision_insert" AFTER INSERT ON "ResenaProducto" BEGIN UPDATE "RevisionCatalogo" SET "token"=lower(hex(randomblob(16))) WHERE "id"='catalogo'; END;
CREATE TRIGGER "ResenaProducto_revision_update" AFTER UPDATE ON "ResenaProducto" BEGIN UPDATE "RevisionCatalogo" SET "token"=lower(hex(randomblob(16))) WHERE "id"='catalogo'; END;
CREATE TRIGGER "ResenaProducto_revision_delete" AFTER DELETE ON "ResenaProducto" BEGIN UPDATE "RevisionCatalogo" SET "token"=lower(hex(randomblob(16))) WHERE "id"='catalogo'; END;
