# Auditoría de carrito y pedido por WhatsApp — 18 de septiembre de 2026

## Mejoras realizadas

- El carrito ahora muestra un botón de pedido por WhatsApp asociado a la selección.
- Se prepararon mensajes de WhatsApp para las 15 combinaciones posibles de los cuatro productos actuales.
- Cada mensaje incluye los nombres y precios de los productos seleccionados.
- El enlace correcto se muestra mediante selectores CSS según los checkboxes activos.
- Se añadió un contador visual de productos seleccionados.
- Se mejoró el texto de confirmación para aclarar que la farmacia verificará disponibilidad y total final.
- Se mantuvieron el carrito lateral, las tarjetas seleccionadas y la experiencia responsive.

## Limitación técnica

HTML y CSS no pueden generar una URL dinámica ni calcular un total. Por eso se utilizaron enlaces preconstruidos para cada combinación posible. Cuando se incorpore JavaScript, esta solución podrá reemplazarse por un carrito escalable con cantidades, total automático y mensajes generados desde los datos del catálogo.

## Verificación

- La combinación de Vitaminas, Protector solar y Botiquín muestra un solo enlace de WhatsApp.
- El enlace contiene los tres nombres y precios seleccionados.
- El carrito muestra tres productos.
- El viewport móvil de 390 px continúa sin desplazamiento horizontal.
