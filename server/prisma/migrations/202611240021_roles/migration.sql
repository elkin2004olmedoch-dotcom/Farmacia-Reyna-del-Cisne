-- SQLite obtains the write lock before copying existing assignments.
BEGIN IMMEDIATE;
CREATE TABLE "Rol" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "nombre" TEXT NOT NULL,
  CONSTRAINT "Rol_codigo" CHECK ("id" IN ('user', 'admin', 'repartidor'))
);
CREATE UNIQUE INDEX "Rol_nombre_key" ON "Rol"("nombre");
INSERT INTO "Rol" ("id","nombre") VALUES
  ('user','Cliente'), ('admin','Administrador'), ('repartidor','Repartidor');

CREATE UNIQUE INDEX "Usuario_id_role_key" ON "Usuario"("id","role");
CREATE TABLE "UsuarioRol" (
  "usuarioId" TEXT NOT NULL PRIMARY KEY,
  "rolId" TEXT NOT NULL,
  CONSTRAINT "UsuarioRol_usuarioId_rolId_fkey" FOREIGN KEY ("usuarioId","rolId")
    REFERENCES "Usuario"("id","role") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UsuarioRol_rolId_fkey" FOREIGN KEY ("rolId")
    REFERENCES "Rol"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "UsuarioRol_usuarioId_rolId_key" ON "UsuarioRol"("usuarioId","rolId");
CREATE INDEX "UsuarioRol_rolId_idx" ON "UsuarioRol"("rolId");
INSERT INTO "UsuarioRol" ("usuarioId","rolId") SELECT "id","role" FROM "Usuario";

CREATE TRIGGER "Usuario_asignar_rol" AFTER INSERT ON "Usuario"
BEGIN
  INSERT INTO "UsuarioRol" ("usuarioId","rolId") VALUES (NEW."id",NEW."role");
END;
CREATE TRIGGER "UsuarioRol_conservar" BEFORE DELETE ON "UsuarioRol"
WHEN EXISTS (SELECT 1 FROM "Usuario" WHERE "id"=OLD."usuarioId")
BEGIN
  SELECT RAISE(ABORT, 'La cuenta debe conservar su rol.');
END;
COMMIT;
