# Auditoría de productos con imágenes — 18 de septiembre de 2026

## Mejoras realizadas

- Se añadieron imágenes de referencia a los cuatro productos del catálogo.
- Cada imagen tiene texto alternativo descriptivo.
- Cada producto ahora tiene un checkbox HTML independiente.
- El botón “Añadir al carrito” cambia visualmente a un estado seleccionado con CSS.
- Los productos seleccionados aparecen en el panel lateral del carrito mediante selectores CSS.
- Se añadió un estado vacío para el carrito cuando no hay productos seleccionados.
- Las tarjetas mantienen su adaptación móvil y las imágenes ocupan todo el ancho de la tarjeta.

## Funcionamiento actual

La selección funciona sin JavaScript usando `input type="checkbox"`, `label` y CSS `:has()`. Se pueden seleccionar varios productos y abrir el carrito para ver los artículos seleccionados.

## Limitaciones

- Las cantidades permanecen en una unidad.
- El total mostrado todavía es de referencia y no se recalcula automáticamente.
- Las imágenes actuales son externas y de demostración; deben sustituirse por fotografías propias o autorizadas.
- Para cantidades, eliminación de productos, total dinámico y persistencia se necesitará JavaScript.
