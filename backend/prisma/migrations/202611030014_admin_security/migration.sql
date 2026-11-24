ALTER TABLE "Usuario" ADD COLUMN "tokenEpoch" TEXT;

CREATE TABLE "AdminMfa" (
 "usuarioId" TEXT NOT NULL PRIMARY KEY REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "secretCipher" TEXT NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT false CHECK("enabled" IN (0,1)),
 "setupExpiresAt" DATETIME,
 "lastCounter" INTEGER NOT NULL DEFAULT -1 CHECK("lastCounter">=-1),
 "recoveryHashes" TEXT NOT NULL DEFAULT '[]',
 "challengeHash" TEXT,
 "challengeUntil" DATETIME,
 "failedAttempts" INTEGER NOT NULL DEFAULT 0 CHECK("failedAttempts">=0),
 "blockedUntil" DATETIME
);
CREATE TABLE "AuditoriaAdmin" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "actorId" TEXT NOT NULL,
 "accion" TEXT NOT NULL CHECK(length("accion") BETWEEN 1 AND 80),
 "ruta" TEXT NOT NULL CHECK(length("ruta") BETWEEN 1 AND 200),
 "status" INTEGER NOT NULL CHECK("status" BETWEEN 100 AND 599),
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditoriaAdmin_createdAt_id_idx" ON "AuditoriaAdmin"("createdAt","id");
