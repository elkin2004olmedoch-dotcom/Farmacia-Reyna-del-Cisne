ALTER TABLE "Producto" ADD COLUMN "soloConsulta" BOOLEAN NOT NULL DEFAULT false;
-- Keep legacy rows intact and enforce complete sale metadata on future writes.
ALTER TABLE "Producto" DROP CONSTRAINT "Producto_pvp_medication_check";
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_pvp_medication_check" CHECK(
 ("pvpMaximo" IS NULL OR "precio"<="pvpMaximo")
 AND ("soloConsulta" OR (
   "tipoProducto"!='medicamento' OR (
     "pvpMaximo" IS NOT NULL AND "registroSanitario" IS NOT NULL AND length(btrim("registroSanitario"))>0
     AND "laboratorio" IS NOT NULL AND length(btrim("laboratorio"))>0
     AND "presentacion" IS NOT NULL AND length(btrim("presentacion"))>0)
 ))) NOT VALID;
