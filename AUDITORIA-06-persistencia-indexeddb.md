# Auditoría 06 — Persistencia, IndexedDB e índices

**Fecha:** 5 de octubre de 2026.
**Alcance:** `storage.js`, almacenamiento del navegador y recuperación de datos.

## Cambios realizados

- `localStorage` usa la clave `farmacia-reina-cart` para conservar el carrito entre aperturas del navegador.
- El carrito se guarda con versión 2, cantidades y fecha ISO de actualización.
- `sessionStorage` usa `farmacia-reina-filters` para búsqueda, categoría, rango y orden durante la sesión.
- La cookie `farmacia-sort` intenta conservar el orden preferido durante 30 días, con `SameSite=Lax` y `Secure` en HTTPS.
- IndexedDB utiliza la base `farmacia-reina`, versión 1, con el almacén de objetos `products`.
- Se guarda un objeto con productos y fecha bajo la clave explícita `catalogo`.
- El almacén no tiene `keyPath` y no se crearon índices secundarios mediante `createIndex`.
- Si el almacenamiento no está disponible, un respaldo en memoria permite continuar usando la aplicación.

## Errores

- Los datos JSON corruptos se controlan; las cantidades e identificadores recuperados se normalizan antes de usarlos.
- Si se bloquea el guardado del carrito, la interfaz informa que su conservación es temporal.
- La apertura de IndexedDB contempla bloqueo, error y un límite de espera de dos segundos.
- La cookie puede estar limitada al abrir el sitio con `file://`; su funcionamiento depende del navegador.
- El respaldo en memoria se pierde al cerrar o recargar: no equivale a persistencia permanente.

## Resultado

- Las pruebas de almacenamiento verificaron guardado, recuperación y alternativas ante errores.
- La caché del catálogo permite disponer de datos cuando falla su carga por HTTP y hay una copia válida.
- Los datos personales del formulario no se guardan en estos mecanismos.
- Para la defensa: IndexedDB es la API de base de datos local; aquí se consulta por la clave `catalogo`, sin índices secundarios.
- `index.html` es el archivo de entrada del sitio y no guarda relación con los índices de una base de datos.

## Lo que falta

- Ampliar las pruebas aisladas de transacciones IndexedDB, bloqueos y caducidad real de cookies.
- Definir una migración si se cambia la versión o estructura de la base en futuras entregas.
- Usar un backend si se necesita sincronización de carrito o catálogo entre dispositivos.
- Comprobar las restricciones de almacenamiento del navegador elegido para la defensa.
