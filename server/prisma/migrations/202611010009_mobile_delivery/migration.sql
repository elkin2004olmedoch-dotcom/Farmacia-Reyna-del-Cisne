CREATE TABLE "SesionMovil" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "usuarioId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "tokenVersion" INTEGER NOT NULL CHECK(typeof("tokenVersion")='integer' AND "tokenVersion">=0),
 "secretHash" TEXT NOT NULL CHECK(length("secretHash")=64 AND "secretHash" NOT GLOB '*[^0-9a-f]*'),
 "previousSecretHash" TEXT CHECK("previousSecretHash" IS NULL OR (length("previousSecretHash")=64 AND "previousSecretHash" NOT GLOB '*[^0-9a-f]*')),
 "expiresAt" DATETIME NOT NULL,
 "revokedAt" DATETIME,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "SesionMovil_usuarioId_expiresAt_idx" ON "SesionMovil"("usuarioId","expiresAt");
CREATE INDEX "SesionMovil_expiresAt_idx" ON "SesionMovil"("expiresAt");
ALTER TABLE "Entrega" ADD COLUMN "sesionSeguimientoId" TEXT REFERENCES "SesionMovil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Entrega_sesionSeguimientoId_key" ON "Entrega"("sesionSeguimientoId");
