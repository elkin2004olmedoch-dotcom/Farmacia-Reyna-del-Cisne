-- Existing accounts remain unverified without requiring verification or revoking sessions.
ALTER TABLE "Usuario" ADD COLUMN "emailVerifiedAt" DATETIME;
ALTER TABLE "Usuario" ADD COLUMN "emailVerificationRequired" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "EmailVerification" (
  "usuarioId" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerification_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmailVerification_tokenHash_check" CHECK (typeof("tokenHash")='text' AND length("tokenHash")=64 AND "tokenHash" NOT GLOB '*[^0-9a-f]*'),
  -- Prisma 6's native SQLite driver stores milliseconds; SQL timestamp defaults are text.
  CONSTRAINT "EmailVerification_expiry_check" CHECK (COALESCE(
    (CASE typeof("expiresAt")
      WHEN 'integer' THEN "expiresAt"
      WHEN 'text' THEN CAST(ROUND((julianday("expiresAt")-2440587.5)*86400000) AS INTEGER)
    END) >
    (CASE typeof("createdAt")
      WHEN 'integer' THEN "createdAt"
      WHEN 'text' THEN CAST(ROUND((julianday("createdAt")-2440587.5)*86400000) AS INTEGER)
    END), 0))
);
CREATE UNIQUE INDEX "EmailVerification_tokenHash_key" ON "EmailVerification"("tokenHash");
