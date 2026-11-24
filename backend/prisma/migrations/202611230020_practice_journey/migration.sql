ALTER TABLE "PagoPractica" ADD COLUMN "recorridoAutomatico" BOOLEAN NOT NULL DEFAULT false CHECK ("recorridoAutomatico" IN (0,1));
