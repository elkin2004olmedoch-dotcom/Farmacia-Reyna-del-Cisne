-- Additive migration: original prices, stock, credentials and order history remain intact.
ALTER TABLE "Producto" ADD COLUMN "descuentoPorcentaje" INTEGER NOT NULL DEFAULT 0 CHECK(typeof("descuentoPorcentaje")='integer' AND "descuentoPorcentaje" BETWEEN 0 AND 85);
ALTER TABLE "Producto" ADD COLUMN "ivaCategoria" TEXT NOT NULL DEFAULT 'general' CHECK("ivaCategoria" IN ('general','cero'));
ALTER TABLE "Producto" ADD COLUMN "fundamentoIva" TEXT CHECK("fundamentoIva" IS NULL OR length("fundamentoIva") BETWEEN 8 AND 300);
ALTER TABLE "Producto" ADD COLUMN "tipoProducto" TEXT NOT NULL DEFAULT 'cuidado' CHECK("tipoProducto" IN ('medicamento','insumo','cuidado','suplemento'));
ALTER TABLE "Producto" ADD COLUMN "codigoInterno" TEXT CHECK("codigoInterno" IS NULL OR length("codigoInterno") BETWEEN 2 AND 40);
ALTER TABLE "Producto" ADD COLUMN "codigoBarras" TEXT CHECK("codigoBarras" IS NULL OR (length("codigoBarras") IN (8,12,13,14) AND "codigoBarras" NOT GLOB '*[^0-9]*'));
ALTER TABLE "Producto" ADD COLUMN "laboratorio" TEXT CHECK("laboratorio" IS NULL OR length("laboratorio") BETWEEN 1 AND 120);
ALTER TABLE "Producto" ADD COLUMN "principioActivo" TEXT CHECK("principioActivo" IS NULL OR length("principioActivo") BETWEEN 1 AND 160);
ALTER TABLE "Producto" ADD COLUMN "concentracion" TEXT CHECK("concentracion" IS NULL OR length("concentracion") BETWEEN 1 AND 100);
ALTER TABLE "Producto" ADD COLUMN "presentacion" TEXT CHECK("presentacion" IS NULL OR length("presentacion") BETWEEN 1 AND 120);
ALTER TABLE "Producto" ADD COLUMN "registroSanitario" TEXT CHECK("registroSanitario" IS NULL OR length("registroSanitario") BETWEEN 1 AND 100);
ALTER TABLE "Producto" ADD COLUMN "requiereReceta" BOOLEAN NOT NULL DEFAULT false CHECK("requiereReceta" IN (0,1));
ALTER TABLE "Producto" ADD COLUMN "stockMinimo" INTEGER NOT NULL DEFAULT 5 CHECK(typeof("stockMinimo")='integer' AND "stockMinimo" BETWEEN 0 AND 100000);
CREATE UNIQUE INDEX "Producto_codigoInterno_key" ON "Producto"("codigoInterno");
ALTER TABLE "Pedido" ADD COLUMN "baseImponible" DECIMAL CHECK("baseImponible" IS NULL OR "baseImponible">=0);
ALTER TABLE "Pedido" ADD COLUMN "ivaMonto" DECIMAL CHECK("ivaMonto" IS NULL OR "ivaMonto">=0);
ALTER TABLE "PedidoDetalle" ADD COLUMN "ivaPorcentaje" INTEGER CHECK("ivaPorcentaje" IS NULL OR (typeof("ivaPorcentaje")='integer' AND "ivaPorcentaje" IN (0,13,14,15)));
ALTER TABLE "PedidoDetalle" ADD COLUMN "baseImponible" DECIMAL CHECK("baseImponible" IS NULL OR "baseImponible">=0);
ALTER TABLE "PedidoDetalle" ADD COLUMN "ivaMonto" DECIMAL CHECK("ivaMonto" IS NULL OR "ivaMonto">=0);
ALTER TABLE "PedidoDetalle" ADD COLUMN "totalLinea" DECIMAL CHECK("totalLinea" IS NULL OR "totalLinea">=0);

CREATE TABLE "ConfiguracionFiscal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tarifaGeneral" INTEGER NOT NULL CHECK(typeof("tarifaGeneral")='integer' AND "tarifaGeneral" IN (13,14,15)),
  "inicioVigencia" DATETIME NOT NULL CHECK(typeof("inicioVigencia")='integer' AND "inicioVigencia">=1711947600000),
  "referenciaNormativa" TEXT NOT NULL CHECK(length("referenciaNormativa") BETWEEN 8 AND 300),
  "actorId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY("actorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ConfiguracionFiscal_inicioVigencia_key" ON "ConfiguracionFiscal"("inicioVigencia");
INSERT INTO "ConfiguracionFiscal" ("id","tarifaGeneral","inicioVigencia","referenciaNormativa","updatedAt") VALUES ('iva-general-inicial',15,1711947600000,'Ley de Régimen Tributario Interno, art. 65; Decreto Ejecutivo 198; Circular SRI NAC-DGECCGC25-00000006 (vigencia 2026).',CURRENT_TIMESTAMP);

CREATE TABLE "Proveedor" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "nombre" TEXT NOT NULL CHECK(length("nombre") BETWEEN 2 AND 120),
  "ruc" TEXT NOT NULL CHECK(length("ruc")=13 AND "ruc" NOT GLOB '*[^0-9]*'),
  "email" TEXT NOT NULL CHECK(length("email") BETWEEN 3 AND 254),
  "telefono" TEXT NOT NULL CHECK(substr("telefono",1,4)='+593' AND substr("telefono",5) NOT GLOB '*[^0-9]*' AND ((length("telefono")=13 AND substr("telefono",5,1)='9') OR (length("telefono")=12 AND substr("telefono",5,1) BETWEEN '2' AND '7'))),
  "direccion" TEXT NOT NULL CHECK(length("direccion") BETWEEN 8 AND 200),
  "activo" BOOLEAN NOT NULL DEFAULT true CHECK("activo" IN (0,1)),
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Proveedor_ruc_key" ON "Proveedor"("ruc");
CREATE TABLE "Lote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productoId" TEXT NOT NULL,
  "numero" TEXT NOT NULL CHECK(length("numero") BETWEEN 1 AND 80),
  "vencimiento" TEXT NOT NULL CHECK(length("vencimiento")=10 AND "vencimiento" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND strftime('%Y-%m-%d',"vencimiento",'+0 days') IS NOT NULL AND strftime('%Y-%m-%d',"vencimiento",'+0 days')="vencimiento"),
  "stock" INTEGER NOT NULL CHECK(typeof("stock")='integer' AND "stock" BETWEEN 0 AND 100000),
  "costoUnitario" DECIMAL NOT NULL CHECK("costoUnitario" BETWEEN 0 AND 100000 AND abs("costoUnitario"*100-round("costoUnitario"*100))<0.000001),
  "proveedorId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
  "cantidad" INTEGER NOT NULL CHECK(typeof("cantidad")='integer' AND "cantidad" BETWEEN 1 AND 100000),
  "motivo" TEXT NOT NULL CHECK(length("motivo") BETWEEN 8 AND 300),
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY("actorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY("pedidoId") REFERENCES "Pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "MovimientoInventario_productoId_createdAt_idx" ON "MovimientoInventario"("productoId","createdAt");
CREATE TABLE "PedidoDetalleLote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "detalleId" TEXT NOT NULL,
  "loteId" TEXT NOT NULL,
  "cantidad" INTEGER NOT NULL CHECK(typeof("cantidad")='integer' AND "cantidad" BETWEEN 1 AND 100000),
  FOREIGN KEY("detalleId") REFERENCES "PedidoDetalle"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PedidoDetalleLote_detalleId_loteId_key" ON "PedidoDetalleLote"("detalleId","loteId");

CREATE TRIGGER "Producto_validacion_insert" BEFORE INSERT ON "Producto" WHEN typeof(NEW."stock")!='integer' OR NEW."stock" NOT BETWEEN 0 AND 100000 OR NEW."precio" NOT BETWEEN 0 AND 100000 OR abs(NEW."precio"*100-round(NEW."precio"*100))>=0.000001 OR (NEW."ivaCategoria"='cero' AND NEW."fundamentoIva" IS NULL) BEGIN SELECT RAISE(ABORT,'Producto inválido: stock, precio o fundamento IVA.'); END;
CREATE TRIGGER "Producto_validacion_update" BEFORE UPDATE ON "Producto" WHEN typeof(NEW."stock")!='integer' OR NEW."stock" NOT BETWEEN 0 AND 100000 OR NEW."precio" NOT BETWEEN 0 AND 100000 OR abs(NEW."precio"*100-round(NEW."precio"*100))>=0.000001 OR (NEW."ivaCategoria"='cero' AND NEW."fundamentoIva" IS NULL) BEGIN SELECT RAISE(ABORT,'Producto inválido: stock, precio o fundamento IVA.'); END;
CREATE TRIGGER "Promocion_validacion_insert" BEFORE INSERT ON "Promocion" WHEN typeof(NEW."descuentoPorcentaje")!='integer' OR NEW."descuentoPorcentaje" NOT BETWEEN 0 AND 85 OR (NEW."inicio" IS NOT NULL AND NEW."fin" IS NOT NULL AND NEW."fin"<=NEW."inicio") BEGIN SELECT RAISE(ABORT,'Promoción inválida: porcentaje o vigencia.'); END;
CREATE TRIGGER "Promocion_validacion_update" BEFORE UPDATE ON "Promocion" WHEN typeof(NEW."descuentoPorcentaje")!='integer' OR NEW."descuentoPorcentaje" NOT BETWEEN 0 AND 85 OR (NEW."inicio" IS NOT NULL AND NEW."fin" IS NOT NULL AND NEW."fin"<=NEW."inicio") BEGIN SELECT RAISE(ABORT,'Promoción inválida: porcentaje o vigencia.'); END;
CREATE TRIGGER "Pedido_fiscal_insert" BEFORE INSERT ON "Pedido" WHEN NEW."total"<0 OR (NEW."baseImponible" IS NOT NULL AND NEW."ivaMonto" IS NOT NULL AND abs(NEW."total"-NEW."baseImponible"-NEW."ivaMonto")>0.000001) BEGIN SELECT RAISE(ABORT,'Totales fiscales inconsistentes.'); END;
CREATE TRIGGER "Pedido_fiscal_update" BEFORE UPDATE ON "Pedido" WHEN NEW."total"<0 OR (NEW."baseImponible" IS NOT NULL AND NEW."ivaMonto" IS NOT NULL AND abs(NEW."total"-NEW."baseImponible"-NEW."ivaMonto")>0.000001) BEGIN SELECT RAISE(ABORT,'Totales fiscales inconsistentes.'); END;
CREATE TRIGGER "PedidoDetalle_fiscal_insert" BEFORE INSERT ON "PedidoDetalle" WHEN NEW."cantidad"<1 OR NEW."precioUnitario"<0 OR (NEW."totalLinea" IS NOT NULL AND abs(NEW."totalLinea"-NEW."precioUnitario"*NEW."cantidad")>0.000001) OR (NEW."baseImponible" IS NOT NULL AND NEW."ivaMonto" IS NOT NULL AND abs(NEW."totalLinea"-NEW."baseImponible"-NEW."ivaMonto")>0.000001) BEGIN SELECT RAISE(ABORT,'Detalle fiscal inconsistente.'); END;
CREATE TRIGGER "PedidoDetalle_fiscal_update" BEFORE UPDATE ON "PedidoDetalle" WHEN NEW."cantidad"<1 OR NEW."precioUnitario"<0 OR (NEW."totalLinea" IS NOT NULL AND abs(NEW."totalLinea"-NEW."precioUnitario"*NEW."cantidad")>0.000001) OR (NEW."baseImponible" IS NOT NULL AND NEW."ivaMonto" IS NOT NULL AND abs(NEW."totalLinea"-NEW."baseImponible"-NEW."ivaMonto")>0.000001) BEGIN SELECT RAISE(ABORT,'Detalle fiscal inconsistente.'); END;
CREATE TRIGGER "Producto_stock_lotes_update" BEFORE UPDATE ON "Producto" WHEN NEW."stock"<(SELECT coalesce(sum("stock"),0) FROM "Lote" WHERE "productoId"=NEW."id") BEGIN SELECT RAISE(ABORT,'El stock físico no cubre sus lotes.'); END;
CREATE TRIGGER "Lote_stock_producto_insert" BEFORE INSERT ON "Lote" WHEN NEW."stock"+(SELECT coalesce(sum("stock"),0) FROM "Lote" WHERE "productoId"=NEW."productoId")>(SELECT "stock" FROM "Producto" WHERE "id"=NEW."productoId") BEGIN SELECT RAISE(ABORT,'El stock del lote supera el inventario físico.'); END;
CREATE TRIGGER "Lote_stock_producto_update" BEFORE UPDATE ON "Lote" WHEN NEW."productoId"!=OLD."productoId" OR NEW."stock"+(SELECT coalesce(sum("stock"),0) FROM "Lote" WHERE "productoId"=NEW."productoId" AND "id"!=NEW."id")>(SELECT "stock" FROM "Producto" WHERE "id"=NEW."productoId") BEGIN SELECT RAISE(ABORT,'El lote no corresponde al inventario físico.'); END;
CREATE TRIGGER "Pedido_fiscal_completo_insert" BEFORE INSERT ON "Pedido" WHEN (NEW."baseImponible" IS NULL)!=(NEW."ivaMonto" IS NULL) BEGIN SELECT RAISE(ABORT,'El desglose fiscal debe estar completo.'); END;
CREATE TRIGGER "Pedido_fiscal_completo_update" BEFORE UPDATE ON "Pedido" WHEN (NEW."baseImponible" IS NULL)!=(NEW."ivaMonto" IS NULL) BEGIN SELECT RAISE(ABORT,'El desglose fiscal debe estar completo.'); END;
CREATE TRIGGER "PedidoDetalle_fiscal_completo_insert" BEFORE INSERT ON "PedidoDetalle" WHEN ((NEW."ivaPorcentaje" IS NULL)+(NEW."baseImponible" IS NULL)+(NEW."ivaMonto" IS NULL)+(NEW."totalLinea" IS NULL)) NOT IN (0,4) BEGIN SELECT RAISE(ABORT,'El detalle fiscal debe estar completo.'); END;
CREATE TRIGGER "PedidoDetalle_fiscal_completo_update" BEFORE UPDATE ON "PedidoDetalle" WHEN ((NEW."ivaPorcentaje" IS NULL)+(NEW."baseImponible" IS NULL)+(NEW."ivaMonto" IS NULL)+(NEW."totalLinea" IS NULL)) NOT IN (0,4) BEGIN SELECT RAISE(ABORT,'El detalle fiscal debe estar completo.'); END;
