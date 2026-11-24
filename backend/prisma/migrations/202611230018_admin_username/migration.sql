ALTER TABLE "Usuario" ADD COLUMN "username" TEXT CHECK (
  "username" IS NULL OR (
    length("username") BETWEEN 3 AND 40
    AND "username"=lower("username")
    AND substr("username",1,1) GLOB '[a-z]'
    AND "username" NOT GLOB '*[^a-z0-9._-]*'
  )
);
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");
ALTER TABLE "Usuario" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT 0;
UPDATE "Usuario" SET "updatedAt"="createdAt";
