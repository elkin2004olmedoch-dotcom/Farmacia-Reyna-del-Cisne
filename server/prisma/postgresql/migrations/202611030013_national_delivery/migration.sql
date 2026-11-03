ALTER TABLE "ZonaEntrega" ADD COLUMN "alcance" TEXT NOT NULL DEFAULT 'local' CHECK("alcance" IN ('local','nacional'));
ALTER TABLE "ZonaEntregaTarifa" ADD COLUMN "alcance" TEXT NOT NULL DEFAULT 'local' CHECK("alcance" IN ('local','nacional'));
INSERT INTO "ZonaEntrega"("id","nombre","provincia","canton","alcance","tarifaCentavos","updatedAt") VALUES ('ecuador-nacional','Envíos a todo Ecuador','Ecuador','Todo el país','nacional',0,CURRENT_TIMESTAMP) ON CONFLICT("id") DO NOTHING;
INSERT INTO "ZonaEntregaTarifa"("id","zonaEntregaId","version","alcance","tarifaCentavos","ivaCategoria") SELECT 'ecuador-nacional-inicial',"id",1,'nacional',0,'general' FROM "ZonaEntrega" WHERE "id"='ecuador-nacional' AND "alcance"='nacional' AND "version"=1 AND "tarifaCentavos"=0 ON CONFLICT DO NOTHING;
