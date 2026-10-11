# Punto 3 — API REST

## Objetivo y método

Comprobar contratos HTTP, permisos, CRUD, pedidos, estados, descuentos, imágenes y conflictos de edición. Las pruebas usan Supertest con Express real y Prisma sobre bases temporales migradas. Los resultados de la ejecución completa, ejemplos y auditoría de dependencias están en `docs/pruebas/reto2/`.

Los contratos se conservan con PostgreSQL/Storage. La suite repetible usa SQLite real temporal y simulaciones para aislar servicios externos. Por separado, 17 comprobaciones puntuales de Express desde el equipo local contra Supabase real verificaron login del administrador importado, registro/login de cliente, 401/403 por rol, resumen ERP, carga WebP, edición visible para cliente y promoción con imagen propia. También verificaron descuento del 25 % ($12 → $9), pedido de dos unidades por $18, stock de cinco a tres, cancelación repetida que repone una sola vez a cinco, consulta del estado por cliente y persistencia tras reconectar. Los datos sintéticos de esa etapa se limpiaron y la paridad con el origen se comprobó nuevamente.

El backend público está activo en [Render Free](https://farmacia-reina-del-cisne.onrender.com). Desde esa URL pasaron 16 comprobaciones puntuales de API de autenticación, permisos, resumen ERP, imágenes, cambios de producto/promoción, pedidos, stock y cancelación. La interfaz pública también mostró el cambio de imagen/precio al cliente y su pedido cancelado. El reinicio real aprobó seis comprobaciones de conservación de registros, imágenes, login de ambos roles, pedido cancelado y edición de producto. Tras retirar únicamente los datos sintéticos y sus dos imágenes, la igualdad completa de las siete tablas y del SHA-256 de la imagen original se volvió a confirmar. El [alcance de nube](../../pruebas/reto2/nube.json) conserva esos resultados; los conteos de verificaciones reales no se incorporan al de la suite automatizada.

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

GET de producto y catálogo añade `precioOriginal`, `descuentoPorcentaje` y `promocionId`; `precio` representa el precio efectivo calculado en servidor. La tabla de administración y PUT editan el precio base. El CRUD de promoción admite `descuentoPorcentaje` entero 0–85 e `imagen`/`alt` opcionales: imagen propia requiere referencia canónica existente, verificada en disco o en Supabase Storage, y descripción; null usa la imagen del producto. Solo un descuento vigente, activo y sin vista previa puede modificar el precio; si coinciden varias campañas se aplica el mayor.

PUT de estado acepta exclusivamente `{estado, esperadoUpdatedAt}`. La versión es obligatoria y se valida como fecha ISO con zona. La respuesta incluye `updatedAt`, `detalles` e `historial`; se conserva la ocultación de `requestKey`/`fingerprint`. `409 ORDER_CHANGED` indica versión vencida; `409 INVALID_ORDER_TRANSITION` indica una secuencia no permitida. Repetir el estado alcanzado devuelve 200 con `replayed: true`, sin repetir historial ni reposición de stock. La creación idempotente también recupera el estado actual del mismo pedido, incluso si ya fue entregado o cancelado.

POST de imágenes acepta `{archivo: base64 puro, nombreOriginal}`. Solo admite JPEG, PNG o WebP de hasta 2 MB binarios y 16 millones de píxeles, sin animación. El servidor comprueba firma/formato, recodifica sin metadatos y devuelve `{imagen, ancho, alto}` con ruta UUID `.webp`. Esta ruta tiene parser JSON de 3 MB y límite propio de 10 solicitudes por minuto después de JWT/rol; la carga privada de certificados también tiene parser autorizado de 3 MiB; las demás rutas conservan 32 KB. El backend no acepta URLs externas, SVG subido ni rutas arbitrarias.

Los respaldos SQLite y su restauración son operaciones CLI de servidor, mediante `npm run backup` y `npm run backup:restore`; no cubren PostgreSQL ni Supabase Storage. No se añade una ruta HTTP para descargar bases ni restaurarlas desde una sesión comercial.

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

Se añadieron parámetros validados, respuestas uniformes, límites de cuerpo, controles de duplicación y códigos distintos para sesión y permisos. El historial representa pedidos registrados y sus estados operativos, no cobros. El DELETE de producto es lógico. La API incluye gestión del estado logístico; el pago continúa coordinándose con la farmacia, sin pasarela bancaria. La integración SRI se describe abajo; emisor, firma y autorización reales permanecen pendientes.


## API de farmacia, IVA y facturación

| Contrato | Permisos y validación |
| --- | --- |
| GET /api/configuracion/fiscal | Tarifa vigente pública, sin credenciales. |
| GET/POST /api/admin/configuracion/fiscal | Admin; tarifa13/14/15, fecha Ecuador y referencia normativa; historial. |
| GET/POST/PUT /api/admin/proveedores | Admin; RUC de13 dígitos terminado 001, correo y teléfonoEC; no checksum societario universal. |
| GET/POST /api/admin/lotes | Admin; producto/proveedor existentes, lote único por producto, caducidad real y cantidades enteras. |
| GET /api/admin/inventario/movimientos | Admin; movimientos trazables y paginación. |
| POST /api/admin/inventario/ajustes | Admin; entrada/salida, lote opcional, cantidad y motivo; nunca stock negativo. |
| GET/PUT /api/admin/facturacion/configuracion | Admin; datos del emisor, ambiente confirmado y numeración sólo hacia adelante. |
| POST /api/admin/facturacion/certificado | Admin antes del parser de 3 MiB; certificado PKCS12 máximo 2 MiB, contraseña privada. |
| GET/POST /api/admin/facturacion/facturas | Admin; listado/borrador con pedido, comprador y forma de pago real. |
| POST /api/admin/facturacion/facturas/:id/emitir | Admin; firma, recepción/consulta oficial y confirmación específica en producción. |
| GET /api/pedidos/:id/factura | Comprador propietario o admin;404 evita revelar otros pedidos. |
| GET /api/facturacion/facturas/:id/xml o ride | Comprador propietario o admin, sesión obligatoria. |

422 para descuentos 86%, tarifas no admitidas o datos inválidos;409 para receta pendiente, conflictos de versión/stock, pedido con lote vencido, certificado ausente, conciliación fiscal o cancelación de pedido ya facturado. Los estados SRI conservan DEVUELTA/NO_AUTORIZADA/EN_PROCESO/ERROR; una respuesta HTTP correcta no implica AUTORIZADA. No se envió ninguna factura real como parte de la auditoría. Evidencia: suites fiscal-inventory, sri-api y sri-crypto; contrato completo en SRI-FACTURACION.md.

## Publicación de campañas y contratos del agente C#

El CRUD protegido conserva el máximo de 85 % y el estado de publicación. Las pruebas de campañas cubren vista previa sin rebaja, descuento publicado, inicio programado y fin exclusivo; catálogo, ficha, carrito y pedido reciben el precio efectivo del servidor. La comprobación pública del 26 % de `cuidado-solar` no creó un pedido real. [Resultado publicado](../../pruebas/reto2/promocion-publicada.json).

Los siguientes contratos pertenecen al **servicio .NET independiente**, no al origen `/api` de Express ni al JWT de clientes:

| Método y ruta | Autorización y comportamiento |
| --- | --- |
| GET `/health` | Estado del proceso y activación; no es una autorización de envío ni una prueba de disponibilidad de PostgreSQL. |
| GET `/admin/inventario` | Bearer `InventoryAgent:AdminApiKey`; fuente compartida, proveedores y riesgos actuales. |
| GET `/admin/solicitudes` | Misma clave privada; estados persistidos, sin tokens de botones ni credenciales. |
| PUT `/admin/configuracion` | Producto/proveedor existentes, stock objetivo, días, habilitación y prioridad primordial/intermedio/bajo. |
| POST `/admin/solicitudes/{id}/revision` | Conciliación o rearme validado; `Resultado` y `ConfirmadoSinRecepcion`. No aprueba solicitudes pendientes. |
| POST `/webhooks/telegram` | Canal habilitado, secreto de cabecera, gerente/chat, token opaco y mensaje original. |
| GET `/webhooks/whatsapp` | Canal habilitado y elegible; Verify Token y challenge. |
| POST `/webhooks/whatsapp` | HMAC-SHA256 del cuerpo original, WABA/número empresarial, gerente, contexto y deduplicación. |

Las aprobaciones se reciben por los canales del gerente configurados; un texto libre OK no sustituye el botón ligado a la solicitud. La API administrativa falla cerrado si falta su clave. Cuerpos limitados a 128 KiB, límite por frecuencia y errores sin secretos. Los webhooks devuelven recepción de evento, lo que no implica aprobación ni envío al proveedor.

La suite independiente aprobó **92 pruebas C#**: 76 de dominio/HTTP/transportes y 16 de PostgreSQL, sin fallos ni omisiones. Los casos HTTP verifican también el callback que llega antes de persistir su contexto: devuelve 503 para permitir reintento, sin consumir definitivamente el evento ni aprobarlo. Los transportes son simulados; este conteo no se suma a las **136 pruebas Node y 40 Chrome**. [Resultados](../../pruebas/reto2/inventory-agent-results.json). Todos los canales siguen apagados y no se han enviado mensajes reales. [Contrato y preparación](../../AGENTE-INVENTARIO.md).
