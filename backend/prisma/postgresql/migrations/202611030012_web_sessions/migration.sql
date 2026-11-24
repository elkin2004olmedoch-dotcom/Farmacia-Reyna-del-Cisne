CREATE TABLE "SesionWeb" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "usuarioId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "tokenVersion" INTEGER NOT NULL CHECK("tokenVersion">=0),
 "secretHash" TEXT NOT NULL CHECK("secretHash" ~ '^[0-9a-f]{64}$'),
 "previousSecretHash" TEXT,
 "previousUntil" TIMESTAMP(3),
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "revokedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK("expiresAt">"createdAt"),
 CHECK(("previousSecretHash" IS NULL AND "previousUntil" IS NULL) OR ("previousSecretHash" IS NOT NULL AND "previousUntil" IS NOT NULL AND "previousSecretHash" ~ '^[0-9a-f]{64}$'))
);
CREATE INDEX "SesionWeb_usuarioId_createdAt_idx" ON "SesionWeb"("usuarioId","createdAt");
CREATE INDEX "SesionWeb_usuarioId_expiresAt_idx" ON "SesionWeb"("usuarioId","expiresAt");
CREATE TABLE "PasswordReset" (
 "usuarioId" TEXT NOT NULL PRIMARY KEY REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "email" TEXT NOT NULL,
 "tokenHash" TEXT NOT NULL CHECK("tokenHash" ~ '^[0-9a-f]{64}$'),
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK("expiresAt">"createdAt")
);
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");
ALTER TABLE "SesionWeb" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "SesionWeb" FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE "SesionWeb" FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE "SesionWeb" FROM authenticated; END IF; END $$;
ALTER TABLE "PasswordReset" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PasswordReset" FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE "PasswordReset" FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE "PasswordReset" FROM authenticated; END IF; END $$;
