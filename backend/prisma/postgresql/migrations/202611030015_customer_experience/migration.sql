-- AlterTable
ALTER TABLE "Entrega" ADD COLUMN     "codigoBloqueadoHasta" TIMESTAMP(3),
ADD COLUMN     "codigoEntregaNonce" TEXT,
ADD COLUMN     "codigoEntregaRequerido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "codigoIntentos" INTEGER NOT NULL DEFAULT 0 CHECK("codigoIntentos">=0),
ADD COLUMN     "estimadaCalculadaAt" TIMESTAMP(3),
ADD COLUMN     "estimadaDesde" TIMESTAMP(3),
ADD COLUMN     "estimadaFuente" TEXT,
ADD COLUMN     "estimadaGpsVersion" INTEGER,
ADD COLUMN     "estimadaHasta" TIMESTAMP(3),
ADD COLUMN     "estimadaMuestraAt" TIMESTAMP(3),
ADD COLUMN     "estimadaRepartidorId" TEXT,
ADD COLUMN     "estimadaVenceAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DireccionGuardada" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alias" TEXT NOT NULL CHECK(length("alias") BETWEEN 1 AND 40),
    "provincia" TEXT NOT NULL CHECK(length("provincia") BETWEEN 2 AND 80),
    "ciudad" TEXT NOT NULL CHECK(length("ciudad") BETWEEN 2 AND 100),
    "direccion" TEXT NOT NULL CHECK(length("direccion") BETWEEN 8 AND 240),
    "codigoPostal" TEXT CHECK("codigoPostal" IS NULL OR length("codigoPostal")=6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DireccionGuardada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorito" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResenaProducto" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "detalleId" TEXT NOT NULL,
    "puntuacion" INTEGER NOT NULL CHECK("puntuacion" BETWEEN 1 AND 5),
    "comentario" TEXT NOT NULL DEFAULT '' CHECK(length("comentario")<=800),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResenaProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntregaIncidencia" (
    "id" TEXT NOT NULL,
    "entregaId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL CHECK("tipo" IN ('retraso','direccion','ausencia','averia','otro')),
    "descripcion" TEXT NOT NULL CHECK(length("descripcion") BETWEEN 8 AND 300),
    "resueltaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntregaIncidencia_pkey" PRIMARY KEY ("id")
);

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

-- AddForeignKey
ALTER TABLE "DireccionGuardada" ADD CONSTRAINT "DireccionGuardada_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorito" ADD CONSTRAINT "Favorito_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorito" ADD CONSTRAINT "Favorito_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResenaProducto" ADD CONSTRAINT "ResenaProducto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResenaProducto" ADD CONSTRAINT "ResenaProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResenaProducto" ADD CONSTRAINT "ResenaProducto_detalleId_fkey" FOREIGN KEY ("detalleId") REFERENCES "PedidoDetalle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaIncidencia" ADD CONSTRAINT "EntregaIncidencia_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaIncidencia" ADD CONSTRAINT "EntregaIncidencia_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Private application tables: access is mediated by the existing authenticated API.
ALTER TABLE "DireccionGuardada" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Favorito" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ResenaProducto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EntregaIncidencia" ENABLE ROW LEVEL SECURITY;
