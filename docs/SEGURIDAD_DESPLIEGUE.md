# Seguridad de Pages y Render

Revisión del 2026-10-21, sobre la base `86804e7` y los cambios locales de esta etapa. El alcance es la aplicación web MVC y su despliegue de prueba. No se activan pasarela, servicios fiscales, reparto ni otros módulos.

## Resultado y estado de publicación

No se confirmó un bypass crítico/alto de autenticación, rol, propietario, CORS o cálculo de pedidos en el código revisado. Esto no certifica ausencia universal de vulnerabilidades. La atribución de varias escrituras administrativas era insuficiente: se corrigió localmente y se comprobó con pruebas. **El parche de backend no se publica en Render sin autorización del propietario.** El backend desplegado conserva `75aee3e` y Auto-Deploy Off.

La compresión de la fachada afecta únicamente al archivo público WebP; no cambia autorización, rutas, sesión ni contenido de las API. Pages de prueba sirve `0672e41`, despliegue `8801c092-0a71-40f9-abeb-32b7cf2a97fd`. El candidato de fuente `51d40d9` incorpora la auditoría y el trabajo previo de diagnóstico; no se ha desplegado como backend ni se presenta como parche mínimo sobre el servicio actual.

## Controles comprobados en código y fixtures temporales

| Área | Control y evidencia |
| --- | --- |
| Login y restauración | `server/middleware/auth.cjs:6` exige Bearer, HS256, emisor y audiencia; consulta usuario activo y versión del token en BD. El rol no procede de un campo confiado del JWT o del almacenamiento del navegador. |
| Logout | `server/controllers/auth.cjs:24` revoca mediante tokenVersion. Dos tokens previos dejan de funcionar y un nuevo login funciona en el fixture. El frontend conserva su tratamiento de 401 y errores transitorios. |
| CORS | Lista de orígenes exactos, sin wildcard ni credenciales; preflight JSON/Authorization. Un origen permitido no sustituye JWT ni roles. No se añaden previews arbitrarias. |
| Cookies y CSRF | Las API usan Authorization Bearer y Fetch `credentials:omit`; no autenticación por cookie. Login/registro/logout sintéticos no emiten Set-Cookie; una cookie sin Bearer no autoriza escrituras. No se introducen SameSite=None ni credentials:include. Las cookies de terceros, como Maps, no son una sesión de la farmacia. |
| Pedidos e inventario | `server/routes/index.cjs:23` aplica auth/rol antes de escrituras. El servidor recalcula precios, IVA y stock, reserva mediante transacción y conserva idempotencia por usuario. La misma clave en dos cuentas no comparte pedidos; replay concurrente no descuenta dos veces. |
| Seguimiento y datos privados | `server/models/pedidos.cjs:52` filtra por usuario autenticado. Estado/historial vienen de BD; los cambios requieren admin. Facturas/XML/RIDE comprueban propietario/admin y mantienen no-store. |
| Pagos | No existe pasarela ni endpoint de cobro/webhook. La forma de pago fiscal y una factura no prueban un cobro. No se realizaron pagos ni emisiones reales. |
| CSP y contenido | Pages permite scripts/estilos/fuentes propios, API Render exacta, imágenes públicas exactas y el iframe Maps existente; sin unsafe-inline/eval. `object-src 'none'`, `base-uri 'self'` y `frame-ancestors 'none'`. |
| Imágenes | CORP cross-origin se limita a uploads públicos; API y documentos privados mantienen su política. Las subidas requieren rol y se decodifican a WebP con nombre UUID. |

## Hallazgos y riesgos pendientes

**SEC-01 — Medio, corregido localmente; pendiente de publicación autorizada del backend.** El log anterior registraba ruta/estado/duración, pero no permitía atribuir varias ediciones administrativas. `server/middleware/logger.cjs:5` añade una lista fija de 17 escrituras y un evento `admin_write` con actorId autenticado desde BD, acción/ruta normalizada, estado, fecha y requestId. No incluye cuerpo, query, Authorization, certificados, documentos de comprador ni identificadores de clientes/recurso. Funciona con diagnóstico activado y desactivado, incluido error 4xx de admin autenticado. Se conserva el log HTTP anterior. Es atribución operacional: no promete bitácora transaccional/inmutable ni retención durable del proveedor.

**SEC-02 — Bajo, condicionado a XSS.** El JWT continúa en sessionStorage. Un script ejecutado en el origen podría leerlo; no se encontró una cadena XSS explotable. Se conservan CSP, escape y ausencia de scripts externos. Migrar a cookies HttpOnly requiere un diseño específico de sesiones/CSRF entre dominios; no se introduce como parche de rendimiento.

**OBS-01 — Límite de operación.** Los contadores de express-rate-limit son de memoria: se reinician con el proceso y no son compartidos entre instancias. No se confirmó un bypass del despliegue actual ni se hizo fuerza bruta pública. Antes de escalar, revisar topología de proxy, límites de borde y almacenamiento compartido; no se contrata un servicio para esta revisión.

**OBS-02 — Decisión comercial pendiente.** Un pedido pendiente reserva stock hasta que administración cambia su estado. No hay vencimiento o límite de pendientes por cuenta. Puede afectar disponibilidad mediante reservas válidas sin pago, aunque autorización, transacción y ownership funcionen. El pago se coordina con farmacia; no se inventan expiraciones, límites o reglas de cobro sin criterio del negocio. Antes de apertura comercial amplia conviene definir ese control.

## Artefacto público y dependencias

El generador usa una lista permitida de HTML/módulos/recursos. No copia .env, servidor, Prisma, bases, backups, certificados, uploads o datos de clientes. El shell admin es público y carece de registros privados; las API siguen autenticadas.

Se generaron y revisaron los 94 archivos de la candidata: ningún tipo/ruta privada ni coincidencia con patrones de claves privadas, conexiones con contraseña, claves de proveedor o JWT literal. No se leyeron valores privados para hacer ese contraste. Es un escaneo heurístico complementado por la lista permitida; no demuestra que todo secreto posible tenga un formato conocido. La URL pública Render/Supabase y los nombres de campos de formularios no son credenciales.

`npm audit --omit=dev --json` terminó con exit 0 y cero avisos de producción en la consulta del 2026-10-21. No se actualizaron paquetes. El resultado depende de la base de avisos disponible y no acredita seguridad universal ni incluye dependencias de desarrollo.

## Pruebas y límites

Ocho contratos nuevos cubren auditoría saneada con diagnóstico on/off, compatibilidad del log anterior, claims JWT aislados, usuario inactivo/rol vigente, cookies sin Bearer, idempotencia entre usuarios/concurrente y revocación de dos tokens. Se observaron los fallos de auditoría antes del cambio; el focalizado final pasó 12/12 con diagnóstico y rate-limit existentes. La suite Node completa pasó **185/185** y la histórica **38/38**, sin omitidos. Solo se usaron SQLite/uploads y cuentas temporales; los avisos previos ESM no motivaron cambios de dependencias.

La suite de navegador de un origen pasó **54/54** y Pages/API entre orígenes **20/20**, sin omitidos: **297 pruebas en las cuatro suites**. La revisión independiente del diff no encontró hallazgos materiales. Diez archivos críticos de autenticación, rutas, pedidos, inventario y facturación coinciden con el backend `75aee3e` desplegado, comparando contenido normalizado; el logger nuevo y el diagnóstico previo siguen siendo candidatos.

La comprobación estática pública realizó 112 solicitudes GET secuenciales y **102 controles sin fallo**: los 93 archivos servibles coinciden byte a byte o normalizando finales de línea, `_headers` no se publica y ocho rutas privadas conocidas devuelven 404. CSP, nosniff, DENY, revalidación y ausencia de Set-Cookie coincidieron con lo esperado; no hubo coincidencias heurísticas de secretos. Evidencia: [estáticos públicos](pruebas/lcp-seguridad-estaticos-2026-10-21.json).

Cloudflare añade `Access-Control-Allow-Origin:*` a esos archivos estáticos ya públicos, sin credenciales. No concede acceso a registros de clientes ni sustituye la lista CORS exacta de Express. La restricción de destinos que puede consumir la aplicación sigue en `connect-src` de CSP.

El cliente real publicado pasó **3/3 escenarios** de login/restauración/logout, seguimiento propio, ausencia de pedidos ajenos y barrera administrativa contra una API SQLite temporal. Las 21 solicitudes destinadas a Render se interceptaron y respondieron desde localhost; DNS y proxy de ese host quedaron bloqueados solo en el navegador desechable y ninguna petición continuó hacia Render. Se conservó la CSP publicada y no se observaron errores JS/CSP. Esto prueba la integración del cliente servido con los contratos del fixture, no preflight físico ni cuentas reales del backend. Evidencia: [sesiones del cliente publicado con fixture](pruebas/lcp-sesiones-fixture-publicado-2026-10-21.json).

Las **22 sondas de la API pública pasaron**, una por una, sin retries ni carga concurrente: dos preflights 204, dieciséis rechazos 401, login vacío 422 y tres orígenes no autorizados 403 sin ACAO. Incluyen Bearer falsificado, cookie sintética sin Bearer, lectura privada y llamadas POST/PUT/DELETE sin credenciales con `{}` o identificadores sintéticos; ninguna petición llevaba una operación comercial válida. Todas conservaron no-store, CORP same-origin, CSP, nosniff y ausencia de cookies/credenciales CORS. Se descartaron los cuerpos de respuesta. Evidencia: [API pública](pruebas/lcp-seguridad-api-2026-10-21.json).

Los contratos de cuenta válida, pedidos, stock, facturación y ownership usan fixtures; no se confunden con operaciones privadas ejecutadas en la base comercial. No se prueban cobros reales ni PostgreSQL privado.

Se repitieron los cinco recorridos públicos de escritorio, móvil, API desconectada, API retenida 30 s y sesión inválida: **5/5**, sin errores JS/CSP. Escritorio/móvil conservaron catálogo, carrito local, exigencia de login y cero violaciones axe de los tags comprobados. [Resultados públicos](pruebas/lcp-navegador-publico-2026-10-21.json). No equivalen a una auditoría manual de toda la accesibilidad ni a sesiones válidas de producción.

Para la promoción: el frontend candidato está verificado y el dominio principal no se cambió. La publicación del backend con atribución administrativa requiere autorización, y la política de reservas pendientes necesita criterio comercial. Render Free conserva suspensión/límites y no garantiza servicio continuo. El diagnóstico no presenta la candidata como lista para operación comercial continua sin esas decisiones. No se rebajaron CORS, CSP, roles o CSRF para alcanzar el LCP.

La entrega final debe conservar commits, resultados saneados, límites entre fuente/local/desplegado y reversión. DNS, dominio principal y Auto-Deploy de Render permanecen intactos.
