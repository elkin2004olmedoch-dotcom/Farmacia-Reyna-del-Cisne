# Farmacia Reina del Cisne — Reto 2 Full Stack MVC

Plataforma de farmacia con catálogo, carrito persistente, registro/login, pedidos en base de datos y administración de productos y promociones. Mantiene la fachada del negocio, identidad crema/vino, ubicación, WhatsApp y las 18 referencias anteriores.

**Stack:** Node.js 22.13+ (probado en 24.15), Express 5, JavaScript ES modules, Prisma 6.19.3, SQLite y Sharp 0.35.5 para imágenes. Se utiliza el motor relacional alternativo permitido por el enunciado y confirmado por el estudiante; no requiere SQL Server. El pago y la entrega se coordinan con la farmacia, sin pasarela bancaria.

## Instalación y ejecución

~~~powershell
npm ci
npm run setup
npm start
~~~

Abre **http://localhost:3000/**. Express sirve frontend y API en el mismo origen. Setup genera el cliente Prisma, aplica la migración, ejecuta seed y construye las nueve pantallas. Si .env no existe, genera JWT_SECRET y contraseña admin aleatorios; no sobrescribe un archivo existente.

Consulta ADMIN_EMAIL y ADMIN_PASSWORD en tu **archivo privado .env** e inicia sesión en /cuenta.html. Una cuenta admin entra automáticamente en /admin.html; una cuenta cliente conserva su cuenta, carrito e historial. No compartas ese archivo. Las cuentas normales se crean desde “Crear cuenta”; el registro nunca concede admin. Usa datos de prueba con formatos/verificadores ecuatorianos válidos durante la evaluación.

Los 18 productos comienzan con stock de demostración de 20 unidades y precios de referencia. Confirma los datos comerciales reales con la farmacia. El seed no restaura stock vendido ni sobrescribe ediciones, usuarios o contraseñas existentes. El marcador técnico `Semilla` inicializa el catálogo una sola vez y conserva las promociones eliminadas; al actualizar una base anterior adopta el catálogo inicial existente.

Para actualizar una instalación existente, detén el servidor, ejecuta `npm ci`, `npm run db:generate`, `npm run db:migrate`, `npm run db:seed` y `npm start`. La segunda migración añade el marcador de inicialización; la tercera añade estados/historial, versiones de pedidos, porcentajes e imágenes de campañas. Conserva una copia privada de la BD y de las imágenes subidas antes de migrar; no reemplaces los archivos por datos de demostración. La conversión se prueba también con pedidos anteriores.

Alternativa manual: copia .env.example a .env, configura valores privados y ejecuta:

~~~powershell
npm run db:generate
npm run db:migrate
npm run db:seed
npm run build:frontend
npm start
~~~

DATABASE_URL="file:./farmacia.db" se resuelve respecto al schema: la BD está en **server/prisma/farmacia.db**. Se excluye de Git/ZIP y se reconstruye con migraciones/seed. npm run dev recarga el servidor; npm run db:studio inspecciona la BD local.

## Arquitectura MVC

~~~text
frontend/
  index.html, catalogo.html, producto.html, comparar.html
  cuenta.html, checkout.html, pedidos.html, admin.html, ayuda.html
  models/           API, sesión, catálogo, carrito, pedidos y administración
  views/            tarjetas, formularios, tablas, mensajes y confirmación
  controllers/      eventos, navegación y coordinación de modelos/vistas
  assets/           CSS, imágenes, iconos y fuentes
server/
  index.cjs         arranque HTTP/HTTPS
  app.cjs           composición Express y contenido público
  config.cjs        entorno validado
  routes/           endpoints y middleware
  controllers/      entrada/salida HTTP
  models/           Prisma y transacciones
  middleware/       JWT, roles, validación, errores y logger
  prisma/
    schema.prisma
    migrations/202610090001_init/migration.sql
    migrations/202610090002_seed_marker/migration.sql
    migrations/202610090003_commerce/migration.sql
    migrations/migration_lock.toml
    seed.cjs
scripts/            instalación, frontend, HTTPS y ZIP
tests/reto2/        API, recursos y navegador
docs/
  REQUISITOS-RETO-2.txt
  auditorias/reto2/  cinco auditorías completas
  pruebas/reto2/     evidencias y resultados
.env.example
package.json
package-lock.json
~~~

Cliente: controlador → modelo Fetch/estado → vista reutilizable. Los modelos no renderizan DOM: publican señales con EventTarget. Las vistas no consumen API ni registran eventos del flujo. La misma tarjeta de views/products.js se utiliza en portada y catálogo. scripts/build-frontend.cjs genera cabecera, pie y campos compartidos: edita sus plantillas para conservar cambios al reconstruir HTML.

Servidor: ruta → validación/JWT/rol → controlador HTTP → modelo Prisma → BD. El cálculo/transacción del pedido pertenece al modelo. Hay middleware de errores centralizado y logger sin cuerpos ni credenciales.

Los HTML, js/ y assets/ raíz conservan el Reto 1 como antecedente; su README está en docs/README-RETO-1.md. **Evalúa el Reto 2 con npm start y localhost:3000**, no abriendo HTML raíz ni usando el servidor estático anterior. GitHub Pages solo sirve contenido estático; esta aplicación necesita un proceso Node y BD.

## Persistencia y consistencia

| Entidad | Campos principales |
|---|---|
| Producto | id, nombre, precio Decimal, stock, categoría, imagen, activo, createdAt |
| Usuario | id, email único, nombre, teléfono, passwordHash, role, activo, tokenVersion |
| Pedido | id, userId FK, total Decimal, entrega, comprador, documento enmascarado, estado, createdAt, updatedAt |
| PedidoDetalle | id, pedidoId FK, productoId FK, nombre histórico, cantidad, precioUnitario, precioOriginal, descuentoPorcentaje |
| PedidoEstado | pedidoId FK, estado anterior/nuevo, actorId FK y fecha; historial de cambios |
| Promocion | id, título, etiqueta, productoId FK, publicación, vistaPrevia, orden, inicio, fin, descuentoPorcentaje, imagen/alt propios opcionales |

El carrito guarda IDs/cantidades en localStorage. El servidor lee precio/stock, calcula en centavos y persiste Decimal. Cabecera, detalles y descuento de stock están en una transacción serializable; una línea sin stock revierte todo el pedido.

Cada confirmación incluye UUID de idempotencia. Repetir la misma solicitud devuelve el pedido existente sin otro descuento; la misma clave con otros datos devuelve 409. El cliente guarda solo clave y huella, no documento en claro. Los detalles preservan nombre/precio históricos. DELETE producto lo desactiva sin destruir el historial.

El editor de productos envía `esperadoUpdatedAt` con la versión que recibió al abrirse. Una compra u otra edición cambia esa versión; un guardado antiguo devuelve `409 PRODUCT_CHANGED` y conserva el stock/precio actual. Cierra y vuelve a abrir el editor para revisar los datos antes de guardar. Este campo es opcional para clientes API anteriores; el panel lo incluye siempre.

### Conexión entre administrador y clientes

Todos los módulos consultan la misma API y BD: el registro aparece en Usuarios; los productos y campañas administrados aparecen en la tienda; los pedidos del cliente aparecen en Pedidos, Detalles y dashboard, con descuento de stock. Cada cliente consulta únicamente su historial.

Portada, catálogo, ficha, comparación, carrito, historial y panel consultan cambios al regresar a la pestaña y cada 30 segundos mientras está visible. Pestañas del mismo navegador reciben además una señal local de cambios; el carrito escucha cambios de almacenamiento. Las señales contienen únicamente un UUID, sin cuentas, JWT ni datos de entrega. La actualización usa consultas HTTP, sin conexión WebSocket.

Se mantienen filtros, productos elegidos para comparar, cantidades y datos de entrega. El editor administrativo abierto pausa las actualizaciones para conservar el trabajo; la precondición detecta ventas ocurridas durante la edición. El carrito informa productos retirados o cantidades superiores al stock y bloquea la confirmación hasta corregirlos. La API vuelve a verificar precio, disponibilidad y stock en la transacción final.

## Endpoints y roles

En rutas protegidas: **Authorization: Bearer &lt;token&gt;**.

| Método | Endpoint | Acceso |
|---|---|---|
| POST | /api/auth/register | Público; crea user |
| POST | /api/auth/login | Público; devuelve JWT |
| GET | /api/auth/me | user/admin |
| POST | /api/auth/logout | user/admin; revoca sesiones |
| GET | /api/productos | Público |
| GET | /api/productos/:id | Público |
| POST | /api/productos | admin |
| PUT | /api/productos/:id | admin |
| DELETE | /api/productos/:id | admin |
| POST | /api/pedidos | user/admin |
| GET | /api/pedidos/mis-pedidos | user/admin; solo propios |
| GET | /api/pedidos | admin; todos |
| PUT | /api/pedidos/:id/estado | admin; transición con versión y registro de historial |
| GET | /api/promociones | Público; activas/vigentes |
| POST | /api/promociones | admin |
| PUT | /api/promociones/:id | admin |
| DELETE | /api/promociones/:id | admin |
| GET | /api/admin/tablas | admin |
| GET | /api/admin/resumen | admin; indicadores, alertas y tendencia |
| POST | /api/admin/imagenes | admin; imagen JPEG/PNG/WebP validada y recodificada |
| GET | /api/salud | Público; prueba BD |

Catálogo: ?q=solar&categoria=cuidado&page=1&pageSize=20. Pedidos/tablas admiten page/pageSize; máximo 100 registros. Tablas admin: productos, usuarios, pedidos, detalles y promociones.

Éxito: {ok:true,data:...}. Listados: data:{items,total,page,pageSize}. Error: {ok:false,error:{code,message,details?},requestId}. HTTP: creación 201; listado/edición 200; borrado/logout 204; sin sesión 401; sin permiso 403; ausente 404; conflicto/stock 409; cuerpo grande 413; validación 422; rate limit 429; fallo interno 500 sin stacktrace.

### Ejemplos de endpoints probados

POST /api/auth/register:

~~~json
{"nombre":"Cliente Prueba","email":"cliente@example.ec","telefono":"0979275988","cedula":"0102030400","password":"ClaveSoloPrueba2026!"}
~~~

POST /api/auth/login:

~~~json
{"email":"cliente@example.ec","password":"ClaveSoloPrueba2026!"}
~~~

POST /api/productos con Bearer admin:

~~~json
{"nombre":"Producto de prueba","precio":7.25,"stock":10,"categoria":"bienestar","descripcion":"Artículo de referencia","imagen":"assets/images/producto-vitaminas.jpg","alt":"Imagen de referencia de vitaminas"}
~~~

POST /api/pedidos con Bearer user/admin:

~~~json
{
  "carrito":[{"productoId":"solar","cantidad":1}],
  "comprador":{
    "name":"Cliente Prueba","email":"cliente@example.ec","phone":"0979275988",
    "documentType":"cedula","document":"0102030400","delivery":"pickup",
    "province":"","city":"","address":"","postalCode":""
  },
  "claveSolicitud":"3b4ad6dc-f1a1-4f11-856a-c6313d3c54d1"
}
~~~

Son datos de prueba. Usa una clave nueva por pedido nuevo, sin precio ni total en el cuerpo. Para entrega: delivery=delivery, provincia válida, ciudad, dirección y código postal correspondiente si se incluye. [Resultados HTTP observados](docs/pruebas/reto2/README.md).

## Seguridad y OWASP

Tres riesgos de [OWASP Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/) y sus mitigaciones:

| Riesgo | Mitigación aplicada |
|---|---|
| A01 — Broken Access Control | JWT/rol en servidor, registro fija user, permisos admin e historial filtrado por identidad; pruebas 401/403 y usuario ajeno |
| A05 — Injection | Prisma parametrizado, express-validator, campos permitidos, sanitización, escape HTML, imágenes locales existentes y CSP sin scripts inline |
| A07 — Authentication Failures | bcrypt 12, secretos privados aleatorios, HS256 con issuer/audience/exp, revocación tokenVersion y límites de intentos |

Controles adicionales: Helmet, API sin caché, cuerpo JSON de 32 KB y excepción de 3 MiB exclusivamente para la subida de imágenes tras autenticar al administrador, paginación y errores centralizados. Config rechaza JWT_SECRET débil, CORS comodín y orígenes HTTP en producción. CORS usa orígenes exactos y no sustituye JWT/roles. Las prácticas siguen la [guía de Express](https://expressjs.com/en/advanced/best-practice-security.html).

JWT de 30 minutos en sessionStorage; logout revoca los tokens del usuario. La cédula del registro no se conserva; el documento del pedido se enmascara. No se piden ni guardan tarjeta, CVV o vencimiento. El admin ve datos de entrega necesarios, sin passwordHash ni huellas internas. Logger sin body ni Authorization.

.env, BD, dependencias y claves privadas se excluyen de Git/ZIP; el backend publica solo frontend/. El override deepmerge-ts 8.0.0 corrige la alerta transitiva detectada y se verificó con Prisma, migraciones y pruebas. No se declara certificación OWASP.

## HTTPS opcional

Requiere OpenSSL; el script detecta el incluido con Git para Windows:

~~~powershell
npm run cert:dev
npm run start:https
~~~

Abre **https://localhost:3443/**. El certificado self-signed de desarrollo puede mostrar advertencia de confianza; no se sobrescriben archivos existentes. Producción necesita certificado confiable o proxy HTTPS, NODE_ENV=production y CORS_ORIGIN real. TLS_CERT_PATH/TLS_KEY_PATH admiten certificados propios.

## Panel administrador

El panel adopta el diseño ERP de la referencia: barra lateral fija por áreas, cabecera compacta, dashboard con tarjetas y tablas de gestión a todo el ancho. Conserva los colores crema/vino de la farmacia. General contiene Dashboard; Inventario, Productos; Ventas, Pedidos de clientes y Detalles; Comercial, Promociones; Administración, Usuarios. “Ver tienda” permite revisar la página pública y “Cerrar sesión” revoca la sesión.

`/admin.html` abre el **Dashboard ejecutivo** con ocho indicadores reales: importe de pedidos del mes, importe acumulado, pedidos pendientes, stock bajo, productos activos, clientes activos, administradores y campañas vigentes (incluye vistas previas). Añade alertas de inventario, accesos rápidos, pedidos por estado, tendencia de seis meses y últimos pedidos. Los importes representan pedidos registrados; no son cobros ni facturas.

`GET /api/admin/resumen` genera el resumen en una transacción consistente de Prisma. Calcula dinero en centavos, meses con horario de Ecuador continental (America/Guayaquil), alertas con stock menor o igual a cinco, hasta diez productos en alerta y cinco pedidos recientes. Los meses sin pedidos muestran cero. No altera datos ni necesita otra migración.

Los accesos “Nuevo producto” y “Nueva promoción” abren sus formularios reales; las tarjetas llevan a las tablas correspondientes. El menú móvil usa fondo superpuesto, bloquea el contenido cubierto y mantiene el foco dentro del menú; Escape o tocar el fondo lo cierra y devuelve el foco. Un error del resumen ofrece Reintentar, sin métricas ficticias. Esta adaptación utiliza las funciones actuales; proveedores, nómina, facturación fiscal y contabilidad no forman parte de esta versión.

El cliente dispone de carrito, checkout y “Mis pedidos”. En la sesión admin, las acciones de compra se ocultan al revisar la tienda; /cuenta.html y /checkout.html llevan al panel y /pedidos.html abre todos los pedidos de clientes. Los enlaces /admin.html?tabla=productos, promociones, pedidos, usuarios o detalles seleccionan la sección correspondiente; valores desconocidos abren Productos. La API mantiene los permisos user/admin de pedidos exigidos por la rúbrica; la interfaz separa las tareas de cada rol.

En **Productos → Editar**, pulsa el selector de imagen, elige un JPG, PNG o WebP y revisa la vista previa. Guarda el producto para publicar el cambio. Admite hasta 2 MiB y 16 millones de píxeles; el servidor verifica el contenido, rechaza animaciones/SVG y recodifica WebP de hasta 1600 px sin metadatos. Las imágenes quedan en `frontend/assets/uploads/` con UUID generado por el servidor. La subida exige admin antes de leer el JSON grande; tiene límite propio de diez intentos por minuto y el resto de la API conserva su límite de 32 KB.

En **Promociones**, carga una imagen propia o pulsa “Usar imagen del producto”. Configura **Descuento (%)**, de 0 a 90, publicación y fechas. Una franja amarilla muestra el porcentaje; el catálogo y la ficha presentan precio anterior tachado y precio rebajado. Solo campañas activas, vigentes y sin vista previa aplican descuento. Si coinciden varias, se aplica el mayor porcentaje y no se acumulan. El servidor calcula en centavos: por ejemplo, $7,50 con 25 % queda en $5,63. El carrito usa ese precio y el pedido guarda precio original, porcentaje y precio final históricos. Cambiar o eliminar la campaña no altera pedidos anteriores.

Las fechas tienen inicio inclusivo y fin exclusivo. El panel utiliza la hora del dispositivo y envía ISO con zona. Las dos campañas iniciales siguen como vistas previas, sin descuentos vigentes inventados. Una imagen propia de campaña requiere descripción accesible.

En **Pedidos de clientes → Gestionar estado**, sigue pendiente → confirmado → preparado → entregado. Puedes cancelar desde pendiente, confirmado o preparado; entregado y cancelado son estados finales. La cancelación devuelve las cantidades al inventario exactamente una vez, dentro de la transacción de cambio de estado. El historial conserva quién hizo cada transición y cuándo; el cliente ve el estado e historial en “Mis pedidos”. Los cambios requieren `esperadoUpdatedAt`: una edición simultánea devuelve 409 para revisar los datos actuales.

Usuarios y detalles son tablas de consulta: no se modifican hashes, roles ni líneas históricas. Los pedidos admiten exclusivamente las transiciones previstas; sus importes y artículos no se reescriben. Las cinco tablas requieren JWT/rol admin, independientemente del enlace visible en la UI.

## Respaldos y restauración

El servidor crea un respaldo al arrancar y cada 24 horas mientras permanece activo. Conserva las siete copias completas más recientes en `server/backups/`. Cada carpeta contiene un snapshot SQLite mediante `VACUUM INTO`, las imágenes subidas referenciadas por productos/campañas y un manifiesto de tamaños y SHA-256. Un fallo de copia se anuncia en el servidor sin presentar un respaldo incompleto como válido.

Respaldo manual:

~~~powershell
npm run backup
~~~

Restauración con los servidores HTTP y HTTPS detenidos:

~~~powershell
npm run backup:restore -- --from "server/backups/backup-FECHA-UUID" --offline --replace
~~~

`--replace` crea una copia previa de la BD actual. El restaurador comprueba el manifiesto, firmas SQLite, integridad, claves foráneas e imágenes; rechaza servidores activos y rutas ajenas. Los UUID de imágenes son inmutables: si existe el mismo UUID con bytes diferentes, se rechaza el conflicto para conservar el archivo actual. No ejecutes una restauración sobre una base en uso.

Si la BD destino está corrupta y no admite un respaldo consistente, antes de reemplazarla se conservan sus bytes y los archivos WAL/SHM existentes en una carpeta privada `server/backups/recovery-FECHA-UUID`, con tamaños y SHA-256. Esta copia forense se marca como no restaurable y queda disponible para revisión; no entra en la retención automática de siete respaldos. Solo los errores de corrupción activan esa recuperación. Si falla la copia previa, los permisos o el espacio, se aborta sin reemplazar la BD; la fuente de restauración debe ser siempre un respaldo válido.

La BD, respaldos e imágenes de trabajo se excluyen de Git/ZIP. Conserva `server/prisma/farmacia.db` y `frontend/assets/uploads/` en almacenamiento persistente cuando despliegues; copiar solo el repositorio no transporta los registros del negocio. Las copias locales no cubren la pérdida del disco: guarda también una copia privada fuera de esa máquina. Las pruebas usan rutas temporales y no crean fotos de prueba en la carpeta personal de imágenes.

## Pruebas, accesibilidad y auditorías

~~~powershell
npm test
npm run test:browser
npm audit
~~~

**37 pruebas Node:** API, recursos, migración sobre datos anteriores, imágenes y respaldo/restauración con BD temporal. **14 pruebas Chrome:** siete recorridos en escritorio/móvil. Usa Chrome instalado y servidor aislado localhost:3300 sin modificar BD de trabajo. Alternativa: npx playwright install chromium y elimina channel:'chrome' de la configuración.

Se cubren JWT admin, creación admin, user 403, catálogo, carrito persistente, pedido en BD y admin ve todos los pedidos. También stock concurrente, reversión, idempotencia, revocación, CORS, validación ecuatoriana, sanitización, errores de red/500 y CRUD de campañas. Las pruebas de navegador comprueban login por rol, navegación administrativa sin compras, enlaces de sección, redirecciones, vista de tienda sin carrito para admin y cierre de sesión; compras y accesibilidad de cuenta/historial se prueban con un cliente. El panel ignora respuestas atrasadas al cambiar de tabla, bloquea acciones durante la carga y borra el contenido administrativo/cierra diálogos cuando vence la sesión.

Las nueve pantallas, el dashboard y sus tablas de Productos/Pedidos se revisan con axe-core WCAG A/AA a 1440 y 375 px, salto al contenido, foco visible, labels, menú y Escape. Las pruebas del resumen verifican 401/403, importes, estados, meses vacíos, el cambio diciembre/enero y límites exactos de stock/vigencia. En navegador se cubren tarjetas con datos reales, creación desde accesos rápidos, reintento tras 500 y expiración al cargar el dashboard. No sustituye evaluación con lectores de pantalla y usuarios ni certifica WCAG.

La prueba cruzada mantiene sesiones independientes de administrador y cliente, con páginas previamente abiertas. Comprueba registro visible en Usuarios, CRUD reflejado en catálogo/campañas, subida real de imágenes y fallback de campaña a la imagen del producto, descuento del 25 % visible en cliente y pedido, estados visibles en ambos recorridos y cancelación que devuelve stock una sola vez. También verifica refresco por foco/visibilidad/30 segundos, carrito entre pestañas, checkout conservado ante cambios de stock, pedido visible en tablas/dashboard y conflicto de edición sin restaurar unidades vendidas. Las pruebas Prisma reconectan la BD y verifican usuarios, productos, promociones, pedidos, detalles y stock; repetir seed conserva cambios, eliminaciones y credenciales. La recuperación con destino corrupto conserva DB/WAL/SHM, recupera usuarios y stock y demuestra que un fallo de copia impide reemplazarlo.

1. [Auditoría 1 — MVC](docs/auditorias/reto2/01-arquitectura-mvc.md).
2. [Auditoría 2 — Persistencia](docs/auditorias/reto2/02-persistencia-prisma.md).
3. [Auditoría 3 — API REST](docs/auditorias/reto2/03-api-rest.md).
4. [Auditoría 4 — Seguridad](docs/auditorias/reto2/04-seguridad.md).
5. [Auditoría 5 — Frontend y accesibilidad](docs/auditorias/reto2/05-frontend-accesibilidad.md).

[Índice y rúbrica](docs/auditorias/reto2/README.md). [Evidencias de ejecución](docs/pruebas/reto2/README.md).

## Entrega comprimida

~~~powershell
npm run package
~~~

Genera **entrega/Reto2_Olmedo_Elkin.zip** con frontend/backend MVC, schema/migración/seed, .env.example, lockfile, README, pruebas y auditorías. Conserva el antecedente Reto 1 para reconstruir plantillas. Excluye secretos, BD personal, certificados, node_modules y logs. En otra carpeta: npm ci y npm run setup.

## Límites prácticos

SQLite sirve para esta entrega; muchas escrituras requieren evaluar otro motor. Rate limit en memoria de una instancia. Los respaldos automáticos requieren el servidor activo y espacio disponible; no se envían a servicios externos. No se implementan pasarela bancaria, logística automática, MFA, recuperación de clave ni verificación de correo. El administrador actualiza los estados; el pago y la entrega se coordinan con la farmacia. Mapa y WhatsApp dependen de servicios externos y el envío requiere confirmación del usuario.

