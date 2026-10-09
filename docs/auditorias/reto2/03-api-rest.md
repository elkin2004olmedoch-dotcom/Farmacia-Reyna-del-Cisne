# Punto 3 — API REST

## Objetivo y método

Comprobar contratos HTTP, permisos, CRUD, pedidos, estados, descuentos, imágenes y conflictos de edición. Las pruebas usan Supertest con Express real y Prisma sobre bases temporales migradas. Los resultados de la ejecución completa, ejemplos y auditoría de dependencias están en `docs/pruebas/reto2/`.

## Matriz del subpunto 3.1

| Endpoint obligatorio | Acceso | Resultado validado |
|---|---|---|
| POST `/api/auth/login` | Público, limitado por intentos | 200 con JWT; 401 credenciales incorrectas |
| POST `/api/auth/register` | Público, limitado por intentos | 201 user con bcrypt; 409 correo duplicado; 422 campos inválidos |
| GET `/api/productos` | Público | 200 con catálogo paginado |
| GET `/api/productos/:id` | Público | 200 ficha; 404 retirado; 422 identificador inválido |
| POST `/api/productos` | JWT admin | 201 creado; sin JWT 401; user 403 |
| PUT `/api/productos/:id` | JWT admin | 200 actualizado; con `esperadoUpdatedAt` vencido, 409 sin sobrescribir precio ni stock |
| DELETE `/api/productos/:id` | JWT admin | 204; desactivación conservando historial |
| POST `/api/pedidos` | JWT user/admin | 201 cabecera/detalles; 200 reintento idéntico; 409 conflicto de stock o clave |
| GET `/api/pedidos/mis-pedidos` | JWT user/admin | 200 solo pedidos del usuario autenticado |
| GET `/api/pedidos` | JWT admin | 200 pedidos de todos los usuarios; user 403 |
| PUT `/api/pedidos/:id/estado` | JWT admin | 200 transición/repetición; 409 versión vencida o transición inválida; user 403 |
| POST `/api/admin/imagenes` | JWT admin antes de leer cuerpo grande | 201 ruta WebP; 422 formato/dimensiones/datos inválidos; 413 cuerpo excesivo |

Rutas adicionales: GET `/api/auth/me`, POST `/api/auth/logout`, GET público y CRUD admin `/api/promociones`, GET admin `/api/admin/tablas`, GET admin `/api/admin/resumen` y GET `/api/salud`. La última comprueba disponibilidad de la BD con `SELECT 1` sin exponer credenciales.

El resumen administrativo responde 401 sin sesión, 403 con rol user y 200 con admin. Devuelve indicadores, estados, seis meses de tendencia, hasta diez alertas y cinco pedidos recientes, sobre un snapshot Serializable de Prisma. Los importes son centavos enteros; los períodos usan America/Guayaquil. Stock bajo incluye cero y cinco, y excluye productos inactivos. Las campañas respetan publicación, producto activo, inicio inclusivo y fin exclusivo; se incluyen las vistas previas elegibles. Las pruebas de API/modelo cubren permisos, suma precisa, límites de fechas, cambio de año, conteos y resumen vacío. El endpoint describe pedidos y no pagos o facturas.

## Contratos y buenas prácticas

Éxito: `{ "ok": true, "data": ... }`. Catálogo, tablas y pedidos añaden `items`, `total`, `page`, `pageSize` dentro de `data`. Error: `{ "ok": false, "error": { "code", "message", "details"? }, "requestId" }`. DELETE/logout usan 204 sin cuerpo. JSON mal formado: 400; permiso insuficiente: 403; ruta ausente: 404; cuerpo demasiado grande: 413; validación: 422; límite de solicitudes: 429; fallo interno: 500 sin stacktrace.

Las entradas de pedido incluyen `carrito`, `comprador` y `claveSolicitud`. Los precios y totales externos, cantidades fraccionarias, productos duplicados, campos ajenos al contrato y documentos inválidos se rechazan. En respuestas no se incluyen hashes de contraseñas, claves internas de idempotencia ni huellas de la solicitud.

PUT de producto admite además `esperadoUpdatedAt`, una fecha ISO 8601 con zona horaria que procede del registro leído. El servidor valida su formato y actualiza solamente si coincide con `updatedAt`. Una compra o edición intermedia devuelve `409 PRODUCT_CHANGED` y pide cargar la versión actual; el precio y stock persistidos no se sobrescriben. El editor siempre envía el campo en una edición. El parámetro continúa siendo opcional para clientes del contrato anterior; omitirlo no aplica el control optimista.

GET de producto y catálogo añade `precioOriginal`, `descuentoPorcentaje` y `promocionId`; `precio` representa el precio efectivo calculado en servidor. La tabla de administración y PUT editan el precio base. El CRUD de promoción admite `descuentoPorcentaje` entero 0–90 e `imagen`/`alt` opcionales: imagen propia requiere ruta local existente y descripción; null usa la imagen del producto. Solo un descuento vigente, activo y sin vista previa puede modificar el precio; si coinciden varias campañas se aplica el mayor.

PUT de estado acepta exclusivamente `{estado, esperadoUpdatedAt}`. La versión es obligatoria y se valida como fecha ISO con zona. La respuesta incluye `updatedAt`, `detalles` e `historial`; se conserva la ocultación de `requestKey`/`fingerprint`. `409 ORDER_CHANGED` indica versión vencida; `409 INVALID_ORDER_TRANSITION` indica una secuencia no permitida. Repetir el estado alcanzado devuelve 200 con `replayed: true`, sin repetir historial ni reposición de stock. La creación idempotente también recupera el estado actual del mismo pedido, incluso si ya fue entregado o cancelado.

POST de imágenes acepta `{archivo: base64 puro, nombreOriginal}`. Solo admite JPEG, PNG o WebP de hasta 2 MB binarios y 16 millones de píxeles, sin animación. El servidor comprueba firma/formato, recodifica sin metadatos y devuelve `{imagen, ancho, alto}` con ruta UUID `.webp`. Esta ruta tiene parser JSON de 3 MB y límite propio de 10 solicitudes por minuto después de JWT/rol; el resto de la API conserva 32 KB. El backend no acepta URLs externas, SVG subido ni rutas arbitrarias.

Los respaldos y su restauración son operaciones CLI de servidor, mediante `npm run backup` y `npm run backup:restore`. No se añade una ruta HTTP para descargar bases ni restaurarlas desde una sesión comercial.

La paginación limita el tamaño a 100 filas. Auth, usuarios y administración no se mezclan con el catálogo público. El logger registra método, ruta, estado, duración e ID de solicitud; no imprime cuerpos, Authorization ni contraseñas. El middleware de errores es único. Las funciones asíncronas se propagan al manejador de Express 5; los cálculos del pedido y consultas están en modelos.

## Pruebas mínimas del enunciado

| Prueba exigida | Evidencia |
|---|---|
| Login admin obtiene token | Primer caso API; token verificado criptográficamente |
| Crear producto admin | Respuesta 201 y lectura de Prisma |
| Login user no crea producto | Respuesta 403 y prueba desde navegador |
| Catálogo en frontend | API pública y tarjetas visibles |
| Carrito persistente | Recarga y modificación de cantidades |
| Confirmar pedido user queda en BD | POST 201 y consulta con otro cliente Prisma |
| Admin ve todos los pedidos | GET admin y tabla del panel |
| Cambios siguen conectados al reconectar | Nueva sesión Prisma conserva cliente, edición de producto, campaña, pedido, detalles y stock |
| Edición antigua no restaura stock | PUT con versión anterior a una compra u otra edición devuelve 409; BD mantiene el valor actual |
| Estados y cancelación | Permisos, secuencia/terminales, versión vencida, historial y dos cancelaciones simultáneas sin duplicar stock |
| Descuento consistente | USD 7,50 al 25% = USD 5,63 en catálogo/ficha; tres unidades = USD 16,89 en pedido; snapshot conservado |
| Imágenes seguras | Autorización antes del parser grande; decodificación, formato real, dimensiones y rutas verificadas |

## Hallazgos y límites

Se añadieron parámetros validados, respuestas uniformes, límites de cuerpo, controles de duplicación y códigos distintos para sesión y permisos. El historial representa pedidos registrados y sus estados operativos, no cobros. El DELETE de producto es lógico. La API incluye gestión del estado logístico; el pago continúa coordinándose con la farmacia, sin pasarela bancaria ni facturación fiscal.
