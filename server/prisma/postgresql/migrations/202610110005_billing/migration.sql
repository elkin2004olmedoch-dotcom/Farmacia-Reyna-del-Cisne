-- Billing is additive. Existing order tax snapshots and credentials are preserved.
CREATE TABLE "ConfiguracionEmisor" (
 "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'principal' CHECK("id"='principal'),
 "ruc" TEXT NOT NULL CHECK("ruc" ~ '^[0-9]{10}001$'),
 "razonSocial" TEXT NOT NULL CHECK(length("razonSocial") BETWEEN 2 AND 300),
 "nombreComercial" TEXT NOT NULL CHECK(length("nombreComercial") BETWEEN 2 AND 300),
 "direccionMatriz" TEXT NOT NULL CHECK(length("direccionMatriz") BETWEEN 8 AND 300),
 "direccionEstablecimiento" TEXT NOT NULL CHECK(length("direccionEstablecimiento") BETWEEN 8 AND 300),
 "establecimiento" TEXT NOT NULL DEFAULT '001' CHECK("establecimiento" ~ '^[0-9]{3}$' AND "establecimiento"!='000'),
 "puntoEmision" TEXT NOT NULL DEFAULT '001' CHECK("puntoEmision" ~ '^[0-9]{3}$' AND "puntoEmision"!='000'),
 "ambiente" TEXT NOT NULL DEFAULT '1' CHECK("ambiente" IN ('1','2')),
 "obligadoContabilidad" BOOLEAN NOT NULL DEFAULT false,
 "softwarePropio" BOOLEAN NOT NULL DEFAULT true,
 "rucProveedorSoftware" TEXT CHECK("rucProveedorSoftware" IS NULL OR "rucProveedorSoftware" ~ '^[0-9]{10}001$'),
 "certificadoCifrado" TEXT,
 "certificadoVenceEn" TIMESTAMP(3),
 "certificadoRuc" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CHECK("softwarePropio" OR "rucProveedorSoftware" IS NOT NULL),
 CHECK(("certificadoCifrado" IS NULL AND "certificadoVenceEn" IS NULL) OR ("certificadoCifrado" LIKE 'v1.%' AND "certificadoVenceEn" IS NOT NULL))
);
CREATE TABLE "SecuenciaFactura" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "emisorRuc" TEXT NOT NULL,
 "ambiente" TEXT NOT NULL CHECK("ambiente" IN ('1','2')),
 "establecimiento" TEXT NOT NULL,
 "puntoEmision" TEXT NOT NULL,
 "ultimo" INTEGER NOT NULL DEFAULT 0 CHECK("ultimo" BETWEEN 0 AND 999999999)
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
 "secuencial" INTEGER CHECK("secuencial" IS NULL OR "secuencial" BETWEEN 1 AND 999999999),
 "claveAcceso" TEXT CHECK("claveAcceso" IS NULL OR "claveAcceso" ~ '^[0-9]{49}$'),
 "fechaEmision" TIMESTAMP(3),
 "snapshot" TEXT NOT NULL,
 "xmlBorrador" TEXT NOT NULL,
 "xmlFirmado" TEXT,
 "xmlAutorizado" TEXT,
 "numeroAutorizacion" TEXT,
 "fechaAutorizacion" TIMESTAMP(3),
 "mensajes" TEXT NOT NULL DEFAULT '[]',
 "ultimoError" TEXT,
 "procesandoHasta" TIMESTAMP(3),
 "intentos" INTEGER NOT NULL DEFAULT 0 CHECK("intentos">=0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CHECK(("secuencial" IS NULL AND "claveAcceso" IS NULL) OR ("secuencial" IS NOT NULL AND "claveAcceso" IS NOT NULL AND "fechaEmision" IS NOT NULL)),
 CHECK("estado"!='AUTORIZADA' OR ("numeroAutorizacion" IS NOT NULL AND "claveAcceso" IS NOT NULL AND "numeroAutorizacion"="claveAcceso" AND "fechaAutorizacion" IS NOT NULL AND "xmlAutorizado" IS NOT NULL AND "xmlFirmado" IS NOT NULL))
);
CREATE UNIQUE INDEX "FacturaPedido_pedidoId_key" ON "FacturaPedido"("pedidoId");
CREATE UNIQUE INDEX "FacturaPedido_claveAcceso_key" ON "FacturaPedido"("claveAcceso");
CREATE UNIQUE INDEX "FacturaPedido_emisorRuc_ambiente_establecimiento_puntoEmision_secuencial_key" ON "FacturaPedido"("emisorRuc","ambiente","establecimiento","puntoEmision","secuencial");
CREATE INDEX "FacturaPedido_createdAt_idx" ON "FacturaPedido"("createdAt");
-- Supabase browser/anon clients have no policy. Only the trusted backend uses DB.
ALTER TABLE "ConfiguracionEmisor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SecuenciaFactura" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FacturaPedido" ENABLE ROW LEVEL SECURITY;
