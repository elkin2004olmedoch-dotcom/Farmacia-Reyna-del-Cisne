# Auditoría de catálogo y carrito — 18 de septiembre de 2026

## Mejoras realizadas

- Se añadió una sección `Productos` con cuatro productos demostrativos.
- Se incorporaron pestañas de categorías (`Todos`, `Bienestar`, `Cuidado personal` y `Mamá y bebé`) usando radios y selectores CSS, sin JavaScript.
- Se agregó un carrito lateral visual que se abre y cierra con un checkbox accesible mediante etiquetas HTML.
- El carrito incluye productos de muestra, total estimado y enlace de confirmación por WhatsApp.
- El catálogo se adapta a móvil con tarjetas de una columna y pestañas desplazables horizontalmente.
- Se añadió el acceso `Productos` al menú de escritorio y al menú móvil.

## Limitación conocida

Con HTML y CSS solamente no se puede modificar el contenido del carrito, calcular totales ni guardar productos entre visitas. El carrito actual es una maqueta interactiva para presentar la experiencia visual. Para convertirlo en carrito real se necesitaría JavaScript y, posteriormente, una solución de inventario y pagos.

## Pendientes recomendados

- Reemplazar los productos y precios de muestra por el inventario real.
- Añadir imágenes propias y disponibilidad por producto.
- Conectar el carrito a un formulario o a un sistema de pedidos.
- Incorporar validación de compra, cantidades y eliminación de productos cuando se autorice JavaScript.
