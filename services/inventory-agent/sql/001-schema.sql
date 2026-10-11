-- STANDALONE ONLY. Never use this to copy the pharmacy's production inventory.
-- Apply this OR 002-integrated.sql, then apply 003-agent.sql.
BEGIN;
CREATE SCHEMA IF NOT EXISTS inventory_agent;
CREATE TABLE inventory_agent."ModoFuente" ("id" BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK("id"), "modo" TEXT NOT NULL CHECK("modo"='Standalone'));
INSERT INTO inventory_agent."ModoFuente" VALUES(TRUE,'Standalone');
CREATE TABLE inventory_agent."Medicamentos" (
 "id" TEXT PRIMARY KEY CHECK("id" ~ '^[A-Za-z0-9_-]{1,80}$'), "nombre" TEXT NOT NULL CHECK(length(trim("nombre")) BETWEEN 2 AND 120),
 "stock" INTEGER NOT NULL CHECK("stock" BETWEEN 0 AND 100000), "stockMinimo" INTEGER NOT NULL CHECK("stockMinimo" BETWEEN 0 AND 100000), "activo" BOOLEAN NOT NULL DEFAULT TRUE,
 "fechaCaducidad" DATE, "diasAlertaCaducidad" INTEGER NOT NULL DEFAULT 30 CHECK("diasAlertaCaducidad" BETWEEN 0 AND 365),
 "prioridad" TEXT NOT NULL DEFAULT 'intermedio' CHECK("prioridad" IN ('primordial','intermedio','bajo'))
);
CREATE TABLE inventory_agent."Proveedores" (
 "id" TEXT PRIMARY KEY CHECK("id" ~ '^[A-Za-z0-9_-]{1,80}$'), "nombre" TEXT NOT NULL CHECK(length(trim("nombre")) BETWEEN 2 AND 120),
 "email" TEXT CHECK("email" IS NULL OR (length("email")<=254 AND "email" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')), "activo" BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE inventory_agent."Lotes" (
 "id" TEXT PRIMARY KEY, "productoId" TEXT NOT NULL REFERENCES inventory_agent."Medicamentos"("id") ON DELETE RESTRICT,
 "stock" INTEGER NOT NULL CHECK("stock" BETWEEN 0 AND 100000), "vencimiento" DATE NOT NULL
);
-- Deferrable aggregate checks allow a legitimate stock+lot update in one
-- transaction, while serialized product row locks prevent concurrent over-allocation.
CREATE FUNCTION inventory_agent.check_lot_balance() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE product TEXT; products TEXT[]; available INTEGER; allocated BIGINT;
BEGIN
 -- PostgreSQL resolves record fields when preparing an expression. Keep the
 -- statements for the two row types separate, even when a CASE seems lazy.
 IF TG_TABLE_NAME='Medicamentos' THEN
  products:=ARRAY[NEW."id"];
 ELSIF TG_OP='INSERT' THEN
  products:=ARRAY[NEW."productoId"];
 ELSIF TG_OP='DELETE' THEN
  products:=ARRAY[OLD."productoId"];
 ELSE
  products:=ARRAY[OLD."productoId",NEW."productoId"];
 END IF;
 FOR product IN SELECT DISTINCT p FROM unnest(products) p WHERE p IS NOT NULL LOOP
  SELECT "stock" INTO available FROM inventory_agent."Medicamentos" WHERE "id"=product FOR UPDATE;
  SELECT coalesce(sum("stock"),0) INTO allocated FROM inventory_agent."Lotes" WHERE "productoId"=product;
  IF available IS NOT NULL AND allocated>available THEN RAISE EXCEPTION 'LOT_STOCK_EXCEEDS_PRODUCT' USING ERRCODE='23514'; END IF;
 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "Lotes_balance" AFTER INSERT OR UPDATE OR DELETE ON inventory_agent."Lotes" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_agent.check_lot_balance();
CREATE CONSTRAINT TRIGGER "Medicamentos_balance" AFTER UPDATE ON inventory_agent."Medicamentos" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_agent.check_lot_balance();
ALTER TABLE inventory_agent."Medicamentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_agent."Proveedores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_agent."Lotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_agent."ModoFuente" ENABLE ROW LEVEL SECURITY;
COMMIT;
