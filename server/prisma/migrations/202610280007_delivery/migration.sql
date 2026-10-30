CREATE TABLE "ZonaEntrega" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "nombre" TEXT NOT NULL CHECK(length("nombre") BETWEEN 2 AND 120),
 "provincia" TEXT NOT NULL CHECK(length("provincia") BETWEEN 2 AND 80),
 "canton" TEXT NOT NULL CHECK(length("canton") BETWEEN 2 AND 80),
 "tarifaCentavos" INTEGER CHECK("tarifaCentavos" IS NULL OR (typeof("tarifaCentavos")='integer' AND "tarifaCentavos" BETWEEN 0 AND 10000000)),
 "ivaCategoria" TEXT NOT NULL DEFAULT 'general' CHECK("ivaCategoria" IN ('general','cero')),
 "fundamentoIva" TEXT CHECK("fundamentoIva" IS NULL OR length("fundamentoIva") BETWEEN 8 AND 300),
 "activa" BOOLEAN NOT NULL DEFAULT true CHECK("activa" IN (0,1)),
 "version" INTEGER NOT NULL DEFAULT 1 CHECK(typeof("version")='integer' AND "version">=1),
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL,
 CHECK("ivaCategoria"!='cero' OR "fundamentoIva" IS NOT NULL)
);
CREATE INDEX "ZonaEntrega_activa_nombre_idx" ON "ZonaEntrega"("activa","nombre");
CREATE TABLE "ZonaEntregaTarifa" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "zonaEntregaId" TEXT NOT NULL REFERENCES "ZonaEntrega"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "version" INTEGER NOT NULL CHECK(typeof("version")='integer' AND "version">=1),
 "tarifaCentavos" INTEGER CHECK("tarifaCentavos" IS NULL OR typeof("tarifaCentavos")='integer' AND "tarifaCentavos" BETWEEN 0 AND 10000000),
 "ivaCategoria" TEXT NOT NULL CHECK("ivaCategoria" IN ('general','cero')),
 "fundamentoIva" TEXT CHECK("fundamentoIva" IS NULL OR length("fundamentoIva") BETWEEN 8 AND 300),
 "actorId" TEXT REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK("ivaCategoria"!='cero' OR "fundamentoIva" IS NOT NULL)
);
CREATE UNIQUE INDEX "ZonaEntregaTarifa_zonaEntregaId_version_key" ON "ZonaEntregaTarifa"("zonaEntregaId","version");
ALTER TABLE "Producto" ADD COLUMN "controlado" BOOLEAN NOT NULL DEFAULT false CHECK("controlado" IN (0,1));
ALTER TABLE "Producto" ADD COLUMN "biologico" BOOLEAN NOT NULL DEFAULT false CHECK("biologico" IN (0,1));
ALTER TABLE "Producto" ADD COLUMN "cadenaFrio" BOOLEAN NOT NULL DEFAULT false CHECK("cadenaFrio" IN (0,1));
ALTER TABLE "Pedido" ADD COLUMN "subtotalProductos" DECIMAL CHECK("subtotalProductos" IS NULL OR "subtotalProductos">=0);
ALTER TABLE "Pedido" ADD COLUMN "costoEnvioCentavos" INTEGER NOT NULL DEFAULT 0 CHECK(typeof("costoEnvioCentavos")='integer' AND "costoEnvioCentavos" BETWEEN 0 AND 10000000);
ALTER TABLE "Pedido" ADD COLUMN "envioIvaPorcentaje" INTEGER CHECK("envioIvaPorcentaje" IS NULL OR "envioIvaPorcentaje" IN (0,13,14,15));
ALTER TABLE "Pedido" ADD COLUMN "envioBaseImponible" DECIMAL CHECK("envioBaseImponible" IS NULL OR "envioBaseImponible">=0);
ALTER TABLE "Pedido" ADD COLUMN "envioIvaMonto" DECIMAL CHECK("envioIvaMonto" IS NULL OR "envioIvaMonto">=0);
ALTER TABLE "Pedido" ADD COLUMN "zonaEntregaId" TEXT REFERENCES "ZonaEntrega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pedido" ADD COLUMN "latitudEntrega" REAL CHECK("latitudEntrega" IS NULL OR "latitudEntrega" BETWEEN -90 AND 90);
ALTER TABLE "Pedido" ADD COLUMN "longitudEntrega" REAL CHECK("longitudEntrega" IS NULL OR "longitudEntrega" BETWEEN -180 AND 180);
ALTER TABLE "Pedido" ADD COLUMN "ubicacionEntregaAceptadaAt" DATETIME;
CREATE INDEX "Pedido_zonaEntregaId_idx" ON "Pedido"("zonaEntregaId");
CREATE TABLE "Entrega" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "pedidoId" TEXT NOT NULL REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "repartidorId" TEXT REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "estado" TEXT NOT NULL DEFAULT 'asignada' CHECK("estado" IN ('asignada','en_camino','en_destino','entregada','cancelada')),
 "version" INTEGER NOT NULL DEFAULT 1 CHECK(typeof("version")='integer' AND "version">=1),
 "gpsVersion" INTEGER NOT NULL DEFAULT 0 CHECK(typeof("gpsVersion")='integer' AND "gpsVersion">=0),
 "asignadaAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "salidaAt" DATETIME,
 "llegadaAt" DATETIME,
 "finalizadaAt" DATETIME,
 "latitud" REAL CHECK("latitud" IS NULL OR "latitud" BETWEEN -90 AND 90),
 "longitud" REAL CHECK("longitud" IS NULL OR "longitud" BETWEEN -180 AND 180),
 "precision" REAL CHECK("precision" IS NULL OR "precision" BETWEEN 0 AND 10000),
 "registradaAt" DATETIME,
 "recibidaAt" DATETIME,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL,
 CHECK(("latitud" IS NULL AND "longitud" IS NULL AND "precision" IS NULL AND "registradaAt" IS NULL AND "recibidaAt" IS NULL) OR ("latitud" IS NOT NULL AND "longitud" IS NOT NULL AND "precision" IS NOT NULL AND "registradaAt" IS NOT NULL AND "recibidaAt" IS NOT NULL AND "estado" IN ('en_camino','en_destino'))),
 CHECK("estado" NOT IN ('entregada','cancelada') OR "finalizadaAt" IS NOT NULL)
);
CREATE UNIQUE INDEX "Entrega_pedidoId_key" ON "Entrega"("pedidoId");
CREATE INDEX "Entrega_repartidorId_estado_idx" ON "Entrega"("repartidorId","estado");
CREATE INDEX "Entrega_estado_createdAt_idx" ON "Entrega"("estado","createdAt");
CREATE INDEX "Entrega_recibidaAt_idx" ON "Entrega"("recibidaAt");
INSERT INTO "ZonaEntrega"("id","nombre","provincia","canton","tarifaCentavos","updatedAt") VALUES ('puerto-quito','Todo Puerto Quito','Pichincha','Puerto Quito',NULL,CURRENT_TIMESTAMP);
INSERT INTO "ZonaEntregaTarifa"("id","zonaEntregaId","version","tarifaCentavos","ivaCategoria") VALUES ('puerto-quito-inicial','puerto-quito',1,NULL,'general');

CREATE TRIGGER "Pedido_envio_insert" BEFORE INSERT ON "Pedido" WHEN NOT ((NEW."subtotalProductos" IS NULL OR abs(NEW."total"-NEW."subtotalProductos"-NEW."costoEnvioCentavos"/100.0)<0.000001) AND ((NEW."envioIvaPorcentaje" IS NULL AND NEW."envioBaseImponible" IS NULL AND NEW."envioIvaMonto" IS NULL AND NEW."costoEnvioCentavos"=0) OR (NEW."envioIvaPorcentaje" IS NOT NULL AND NEW."envioBaseImponible" IS NOT NULL AND NEW."envioIvaMonto" IS NOT NULL AND abs(NEW."costoEnvioCentavos"/100.0-NEW."envioBaseImponible"-NEW."envioIvaMonto")<0.000001)) AND ((NEW."latitudEntrega" IS NULL AND NEW."longitudEntrega" IS NULL) OR (NEW."latitudEntrega" IS NOT NULL AND NEW."longitudEntrega" IS NOT NULL AND NEW."ubicacionEntregaAceptadaAt" IS NOT NULL AND NEW."entrega"='delivery'))) BEGIN SELECT RAISE(ABORT,'Snapshot de envío o consentimiento inconsistente.'); END;

CREATE TRIGGER "Pedido_envio_update" BEFORE UPDATE ON "Pedido" WHEN NOT ((NEW."subtotalProductos" IS NULL OR abs(NEW."total"-NEW."subtotalProductos"-NEW."costoEnvioCentavos"/100.0)<0.000001) AND ((NEW."envioIvaPorcentaje" IS NULL AND NEW."envioBaseImponible" IS NULL AND NEW."envioIvaMonto" IS NULL AND NEW."costoEnvioCentavos"=0) OR (NEW."envioIvaPorcentaje" IS NOT NULL AND NEW."envioBaseImponible" IS NOT NULL AND NEW."envioIvaMonto" IS NOT NULL AND abs(NEW."costoEnvioCentavos"/100.0-NEW."envioBaseImponible"-NEW."envioIvaMonto")<0.000001)) AND ((NEW."latitudEntrega" IS NULL AND NEW."longitudEntrega" IS NULL) OR (NEW."latitudEntrega" IS NOT NULL AND NEW."longitudEntrega" IS NOT NULL AND NEW."ubicacionEntregaAceptadaAt" IS NOT NULL AND NEW."entrega"='delivery'))) BEGIN SELECT RAISE(ABORT,'Snapshot de envío o consentimiento inconsistente.'); END;
