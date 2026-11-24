CREATE TABLE "SesionWeb" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "usuarioId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "tokenVersion" INTEGER NOT NULL CHECK("tokenVersion">=0),
 "secretHash" TEXT NOT NULL CHECK(length("secretHash")=64 AND "secretHash" NOT GLOB '*[^0-9a-f]*'),
 "previousSecretHash" TEXT,
 "previousUntil" DATETIME,
 "expiresAt" DATETIME NOT NULL,
 "revokedAt" DATETIME,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK("expiresAt">"createdAt"),
 CHECK(("previousSecretHash" IS NULL AND "previousUntil" IS NULL) OR ("previousSecretHash" IS NOT NULL AND "previousUntil" IS NOT NULL AND length("previousSecretHash")=64 AND "previousSecretHash" NOT GLOB '*[^0-9a-f]*'))
);
CREATE INDEX "SesionWeb_usuarioId_createdAt_idx" ON "SesionWeb"("usuarioId","createdAt");
CREATE INDEX "SesionWeb_usuarioId_expiresAt_idx" ON "SesionWeb"("usuarioId","expiresAt");
CREATE TABLE "PasswordReset" (
 "usuarioId" TEXT NOT NULL PRIMARY KEY REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "email" TEXT NOT NULL,
 "tokenHash" TEXT NOT NULL CHECK(length("tokenHash")=64 AND "tokenHash" NOT GLOB '*[^0-9a-f]*'),
 "expiresAt" DATETIME NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK("expiresAt">"createdAt")
);
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");
