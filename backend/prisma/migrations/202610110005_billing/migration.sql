-- Billing is additive. Existing order tax snapshots and credentials are preserved.
CREATE TABLE "ConfiguracionEmisor" (
 "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'principal' CHECK("id"='principal'),
 "ruc" TEXT NOT NULL CHECK(length("ruc")=13 AND "ruc" NOT GLOB '*[^0-9]*' AND substr("ruc",11)='001'),
 "razonSocial" TEXT NOT NULL CHECK(length("razonSocial") BETWEEN 2 AND 300),
 "nombreComercial" TEXT NOT NULL CHECK(length("nombreComercial") BETWEEN 2 AND 300),
 "direccionMatriz" TEXT NOT NULL CHECK(length("direccionMatriz") BETWEEN 8 AND 300),
 "direccionEstablecimiento" TEXT NOT NULL CHECK(length("direccionEstablecimiento") BETWEEN 8 AND 300),
 "establecimiento" TEXT NOT NULL DEFAULT '001' CHECK(length("establecimiento")=3 AND "establecimiento" NOT GLOB '*[^0-9]*' AND "establecimiento"!='000'),
 "puntoEmision" TEXT NOT NULL DEFAULT '001' CHECK(length("puntoEmision")=3 AND "puntoEmision" NOT GLOB '*[^0-9]*' AND "puntoEmision"!='000'),
 "ambiente" TEXT NOT NULL DEFAULT '1' CHECK("ambiente" IN ('1','2')),
 "obligadoContabilidad" BOOLEAN NOT NULL DEFAULT false CHECK("obligadoContabilidad" IN (0,1)),
 "softwarePropio" BOOLEAN NOT NULL DEFAULT true CHECK("softwarePropio" IN (0,1)),
 "rucProveedorSoftware" TEXT CHECK("rucProveedorSoftware" IS NULL OR (length("rucProveedorSoftware")=13 AND "rucProveedorSoftware" NOT GLOB '*[^0-9]*' AND substr("rucProveedorSoftware",11)='001')),
 "certificadoCifrado" TEXT,
 "certificadoVenceEn" DATETIME,
 "certificadoRuc" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL,
 CHECK("softwarePropio"=1 OR "rucProveedorSoftware" IS NOT NULL),
 CHECK(("certificadoCifrado" IS NULL AND "certificadoVenceEn" IS NULL) OR ("certificadoCifrado" LIKE 'v1.%' AND "certificadoVenceEn" IS NOT NULL))
);
CREATE TABLE "SecuenciaFactura" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "emisorRuc" TEXT NOT NULL,
 "ambiente" TEXT NOT NULL CHECK("ambiente" IN ('1','2')),
 "establecimiento" TEXT NOT NULL,
 "puntoEmision" TEXT NOT NULL,
 "ultimo" INTEGER NOT NULL DEFAULT 0 CHECK(typeof("ultimo")='integer' AND "ultimo" BETWEEN 0 AND 999999999)
);
CREATE UNIQUE INDEX "SecuenciaFactura_emisorRuc_ambiente_establecimiento_puntoEmision_key" ON "SecuenciaFactura"("emisorRuc","ambiente","establecimiento","puntoEmision");
CREATE TABLE "FacturaPedido" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "pedidoId" TEXT NOT NULL REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "estado" TEXT NOT NULL DEFAULT 'BORRADOR' CHECK("estado" IN ('BORRADOR','FIRMADA','RECIBIDA','EN_PROCESO','AUTORIZADA','DEVUELTA','NO_AUTORIZADA','ERROR')),
 "ambiente" TEXT NOT NULL CHECK("ambiente" IN ('1','2')),
 "emisorRuc" TEXT NOT NULL,
 "establecimiento" TEXT NOT NULL,
 "puntoEmision" TEXT NOT NULL,
 "secuencial" INTEGER CHECK("secuencial" IS NULL OR (typeof("secuencial")='integer' AND "secuencial" BETWEEN 1 AND 999999999)),
 "claveAcceso" TEXT CHECK("claveAcceso" IS NULL OR (length("claveAcceso")=49 AND "claveAcceso" NOT GLOB '*[^0-9]*')),
 "fechaEmision" DATETIME,
 "snapshot" TEXT NOT NULL,
 "xmlBorrador" TEXT NOT NULL,
 "xmlFirmado" TEXT,
 "xmlAutorizado" TEXT,
 "numeroAutorizacion" TEXT,
 "fechaAutorizacion" DATETIME,
 "mensajes" TEXT NOT NULL DEFAULT '[]',
 "ultimoError" TEXT,
 "procesandoHasta" DATETIME,
 "intentos" INTEGER NOT NULL DEFAULT 0 CHECK(typeof("intentos")='integer' AND "intentos">=0),
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL,
 CHECK(("secuencial" IS NULL AND "claveAcceso" IS NULL) OR ("secuencial" IS NOT NULL AND "claveAcceso" IS NOT NULL AND "fechaEmision" IS NOT NULL)),
 CHECK("estado"!='AUTORIZADA' OR ("numeroAutorizacion" IS NOT NULL AND "claveAcceso" IS NOT NULL AND "numeroAutorizacion"="claveAcceso" AND "fechaAutorizacion" IS NOT NULL AND "xmlAutorizado" IS NOT NULL AND "xmlFirmado" IS NOT NULL))
);
CREATE UNIQUE INDEX "FacturaPedido_pedidoId_key" ON "FacturaPedido"("pedidoId");
CREATE UNIQUE INDEX "FacturaPedido_claveAcceso_key" ON "FacturaPedido"("claveAcceso");
CREATE UNIQUE INDEX "FacturaPedido_emisorRuc_ambiente_establecimiento_puntoEmision_secuencial_key" ON "FacturaPedido"("emisorRuc","ambiente","establecimiento","puntoEmision","secuencial");
CREATE INDEX "FacturaPedido_createdAt_idx" ON "FacturaPedido"("createdAt");
