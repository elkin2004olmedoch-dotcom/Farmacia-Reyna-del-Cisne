CREATE TABLE "SesionMovil" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "usuarioId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "tokenVersion" INTEGER NOT NULL CHECK("tokenVersion">=0),
 "secretHash" TEXT NOT NULL CHECK("secretHash" ~ '^[0-9a-f]{64}$'),
 "previousSecretHash" TEXT CHECK("previousSecretHash" IS NULL OR "previousSecretHash" ~ '^[0-9a-f]{64}$'),
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "revokedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "SesionMovil_usuarioId_expiresAt_idx" ON "SesionMovil"("usuarioId","expiresAt");
CREATE INDEX "SesionMovil_expiresAt_idx" ON "SesionMovil"("expiresAt");
ALTER TABLE "Entrega" ADD COLUMN "sesionSeguimientoId" TEXT REFERENCES "SesionMovil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Entrega_sesionSeguimientoId_key" ON "Entrega"("sesionSeguimientoId");
ALTER TABLE "SesionMovil" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "SesionMovil" FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE "SesionMovil" FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE "SesionMovil" FROM authenticated; END IF; END $$;
