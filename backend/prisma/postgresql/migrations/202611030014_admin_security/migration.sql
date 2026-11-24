ALTER TABLE "Usuario" ADD COLUMN "tokenEpoch" TEXT;

CREATE TABLE "AdminMfa" (
 "usuarioId" TEXT NOT NULL PRIMARY KEY REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "secretCipher" TEXT NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT false,
 "setupExpiresAt" TIMESTAMP(3),
 "lastCounter" INTEGER NOT NULL DEFAULT -1 CHECK("lastCounter">=-1),
 "recoveryHashes" TEXT NOT NULL DEFAULT '[]',
 "challengeHash" TEXT,
 "challengeUntil" TIMESTAMP(3),
 "failedAttempts" INTEGER NOT NULL DEFAULT 0 CHECK("failedAttempts">=0),
 "blockedUntil" TIMESTAMP(3)
);
CREATE TABLE "AuditoriaAdmin" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "actorId" TEXT NOT NULL,
 "accion" TEXT NOT NULL CHECK(length("accion") BETWEEN 1 AND 80),
 "ruta" TEXT NOT NULL CHECK(length("ruta") BETWEEN 1 AND 200),
 "status" INTEGER NOT NULL CHECK("status" BETWEEN 100 AND 599),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditoriaAdmin_createdAt_id_idx" ON "AuditoriaAdmin"("createdAt","id");
ALTER TABLE "AdminMfa" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditoriaAdmin" ENABLE ROW LEVEL SECURITY;
