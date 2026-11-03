# Presentación conjunta de la farmacia

Se presenta una sola aplicación y un repositorio: la tienda HTML/CSS/JavaScript del primer reto evoluciona con MVC, API, JWT, roles y persistencia en el segundo. La paleta, el logo y el componente animado se comparten entre las pantallas.

## Recorrido en la aplicación

1. **Cliente:** abre el catálogo, filtra y busca. En la mascota escribe `buscar productos`, elige producto y cantidad y revisa la propuesta antes de confirmar. Muestra el carrito lateral, la imagen y el acceso inferior al carrito.
2. **Compra:** revisa cantidades y datos de entrega. Una tarifa pendiente bloquea la confirmación; si administración la cambia, se revisa el nuevo total. Con el pago de práctica activo, valida tarjeta o transferencia y confirma antes de crear el pedido. Cancelar conserva el carrito. Después, abre el comprobante imprimible y el seguimiento.
3. **Administrador:** entra con su cuenta. Escribe `actualizar productos` para seleccionar un registro y revisar precio/stock, o `poner en promocion` para preparar una promoción. `Sí, confirmar` guarda y `No, cancelar` descarta. El cliente recibe el cambio a través de la API. Desde entregas configura cobertura y tarifa.
4. **Preparación y asignación:** confirma el pedido y márcalo preparado. Con un único repartidor activo la asignación es automática; con varios se elige uno. La orden `Asigna pedido "ID" a repartidor "ID"` usa los códigos del panel y requiere confirmación.
5. **Repartidor:** abre su bandeja, inicia el recorrido y comparte GPS con permiso del dispositivo. La ruta se dibuja dentro de la app. Al llegar se habilita llamar al cliente; al confirmar la entrega se retiran las ubicaciones del pedido cerrado.
6. **Defensa técnica:** conecta una acción de la interfaz con Fetch, una ruta/controlador Express y una consulta Prisma. Muestra que el cliente recibe 403 al intentar administrar, el JWT no se expone en sessionStorage de la web y el pedido conserva sus detalles. Explica los tres riesgos OWASP del README.

## Repetir las evidencias

En una instalación local preparada con Node 22, dependencias y Chrome, instala el grabador de Playwright con `npx playwright install ffmpeg`. Ejecuta `npm run test:journey` para registrar el recorrido en escritorio y móvil con pago de práctica, cuentas/GPS temporales y mapas/rutas externos reales. Produce capturas, videos y `recorrido-evidencia.json` en `tests/reto2/test-results/recorrido-presentacion/`. No genera ZIP. El servidor de pruebas fija una SQLite temporal, un JWT propio y desactiva correos y PayPhone comercial aunque existan indicadores heredados.

`npm test` comprueba juntos los dos grupos de pruebas. Las auditorías conservan su historial. La aplicación publicada usa PostgreSQL/Supabase; las pruebas utilizan SQLite temporal. El framework del Reto 3 sigue pendiente de asignación.

Los videos acreditan el recorrido probado con datos temporales. El pago no mueve dinero, el comprobante no tiene validez tributaria y la ubicación simulada no acredita GPS en segundo plano ni funcionamiento con un teléfono apagado. Esas activaciones y pruebas físicas se realizan antes del uso comercial.
