# Punto 3 — API REST

## Objetivo y método

Comprobar contratos HTTP, permisos, códigos de estado, CRUD, registro de pedidos, conflictos de edición y respuestas consistentes. `tests/reto2/api.test.cjs` usa Supertest con Express real y Prisma sobre una base temporal migrada. La suite Node actual pasó sus 23 pruebas. Los ejemplos y salidas resumidas están en `docs/pruebas/reto2/`; la ampliación de navegador pasó sus 14 casos.

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

Rutas adicionales: GET `/api/auth/me`, POST `/api/auth/logout`, GET público y CRUD admin `/api/promociones`, GET admin `/api/admin/tablas`, GET admin `/api/admin/resumen` y GET `/api/salud`. La última comprueba disponibilidad de la BD con `SELECT 1` sin exponer credenciales.

El resumen administrativo responde 401 sin sesión, 403 con rol user y 200 con admin. Devuelve indicadores, estados, seis meses de tendencia, hasta diez alertas y cinco pedidos recientes, sobre un snapshot Serializable de Prisma. Los importes son centavos enteros; los períodos usan America/Guayaquil. Stock bajo incluye cero y cinco, y excluye productos inactivos. Las campañas respetan publicación, producto activo, inicio inclusivo y fin exclusivo; se incluyen las vistas previas elegibles. Las pruebas de API/modelo cubren permisos, suma precisa, límites de fechas, cambio de año, conteos y resumen vacío. El endpoint describe pedidos y no pagos o facturas.

## Contratos y buenas prácticas

Éxito: `{ "ok": true, "data": ... }`. Catálogo, tablas y pedidos añaden `items`, `total`, `page`, `pageSize` dentro de `data`. Error: `{ "ok": false, "error": { "code", "message", "details"? }, "requestId" }`. DELETE/logout usan 204 sin cuerpo. JSON mal formado: 400; permiso insuficiente: 403; ruta ausente: 404; cuerpo demasiado grande: 413; validación: 422; límite de solicitudes: 429; fallo interno: 500 sin stacktrace.

Las entradas de pedido incluyen `carrito`, `comprador` y `claveSolicitud`. Los precios y totales externos, cantidades fraccionarias, productos duplicados, campos ajenos al contrato y documentos inválidos se rechazan. En respuestas no se incluyen hashes de contraseñas, claves internas de idempotencia ni huellas de la solicitud.

PUT de producto admite además `esperadoUpdatedAt`, una fecha ISO 8601 con zona horaria que procede del registro leído. El servidor valida su formato y actualiza solamente si coincide con `updatedAt`. Una compra o edición intermedia devuelve `409 PRODUCT_CHANGED` y pide cargar la versión actual; el precio y stock persistidos no se sobrescriben. El editor siempre envía el campo en una edición. El parámetro continúa siendo opcional para clientes del contrato anterior; omitirlo no aplica el control optimista.

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

## Hallazgos y límites

Se añadieron validación de parámetros, respuestas uniformes, límites de cuerpo, controles de duplicación y códigos distintos para falta de sesión y falta de permisos. El historial representa pedidos registrados y pendientes de coordinación, no pagos completados. El DELETE de producto es lógico y se documenta expresamente. Los endpoints no incluyen actualización del estado logístico ni pasarela de pagos, que no son requisitos mínimos del reto.
