ALTER TABLE "Usuario" ADD COLUMN "username" TEXT CHECK (
  "username" IS NULL OR "username" ~ '^[a-z][a-z0-9._-]{2,39}$'
);
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");
ALTER TABLE "Usuario" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Usuario" SET "updatedAt"="createdAt";
