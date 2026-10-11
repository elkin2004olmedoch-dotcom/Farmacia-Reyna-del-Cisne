-- INTEGRATED ONLY: views read the existing source, without copying stock.
-- This file never INSERTs, UPDATEs, or DELETEs public inventory records.
-- Apply this OR 001-schema.sql, then apply 003-agent.sql.
BEGIN;
CREATE SCHEMA IF NOT EXISTS inventory_agent;
CREATE TABLE inventory_agent."ModoFuente" ("id" BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK("id"), "modo" TEXT NOT NULL CHECK("modo"='Integrated'));
INSERT INTO inventory_agent."ModoFuente" VALUES(TRUE,'Integrated');
CREATE FUNCTION inventory_agent.safe_expiry(value TEXT) RETURNS DATE LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN
 IF value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN NULL; END IF;
 RETURN value::date;
EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RETURN NULL;
END $$;
CREATE VIEW inventory_agent."Medicamentos" WITH(security_invoker=true) AS SELECT "id","nombre","stock","stockMinimo","activo",NULL::date AS "fechaCaducidad",NULL::int AS "diasAlertaCaducidad",'intermedio'::text AS "prioridad" FROM public."Producto";
CREATE VIEW inventory_agent."Proveedores" WITH(security_invoker=true) AS SELECT "id","nombre","email","activo" FROM public."Proveedor";
CREATE VIEW inventory_agent."Lotes" WITH(security_invoker=true) AS SELECT "id","productoId","stock",inventory_agent.safe_expiry("vencimiento") AS "vencimiento" FROM public."Lote";
REVOKE ALL ON inventory_agent."Medicamentos",inventory_agent."Proveedores",inventory_agent."Lotes" FROM PUBLIC;
DO $$ DECLARE r TEXT; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON inventory_agent."Medicamentos",inventory_agent."Proveedores",inventory_agent."Lotes" FROM %I',r); END IF;
END LOOP; END $$;
ALTER TABLE inventory_agent."ModoFuente" ENABLE ROW LEVEL SECURITY;
COMMIT;
