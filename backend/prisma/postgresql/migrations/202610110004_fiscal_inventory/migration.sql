-- Additive migration: existing catalog prices, stock and historical orders are preserved.
ALTER TABLE "Producto" ADD COLUMN "descuentoPorcentaje" INTEGER NOT NULL DEFAULT 0 CHECK("descuentoPorcentaje" BETWEEN 0 AND 85),
 ADD COLUMN "ivaCategoria" TEXT NOT NULL DEFAULT 'general' CHECK("ivaCategoria" IN ('general','cero')),
 ADD COLUMN "fundamentoIva" TEXT CHECK("fundamentoIva" IS NULL OR length("fundamentoIva") BETWEEN 8 AND 300),
 ADD COLUMN "tipoProducto" TEXT NOT NULL DEFAULT 'cuidado' CHECK("tipoProducto" IN ('medicamento','insumo','cuidado','suplemento')),
 ADD COLUMN "codigoInterno" TEXT CHECK("codigoInterno" IS NULL OR length("codigoInterno") BETWEEN 2 AND 40),
 ADD COLUMN "codigoBarras" TEXT CHECK("codigoBarras" IS NULL OR "codigoBarras" ~ '^([0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$'),
 ADD COLUMN "laboratorio" TEXT CHECK("laboratorio" IS NULL OR length("laboratorio") BETWEEN 1 AND 120),
 ADD COLUMN "principioActivo" TEXT CHECK("principioActivo" IS NULL OR length("principioActivo") BETWEEN 1 AND 160),
 ADD COLUMN "concentracion" TEXT CHECK("concentracion" IS NULL OR length("concentracion") BETWEEN 1 AND 100),
 ADD COLUMN "presentacion" TEXT CHECK("presentacion" IS NULL OR length("presentacion") BETWEEN 1 AND 120),
 ADD COLUMN "registroSanitario" TEXT CHECK("registroSanitario" IS NULL OR length("registroSanitario") BETWEEN 1 AND 100),
 ADD COLUMN "requiereReceta" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "stockMinimo" INTEGER NOT NULL DEFAULT 5 CHECK("stockMinimo" BETWEEN 0 AND 100000);
CREATE UNIQUE INDEX "Producto_codigoInterno_key" ON "Producto"("codigoInterno");
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_precio_stock_check" CHECK("precio" BETWEEN 0 AND 100000 AND "precio"*100=round("precio"*100) AND "stock" BETWEEN 0 AND 100000 AND ("ivaCategoria"!='cero' OR "fundamentoIva" IS NOT NULL)) NOT VALID;
ALTER TABLE "Promocion" ADD CONSTRAINT "Promocion_porcentaje_vigencia_check" CHECK("descuentoPorcentaje" BETWEEN 0 AND 85 AND ("inicio" IS NULL OR "fin" IS NULL OR "fin">"inicio")) NOT VALID;
ALTER TABLE "Pedido" ADD COLUMN "baseImponible" DECIMAL(65,30) CHECK("baseImponible" IS NULL OR "baseImponible">=0), ADD COLUMN "ivaMonto" DECIMAL(65,30) CHECK("ivaMonto" IS NULL OR "ivaMonto">=0);
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_totales_fiscales_check" CHECK("total">=0 AND ("baseImponible" IS NULL OR "ivaMonto" IS NULL OR "total"="baseImponible"+"ivaMonto")) NOT VALID;
ALTER TABLE "PedidoDetalle" ADD COLUMN "ivaPorcentaje" INTEGER CHECK("ivaPorcentaje" IS NULL OR "ivaPorcentaje" IN (0,13,14,15)), ADD COLUMN "baseImponible" DECIMAL(65,30) CHECK("baseImponible" IS NULL OR "baseImponible">=0), ADD COLUMN "ivaMonto" DECIMAL(65,30) CHECK("ivaMonto" IS NULL OR "ivaMonto">=0), ADD COLUMN "totalLinea" DECIMAL(65,30) CHECK("totalLinea" IS NULL OR "totalLinea">=0);
ALTER TABLE "PedidoDetalle" ADD CONSTRAINT "PedidoDetalle_totales_fiscales_check" CHECK("cantidad">=1 AND "precioUnitario">=0 AND ("totalLinea" IS NULL OR "totalLinea"="precioUnitario"*"cantidad") AND ("baseImponible" IS NULL OR "ivaMonto" IS NULL OR "totalLinea"="baseImponible"+"ivaMonto")) NOT VALID;

CREATE TABLE "ConfiguracionFiscal" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "tarifaGeneral" INTEGER NOT NULL CHECK("tarifaGeneral" IN (13,14,15)),
 "inicioVigencia" TIMESTAMP(3) NOT NULL CHECK("inicioVigencia">=TIMESTAMP '2024-04-01 05:00:00'),
 "referenciaNormativa" TEXT NOT NULL CHECK(length("referenciaNormativa") BETWEEN 8 AND 300),
 "actorId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ConfiguracionFiscal_actorId_fkey" FOREIGN KEY("actorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ConfiguracionFiscal_inicioVigencia_key" ON "ConfiguracionFiscal"("inicioVigencia");
INSERT INTO "ConfiguracionFiscal" ("id","tarifaGeneral","inicioVigencia","referenciaNormativa","updatedAt") VALUES ('iva-general-inicial',15,TIMESTAMP '2024-04-01 05:00:00','Ley de Régimen Tributario Interno, art. 65; Decreto Ejecutivo 198; Circular SRI NAC-DGECCGC25-00000006 (vigencia 2026).',CURRENT_TIMESTAMP);
CREATE TABLE "Proveedor" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "nombre" TEXT NOT NULL CHECK(length("nombre") BETWEEN 2 AND 120),
 "ruc" TEXT NOT NULL CHECK("ruc" ~ '^[0-9]{13}$'),
 "email" TEXT NOT NULL CHECK(length("email") BETWEEN 3 AND 254),
 "telefono" TEXT NOT NULL CHECK("telefono" ~ '^\+593([2-7][0-9]{7}|9[0-9]{8})$'),
 "direccion" TEXT NOT NULL CHECK(length("direccion") BETWEEN 8 AND 200),
 "activo" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "Proveedor_ruc_key" ON "Proveedor"("ruc");
CREATE TABLE "Lote" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "productoId" TEXT NOT NULL,
 "numero" TEXT NOT NULL CHECK(length("numero") BETWEEN 1 AND 80),
 "vencimiento" TEXT NOT NULL CHECK("vencimiento" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND to_char(to_date("vencimiento",'YYYY-MM-DD'),'YYYY-MM-DD')="vencimiento"),
 "stock" INTEGER NOT NULL CHECK("stock" BETWEEN 0 AND 100000),
 "costoUnitario" DECIMAL(65,30) NOT NULL CHECK("costoUnitario" BETWEEN 0 AND 100000 AND "costoUnitario"*100=round("costoUnitario"*100)),
 "proveedorId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Lote_productoId_fkey" FOREIGN KEY("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "Lote_proveedorId_fkey" FOREIGN KEY("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Lote_productoId_numero_key" ON "Lote"("productoId","numero");
CREATE INDEX "Lote_productoId_vencimiento_idx" ON "Lote"("productoId","vencimiento");
CREATE TABLE "MovimientoInventario" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "productoId" TEXT NOT NULL,
 "loteId" TEXT,
 "actorId" TEXT,
 "pedidoId" TEXT,
 "tipo" TEXT NOT NULL CHECK("tipo" IN ('entrada','salida','venta','devolucion')),
 "cantidad" INTEGER NOT NULL CHECK("cantidad" BETWEEN 1 AND 100000),
 "motivo" TEXT NOT NULL CHECK(length("motivo") BETWEEN 8 AND 300),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "MovimientoInventario_productoId_fkey" FOREIGN KEY("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "MovimientoInventario_loteId_fkey" FOREIGN KEY("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "MovimientoInventario_actorId_fkey" FOREIGN KEY("actorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 CONSTRAINT "MovimientoInventario_pedidoId_fkey" FOREIGN KEY("pedidoId") REFERENCES "Pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "MovimientoInventario_productoId_createdAt_idx" ON "MovimientoInventario"("productoId","createdAt");
CREATE TABLE "PedidoDetalleLote" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "detalleId" TEXT NOT NULL,
 "loteId" TEXT NOT NULL,
 "cantidad" INTEGER NOT NULL CHECK("cantidad" BETWEEN 1 AND 100000),
 CONSTRAINT "PedidoDetalleLote_detalleId_fkey" FOREIGN KEY("detalleId") REFERENCES "PedidoDetalle"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "PedidoDetalleLote_loteId_fkey" FOREIGN KEY("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PedidoDetalleLote_detalleId_loteId_key" ON "PedidoDetalleLote"("detalleId","loteId");
ALTER TABLE "ConfiguracionFiscal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Proveedor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MovimientoInventario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PedidoDetalleLote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_fiscal_completo_check" CHECK(("baseImponible" IS NULL)=("ivaMonto" IS NULL));
ALTER TABLE "PedidoDetalle" ADD CONSTRAINT "PedidoDetalle_fiscal_completo_check" CHECK(("ivaPorcentaje" IS NULL AND "baseImponible" IS NULL AND "ivaMonto" IS NULL AND "totalLinea" IS NULL) OR ("ivaPorcentaje" IS NOT NULL AND "baseImponible" IS NOT NULL AND "ivaMonto" IS NOT NULL AND "totalLinea" IS NOT NULL));
CREATE FUNCTION "farmacia_producto_stock_lotes"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."stock"<(SELECT coalesce(sum("stock"),0) FROM "Lote" WHERE "productoId"=NEW."id") THEN RAISE EXCEPTION 'El stock físico no cubre sus lotes.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Producto_stock_lotes_update" BEFORE UPDATE ON "Producto" FOR EACH ROW EXECUTE FUNCTION "farmacia_producto_stock_lotes"();
CREATE FUNCTION "farmacia_lote_stock_producto"() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE physical integer; BEGIN
 IF TG_OP='UPDATE' AND NEW."productoId"!=OLD."productoId" THEN RAISE EXCEPTION 'El lote no se puede trasladar a otro producto.' USING ERRCODE='23514'; END IF;
 SELECT "stock" INTO physical FROM "Producto" WHERE "id"=NEW."productoId" FOR UPDATE;
 IF NEW."stock"+(SELECT coalesce(sum("stock"),0) FROM "Lote" WHERE "productoId"=NEW."productoId" AND "id"!=NEW."id")>physical THEN RAISE EXCEPTION 'El stock del lote supera el inventario físico.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Lote_stock_producto_insert_update" BEFORE INSERT OR UPDATE ON "Lote" FOR EACH ROW EXECUTE FUNCTION "farmacia_lote_stock_producto"();
