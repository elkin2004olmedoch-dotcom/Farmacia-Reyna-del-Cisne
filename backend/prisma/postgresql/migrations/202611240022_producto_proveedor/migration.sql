BEGIN;
ALTER TABLE "Producto" ADD COLUMN "proveedorId" TEXT REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Producto_proveedorId_idx" ON "Producto"("proveedorId");
COMMIT;
