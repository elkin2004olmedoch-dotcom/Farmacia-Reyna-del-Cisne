-- Existing accounts remain unverified without requiring verification or revoking sessions.
ALTER TABLE "Usuario" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Usuario" ADD COLUMN "emailVerificationRequired" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "EmailVerification" (
  "usuarioId" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerification_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmailVerification_tokenHash_check" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "EmailVerification_expiry_check" CHECK ("expiresAt">"createdAt")
);
CREATE UNIQUE INDEX "EmailVerification_tokenHash_key" ON "EmailVerification"("tokenHash");

ALTER TABLE "EmailVerification" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "EmailVerification" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE "EmailVerification" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE "EmailVerification" FROM authenticated; END IF;
END $$;
