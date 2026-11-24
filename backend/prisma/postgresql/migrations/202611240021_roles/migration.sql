BEGIN;
LOCK TABLE "Usuario" IN SHARE ROW EXCLUSIVE MODE;
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

CREATE FUNCTION farmacia_asignar_rol() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO public."UsuarioRol" ("usuarioId","rolId") VALUES (NEW."id",NEW."role");
  RETURN NEW;
END $$;
CREATE TRIGGER "Usuario_asignar_rol" AFTER INSERT ON "Usuario"
  FOR EACH ROW EXECUTE FUNCTION farmacia_asignar_rol();

CREATE FUNCTION farmacia_conservar_rol() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."Usuario" WHERE "id"=OLD."usuarioId") THEN
    RAISE EXCEPTION 'La cuenta debe conservar su rol.' USING ERRCODE='23503';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER "UsuarioRol_conservar" BEFORE DELETE ON "UsuarioRol"
  FOR EACH ROW EXECUTE FUNCTION farmacia_conservar_rol();
ALTER TABLE "Rol" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsuarioRol" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Rol","UsuarioRol" FROM PUBLIC;
REVOKE ALL ON FUNCTION farmacia_asignar_rol(),farmacia_conservar_rol() FROM PUBLIC;
DO $$ DECLARE grantee_name text; BEGIN
  FOREACH grantee_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=grantee_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE public."Rol",public."UsuarioRol" FROM %I',grantee_name);
    END IF;
  END LOOP;
END $$;
COMMIT;
