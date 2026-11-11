ALTER TABLE "Producto" ADD COLUMN "advertencias" TEXT CHECK("advertencias" IS NULL OR length("advertencias") BETWEEN 1 AND 1000);
ALTER TABLE "Promocion" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE TABLE "RegistroPendiente" (
 "usuarioId" TEXT NOT NULL PRIMARY KEY,
 "email" TEXT NOT NULL CHECK(length("email") BETWEEN 3 AND 254),
 "secretHash" TEXT NOT NULL CHECK("secretHash" ~ '^[0-9a-f]{64}$'),
 "tokenVersion" INTEGER NOT NULL CHECK("tokenVersion">=0),
 "tokenEpoch" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "consumedAt" TIMESTAMP(3),
 "sessionId" TEXT,
 CHECK("expiresAt">"createdAt"),
 CHECK("consumedAt" IS NULL OR "consumedAt">="createdAt"),
 FOREIGN KEY("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY("sessionId") REFERENCES "SesionWeb"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RegistroPendiente_secretHash_key" ON "RegistroPendiente"("secretHash");
CREATE UNIQUE INDEX "RegistroPendiente_sessionId_key" ON "RegistroPendiente"("sessionId");
CREATE TABLE "RevisionCatalogo" ("id" TEXT NOT NULL PRIMARY KEY CHECK("id"='catalogo'),"token" TEXT NOT NULL CHECK(length("token")=32));
INSERT INTO "RevisionCatalogo" ("id","token") VALUES ('catalogo',md5(random()::text || clock_timestamp()::text));
CREATE FUNCTION "farmacia_catalogo_revision"() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$ BEGIN UPDATE public."RevisionCatalogo" SET "token"=md5(random()::text || clock_timestamp()::text) WHERE "id"='catalogo'; RETURN NULL; END $$;
CREATE TRIGGER "Producto_revision" AFTER INSERT OR UPDATE OR DELETE ON "Producto" FOR EACH STATEMENT EXECUTE FUNCTION "farmacia_catalogo_revision"();
CREATE TRIGGER "Promocion_revision" AFTER INSERT OR UPDATE OR DELETE ON "Promocion" FOR EACH STATEMENT EXECUTE FUNCTION "farmacia_catalogo_revision"();
CREATE TRIGGER "Lote_revision" AFTER INSERT OR UPDATE OR DELETE ON "Lote" FOR EACH STATEMENT EXECUTE FUNCTION "farmacia_catalogo_revision"();
CREATE TRIGGER "ConfiguracionFiscal_revision" AFTER INSERT OR UPDATE OR DELETE ON "ConfiguracionFiscal" FOR EACH STATEMENT EXECUTE FUNCTION "farmacia_catalogo_revision"();
CREATE TRIGGER "ZonaEntrega_revision" AFTER INSERT OR UPDATE OR DELETE ON "ZonaEntrega" FOR EACH STATEMENT EXECUTE FUNCTION "farmacia_catalogo_revision"();
CREATE TRIGGER "ResenaProducto_revision" AFTER INSERT OR UPDATE OR DELETE ON "ResenaProducto" FOR EACH STATEMENT EXECUTE FUNCTION "farmacia_catalogo_revision"();
ALTER TABLE "RegistroPendiente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevisionCatalogo" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON FUNCTION "farmacia_catalogo_revision"() FROM PUBLIC;
