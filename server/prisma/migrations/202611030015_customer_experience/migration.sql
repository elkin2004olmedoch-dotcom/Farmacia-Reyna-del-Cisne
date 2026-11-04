-- CreateTable
CREATE TABLE "DireccionGuardada" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "alias" TEXT NOT NULL CHECK(length("alias") BETWEEN 1 AND 40),
    "provincia" TEXT NOT NULL CHECK(length("provincia") BETWEEN 2 AND 80),
    "ciudad" TEXT NOT NULL CHECK(length("ciudad") BETWEEN 2 AND 100),
    "direccion" TEXT NOT NULL CHECK(length("direccion") BETWEEN 8 AND 240),
    "codigoPostal" TEXT CHECK("codigoPostal" IS NULL OR length("codigoPostal")=6),
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DireccionGuardada_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Favorito" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Favorito_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Favorito_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResenaProducto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "detalleId" TEXT NOT NULL,
    "puntuacion" INTEGER NOT NULL CHECK("puntuacion" BETWEEN 1 AND 5),
    "comentario" TEXT NOT NULL DEFAULT '' CHECK(length("comentario")<=800),
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResenaProducto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResenaProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResenaProducto_detalleId_fkey" FOREIGN KEY ("detalleId") REFERENCES "PedidoDetalle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntregaIncidencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entregaId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL CHECK("tipo" IN ('retraso','direccion','ausencia','averia','otro')),
    "descripcion" TEXT NOT NULL CHECK(length("descripcion") BETWEEN 8 AND 300),
    "resueltaAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EntregaIncidencia_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EntregaIncidencia_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "Entrega" ADD COLUMN "codigoEntregaRequerido" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Entrega" ADD COLUMN "codigoEntregaNonce" TEXT;
ALTER TABLE "Entrega" ADD COLUMN "codigoIntentos" INTEGER NOT NULL DEFAULT 0 CHECK("codigoIntentos">=0);
ALTER TABLE "Entrega" ADD COLUMN "codigoBloqueadoHasta" DATETIME;
ALTER TABLE "Entrega" ADD COLUMN "estimadaDesde" DATETIME;
ALTER TABLE "Entrega" ADD COLUMN "estimadaHasta" DATETIME;
ALTER TABLE "Entrega" ADD COLUMN "estimadaCalculadaAt" DATETIME;
ALTER TABLE "Entrega" ADD COLUMN "estimadaFuente" TEXT;
ALTER TABLE "Entrega" ADD COLUMN "estimadaGpsVersion" INTEGER;
ALTER TABLE "Entrega" ADD COLUMN "estimadaMuestraAt" DATETIME;
ALTER TABLE "Entrega" ADD COLUMN "estimadaVenceAt" DATETIME;
ALTER TABLE "Entrega" ADD COLUMN "estimadaRepartidorId" TEXT;

-- CreateIndex
CREATE INDEX "DireccionGuardada_userId_createdAt_idx" ON "DireccionGuardada"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Favorito_productoId_idx" ON "Favorito"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorito_userId_productoId_key" ON "Favorito"("userId", "productoId");

-- CreateIndex
CREATE UNIQUE INDEX "ResenaProducto_detalleId_key" ON "ResenaProducto"("detalleId");

-- CreateIndex
CREATE INDEX "ResenaProducto_productoId_createdAt_idx" ON "ResenaProducto"("productoId", "createdAt");

-- CreateIndex
CREATE INDEX "ResenaProducto_userId_createdAt_idx" ON "ResenaProducto"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResenaProducto_userId_productoId_key" ON "ResenaProducto"("userId", "productoId");

-- CreateIndex
CREATE INDEX "EntregaIncidencia_entregaId_createdAt_idx" ON "EntregaIncidencia"("entregaId", "createdAt");

-- CreateIndex
CREATE INDEX "EntregaIncidencia_actorId_idx" ON "EntregaIncidencia"("actorId");

