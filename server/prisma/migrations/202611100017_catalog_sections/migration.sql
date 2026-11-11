ALTER TABLE "Producto" ADD COLUMN "soloConsulta" BOOLEAN NOT NULL DEFAULT false CHECK("soloConsulta" IN (0,1));
-- Consultation references may omit dispensing metadata until sale is enabled.
-- Existing PVP ceilings and all other product constraints remain enforced.
DROP TRIGGER "Producto_pvp_insert";
DROP TRIGGER "Producto_pvp_update";
CREATE TRIGGER "Producto_pvp_insert" BEFORE INSERT ON "Producto"
WHEN (NEW."pvpMaximo" IS NOT NULL AND NEW."precio">NEW."pvpMaximo")
 OR (NOT NEW."soloConsulta" AND NEW."tipoProducto"='medicamento' AND (
   NEW."pvpMaximo" IS NULL OR NEW."registroSanitario" IS NULL OR length(trim(NEW."registroSanitario"))=0
   OR NEW."laboratorio" IS NULL OR length(trim(NEW."laboratorio"))=0
   OR NEW."presentacion" IS NULL OR length(trim(NEW."presentacion"))=0))
BEGIN SELECT RAISE(ABORT,'La venta de medicamentos requiere metadatos completos; precio no debe superar PVP.'); END;
CREATE TRIGGER "Producto_pvp_update" BEFORE UPDATE ON "Producto"
WHEN (NEW."pvpMaximo" IS NOT NULL AND NEW."precio">NEW."pvpMaximo")
 OR (NOT NEW."soloConsulta" AND NEW."tipoProducto"='medicamento' AND (
   NEW."pvpMaximo" IS NULL OR NEW."registroSanitario" IS NULL OR length(trim(NEW."registroSanitario"))=0
   OR NEW."laboratorio" IS NULL OR length(trim(NEW."laboratorio"))=0
   OR NEW."presentacion" IS NULL OR length(trim(NEW."presentacion"))=0))
BEGIN SELECT RAISE(ABORT,'La venta de medicamentos requiere metadatos completos; precio no debe superar PVP.'); END;
