BEGIN;
LOCK TABLE "AdminMfa","MovimientoInventario","Lote","PedidoDetalleLote","PedidoDetalle","Pedido","ResenaProducto" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM "AdminMfa" WHERE jsonb_typeof("recoveryHashes"::jsonb)!='array') THEN RAISE EXCEPTION 'La recuperación MFA requiere una lista válida.'; END IF;
 IF EXISTS(SELECT 1 FROM "AdminMfa" CROSS JOIN LATERAL jsonb_array_elements("recoveryHashes"::jsonb) code WHERE jsonb_typeof(code)!='string' OR (code #>> '{}') !~ '^[a-f0-9]{64}$') THEN RAISE EXCEPTION 'Hay códigos MFA históricos inválidos.'; END IF;
 IF EXISTS(SELECT 1 FROM "AdminMfa" CROSS JOIN LATERAL jsonb_array_elements_text("recoveryHashes"::jsonb) code GROUP BY "usuarioId",code HAVING count(*)>1) THEN RAISE EXCEPTION 'Hay códigos MFA históricos duplicados.'; END IF;
 IF EXISTS(SELECT 1 FROM "MovimientoInventario" m JOIN "Lote" l ON l."id"=m."loteId" WHERE m."productoId"!=l."productoId") THEN RAISE EXCEPTION 'Hay movimientos con un lote ajeno.'; END IF;
 IF EXISTS(SELECT 1 FROM "PedidoDetalleLote" a JOIN "PedidoDetalle" d ON d."id"=a."detalleId" JOIN "Lote" l ON l."id"=a."loteId" WHERE d."productoId"!=l."productoId") THEN RAISE EXCEPTION 'Hay detalles con un lote ajeno.'; END IF;
 IF EXISTS(SELECT 1 FROM "ResenaProducto" r JOIN "PedidoDetalle" d ON d."id"=r."detalleId" JOIN "Pedido" p ON p."id"=d."pedidoId" WHERE r."productoId"!=d."productoId" OR r."userId"!=p."userId") THEN RAISE EXCEPTION 'Hay reseñas con compra o propietario incoherentes.'; END IF;
END $$;

CREATE TABLE "MovimientoLote" (
 "movimientoId" TEXT NOT NULL PRIMARY KEY REFERENCES "MovimientoInventario"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "loteId" TEXT NOT NULL REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "MovimientoLote" SELECT "id","loteId" FROM "MovimientoInventario" WHERE "loteId" IS NOT NULL;
CREATE INDEX "MovimientoLote_loteId_idx" ON "MovimientoLote"("loteId");
ALTER TABLE "MovimientoInventario" DROP CONSTRAINT "MovimientoInventario_loteId_fkey";
ALTER TABLE "MovimientoInventario" DROP COLUMN "loteId";

CREATE TABLE "AdminMfaRecuperacion" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "usuarioId" TEXT NOT NULL REFERENCES "AdminMfa"("usuarioId") ON DELETE CASCADE ON UPDATE CASCADE,
 "hash" TEXT NOT NULL CHECK("hash" ~ '^[a-f0-9]{64}$'),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "usedAt" TIMESTAMP(3)
);
INSERT INTO "AdminMfaRecuperacion" ("id","usuarioId","hash") SELECT md5("usuarioId"||':'||code)::uuid::text,"usuarioId",code FROM "AdminMfa" CROSS JOIN LATERAL jsonb_array_elements_text("recoveryHashes"::jsonb) code;
CREATE UNIQUE INDEX "AdminMfaRecuperacion_usuarioId_hash_key" ON "AdminMfaRecuperacion"("usuarioId","hash");
ALTER TABLE "AdminMfa" DROP COLUMN "recoveryHashes";

CREATE FUNCTION "farmacia_movimiento_lote_coherente"() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public."MovimientoInventario" m JOIN public."Lote" l ON l."id"=NEW."loteId" WHERE m."id"=NEW."movimientoId" AND m."productoId"=l."productoId") THEN RAISE EXCEPTION 'El lote no pertenece al producto del movimiento.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "MovimientoLote_producto" BEFORE INSERT OR UPDATE ON "MovimientoLote" FOR EACH ROW EXECUTE FUNCTION "farmacia_movimiento_lote_coherente"();
CREATE FUNCTION "farmacia_movimiento_producto_coherente"() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM public."MovimientoLote" a JOIN public."Lote" l ON l."id"=a."loteId" WHERE a."movimientoId"=OLD."id" AND l."productoId"!=NEW."productoId") THEN RAISE EXCEPTION 'El producto conserva el vínculo de su lote.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "MovimientoInventario_producto" BEFORE UPDATE OF "productoId" ON "MovimientoInventario" FOR EACH ROW EXECUTE FUNCTION "farmacia_movimiento_producto_coherente"();
CREATE FUNCTION "farmacia_detalle_lote_coherente"() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public."PedidoDetalle" d JOIN public."Lote" l ON l."id"=NEW."loteId" WHERE d."id"=NEW."detalleId" AND d."productoId"=l."productoId") THEN RAISE EXCEPTION 'El lote no pertenece al producto del detalle.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "PedidoDetalleLote_producto" BEFORE INSERT OR UPDATE ON "PedidoDetalleLote" FOR EACH ROW EXECUTE FUNCTION "farmacia_detalle_lote_coherente"();
CREATE FUNCTION "farmacia_resena_compra_coherente"() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public."PedidoDetalle" d JOIN public."Pedido" p ON p."id"=d."pedidoId" WHERE d."id"=NEW."detalleId" AND d."productoId"=NEW."productoId" AND p."userId"=NEW."userId") THEN RAISE EXCEPTION 'La reseña debe conservar su compra y propietario.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "ResenaProducto_compra" BEFORE INSERT OR UPDATE ON "ResenaProducto" FOR EACH ROW EXECUTE FUNCTION "farmacia_resena_compra_coherente"();
CREATE FUNCTION "farmacia_detalle_relaciones_coherentes"() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM public."PedidoDetalleLote" a JOIN public."Lote" l ON l."id"=a."loteId" WHERE a."detalleId"=OLD."id" AND l."productoId"!=NEW."productoId") OR EXISTS(SELECT 1 FROM public."ResenaProducto" r JOIN public."Pedido" p ON p."id"=NEW."pedidoId" WHERE r."detalleId"=OLD."id" AND (r."productoId"!=NEW."productoId" OR r."userId"!=p."userId")) THEN RAISE EXCEPTION 'El detalle conserva sus lotes y reseñas.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "PedidoDetalle_relaciones" BEFORE UPDATE OF "productoId","pedidoId" ON "PedidoDetalle" FOR EACH ROW EXECUTE FUNCTION "farmacia_detalle_relaciones_coherentes"();
CREATE FUNCTION "farmacia_pedido_resenas_coherentes"() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM public."ResenaProducto" r JOIN public."PedidoDetalle" d ON d."id"=r."detalleId" WHERE d."pedidoId"=OLD."id" AND r."userId"!=NEW."userId") THEN RAISE EXCEPTION 'El pedido conserva al propietario de sus reseñas.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Pedido_resenas" BEFORE UPDATE OF "userId" ON "Pedido" FOR EACH ROW EXECUTE FUNCTION "farmacia_pedido_resenas_coherentes"();

ALTER TABLE "MovimientoLote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminMfaRecuperacion" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "MovimientoLote","AdminMfaRecuperacion" FROM PUBLIC;
REVOKE ALL ON FUNCTION "farmacia_movimiento_lote_coherente"(),"farmacia_movimiento_producto_coherente"(),"farmacia_detalle_lote_coherente"(),"farmacia_resena_compra_coherente"(),"farmacia_detalle_relaciones_coherentes"(),"farmacia_pedido_resenas_coherentes"() FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON TABLE public."MovimientoLote",public."AdminMfaRecuperacion" FROM %I',role_name); END IF;
 END LOOP;
END $$;
COMMIT;
