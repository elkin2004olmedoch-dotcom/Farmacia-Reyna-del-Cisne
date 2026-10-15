# Farmacia Reina del Cisne — Reto 2 Full Stack MVC

## Mascotas animadas para el bot

Farmi, Boti y Goti son compañeros pixel art con nueve gestos cada uno. El widget se carga en las páginas públicas y reacciona al carrito, permite cambiar de personaje y ofrece accesos a búsqueda, pedidos, horario y contacto.

- Prueba la demostración autónoma con las instrucciones de [entrega/mascotas-v3](entrega/mascotas-v3/README.md).
- La vista conjunta animada está en [tres-en-accion.gif](entrega/mascotas-v3/previews/tres-en-accion.gif).
- Los atlases finales y sus estados están descritos en [manifest.json](entrega/mascotas-v3/sprites/manifest.json).
- Para regenerar los recursos se necesita Python 3.12 y Pillow: `py -3.12 entrega/mascotas-v3/fuentes/empaquetar_sprites.py --strict`.

Plataforma de farmacia con catálogo, carrito persistente, registro/login, pedidos en base de datos y administración de productos, promociones, proveedores, lotes, inventario, IVA y facturación electrónica SRI. Mantiene la fachada del negocio, identidad crema/vino, ubicación, WhatsApp y las 18 referencias anteriores. **Abre la [farmacia en línea](https://farmacia-reina-del-cisne.onrender.com/) o [inicia sesión](https://farmacia-reina-del-cisne.onrender.com/cuenta.html).**

**Stack:** Node.js 22.13+ (probado en 24.15), Express 5, JavaScript ES modules, Prisma 6.19.3, SQLite local o PostgreSQL en Supabase, y Sharp 0.35.5 para imágenes. Se utiliza el motor relacional alternativo permitido por el enunciado y confirmado por el estudiante; no requiere SQL Server. El pago y la entrega se coordinan con la farmacia, sin pasarela bancaria.

**Agente de reposición:** servicio adicional en C#/.NET 10, PostgreSQL/Npgsql y MailKit, con revisión diaria, auditoría, correo al proveedor y aprobación del gerente por Telegram/WhatsApp. El código y la arquitectura están en [services/inventory-agent](services/inventory-agent/) y [su guía de configuración](docs/AGENTE-INVENTARIO.md). Comienza desactivado; los envíos reales y el alojamiento de este servicio requieren completar la configuración privada del negocio.

## Administración de farmacia e impuestos

En [el panel en línea](https://farmacia-reina-del-cisne.onrender.com/admin.html), **Productos** permite cambiar imagen, precio final con IVA, descuento directo de **0 a 85 %**, tarifa general o tarifa 0 % con fundamento legal, ficha farmacéutica, PVP máximo y stock mínimo. Para medicamento se exige PVP, laboratorio, presentación y registro sanitario; el precio final original no puede superar PVP. **Promociones** admite el mismo límite y muestra franja amarilla; cuando coinciden campañas y descuento directo, se usa el mayor porcentaje sin sumarlos.

Una campaña **publicada y vigente** aplica el mismo precio efectivo en promociones, catálogo, ficha, carrito y confirmación del pedido. Una **vista previa** conserva una propuesta sin aplicar descuentos: el panel y la tarjeta deben identificarla como tal. La vigencia se introduce en hora de Ecuador y se vuelve a verificar al confirmar; los pedidos anteriores conservan su descuento histórico.

**Configuración de IVA** registra tarifa general 13, 14 o 15 %, fecha de inicio en hora de Ecuador y referencia normativa. Al 11 de octubre de 2026 rige **15 %**; el feriado turístico de 8 % no se aplica automáticamente a esta farmacia. La clasificación 0 % requiere revisión del producto concreto. Los precios conservan su carácter final: el impuesto se desglosa, no se añade por segunda vez. Carrito y pedido calculan centavos por línea, y el historial conserva la tarifa aplicada. Consulta [fuentes y criterios ecuatorianos](docs/ECUADOR-FARMACIA.md).

**Proveedores**, **Lotes y vencimientos** y **Movimientos de inventario** guardan abastecimiento, caducidad, cantidades, costos y ajustes justificados con administrador/fecha. Las ventas utilizan primero los lotes que vencen antes; las unidades vencidas no se ofrecen. Cancelar devuelve una sola vez las unidades a sus lotes. Los productos con receta piden revisión en la farmacia y no permiten confirmación automática desde el carrito. Los datos farmacéuticos y lotes anteriores no se inventan.

**Facturación SRI** configura emisor, establecimiento, punto de emisión, ambiente, numeración y firma P12/PFX desde el panel. Crea un borrador desde un pedido, verifica comprador y forma de pago, revisa su RIDE y firma/envía al SRI. Conserva respuestas de recepción y autorización, XML, RIDE, numeración y snapshot tributario. El cliente consulta su factura desde Mis pedidos. El ambiente de pruebas y un borrador no tienen validez tributaria; producción exige confirmación específica. La instalación publicada mantiene emisor y firma sin configurar para su revisión. La conexión real, pruebas con la firma del propietario y validación ante SRI se realizarán posteriormente: una factura requiere autorización del SRI en producción para tener validez tributaria. No se ha autorizado una factura real como parte de estas pruebas. Consulta [la guía SRI](docs/SRI-FACTURACION.md).

La tienda ocupa todo el ancho del escritorio y adapta tarjetas/formularios a pantallas pequeñas. Los controles conservan etiquetas, foco visible, mensajes asociados a campos, Tab/Mayús+Tab, Enter/Espacio y Escape. Las tablas amplias tienen desplazamiento propio.

## Instalación y ejecución

~~~powershell
npm ci
npm run setup
npm start
~~~

Abre **http://localhost:3000/**. Express sirve frontend y API en el mismo origen. Setup genera el cliente Prisma, aplica la migración, ejecuta seed y construye las nueve pantallas. Si .env no existe, genera JWT_SECRET y contraseña admin aleatorios; no sobrescribe un archivo existente.

Consulta ADMIN_EMAIL y ADMIN_PASSWORD en tu **archivo privado .env** e inicia sesión en /cuenta.html. Una cuenta admin entra automáticamente en /admin.html; una cuenta cliente conserva su cuenta, carrito e historial. No compartas ese archivo. Las cuentas normales se crean desde “Crear cuenta”; el registro nunca concede admin. Usa datos de prueba con formatos/verificadores ecuatorianos válidos durante la evaluación.

Los 18 productos comienzan con stock de demostración de 20 unidades y precios de referencia. Confirma los datos comerciales reales con la farmacia. El seed no restaura stock vendido ni sobrescribe ediciones, usuarios o contraseñas existentes. El marcador técnico `Semilla` inicializa el catálogo una sola vez y conserva las promociones eliminadas; al actualizar una base anterior adopta el catálogo inicial existente.

Para actualizar una instalación existente, detén el servidor, ejecuta `npm ci`, `npm run db:generate`, `npm run db:migrate`, `npm run db:seed` y `npm start`. La segunda migración añade el marcador de inicialización; la tercera añade estados/historial, versiones de pedidos, porcentajes e imágenes de campañas. Las migraciones posteriores incorporan fiscalidad, trazabilidad de farmacia y emisión SRI. Se conserva el IVA histórico desconocido como NULL. Conserva una copia privada de la BD y de las imágenes subidas antes de migrar; no reemplaces los archivos por datos de demostración. La conversión se prueba también con pedidos anteriores.

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
    migrations/202610110004_fiscal_inventory/migration.sql
    migrations/202610110005_billing/migration.sql
    migrations/202610110006_pharmacy_pvp/migration.sql
    migrations/migration_lock.toml
    seed.cjs
    postgresql/       schema y migración PostgreSQL con RLS
scripts/            instalación local/nube, traslado, frontend, HTTPS y ZIP
services/
  inventory-agent/  host .NET 10, Worker, canales, webhooks, SQL y pruebas
tests/reto2/        API, recursos, nube, traslado y navegador
docs/
  REQUISITOS-RETO-2.txt
  DESPLIEGUE-GRATUITO.md
  auditorias/reto2/  cinco auditorías completas
  pruebas/reto2/     evidencias y resultados
.env.example
render.yaml
package.json
package-lock.json
~~~

Cliente: controlador → modelo Fetch/estado → vista reutilizable. Los modelos no renderizan DOM: publican señales con EventTarget. Las vistas no consumen API ni registran eventos del flujo. La misma tarjeta de views/products.js se utiliza en portada y catálogo. scripts/build-frontend.cjs genera cabecera, pie y campos compartidos: edita sus plantillas para conservar cambios al reconstruir HTML.

Servidor: ruta → validación/JWT/rol → controlador HTTP → modelo Prisma → BD. El cálculo/transacción del pedido pertenece al modelo. Hay middleware de errores centralizado y logger sin cuerpos ni credenciales.

Los HTML, js/ y assets/ raíz conservan el Reto 1 como antecedente; su README está en docs/README-RETO-1.md. **Evalúa el Reto 2 en la [farmacia en línea](https://farmacia-reina-del-cisne.onrender.com/) o con npm start y localhost:3000**. La aplicación completa utiliza Express y una base relacional.

El [enlace de GitHub Pages](https://elkin2004olmedoch-dotcom.github.io/Farmacia-Reyna-del-Cisne/) abre la misma ruta de la aplicación pública de Render, conservando consulta e identificador de producto mediante `data/deployment.json`. Clientes y administrador utilizan esa aplicación y la misma base PostgreSQL/Storage de Supabase. La foto de Alcohol antiséptico seleccionada localmente fue trasladada y comprobada. Las futuras ediciones deben hacerse en el **panel en línea**; una instalación SQLite local conserva datos independientes. GitHub no guarda cuentas, pedidos ni claves privadas.

El service worker consulta primero en internet los JSON de productos y promociones y guarda la última respuesta correcta para uso sin conexión. Las imágenes nuevas usan un nombre versionado y cada cambio de recursos debe actualizar la versión de caché del service worker para reemplazar las copias anteriores.

### Publicar gratis la aplicación completa

La [farmacia en línea](https://farmacia-reina-del-cisne.onrender.com/) está desplegada con **Render Free + PostgreSQL y Storage de Supabase**. `render.yaml` permite reproducir la configuración; conserva el modo SQLite local y usa un cliente Prisma PostgreSQL independiente, migraciones con RLS e imágenes persistentes. Consulta [la guía paso a paso](docs/DESPLIEGUE-GRATUITO.md), incluido el traslado privado y los límites de los planes gratuitos.

**Render y Supabase están conectados y comprobados:** se trasladaron un administrador, 18 productos, dos promociones y una foto; los registros y el SHA-256 de la imagen coinciden con la fuente. Se aprobaron 16 comprobaciones sobre la API pública, el recorrido de administrador/cliente en navegador y seis comprobaciones después de reiniciar Render. Registro/login, pedidos, stock, cancelación, imagen y descuento del 25 % funcionaron con datos sintéticos que después se retiraron. El cambio de imagen y precio desde el panel apareció en la ficha del cliente y sobrevivió al reinicio. Pages tiene activado el enlace a esa misma aplicación. Inicia sesión con la cuenta administrativa conservada para entrar al panel; los clientes crean su cuenta desde “Crear cuenta”. Los planes gratuitos tienen pausas y límites; las copias de PostgreSQL y Storage deben hacerse por separado de los respaldos SQLite locales.

## Persistencia y consistencia

| Entidad | Campos principales |
|---|---|
| Producto | precio final, descuento directo 0–85, clasificación/fundamento IVA, ficha farmacéutica, PVP máximo, stock/mínimo, imagen y activo |
| Usuario | id, email único, nombre, teléfono, passwordHash, role, activo, tokenVersion |
| Pedido | id, userId FK, total Decimal, entrega, comprador, documento enmascarado, estado, createdAt, updatedAt |
| PedidoDetalle | producto/nombre histórico, cantidad, precios original/final, descuento, base/IVA/tarifa/total histórico |
| PedidoEstado | pedidoId FK, estado anterior/nuevo, actorId FK y fecha; historial de cambios |
| Promocion | producto, publicación/vista previa, vigencia, orden, descuento 0–85 e imagen/alt propios opcionales |
| ConfiguracionFiscal | tarifa general, vigencia, fundamento normativo, actor y fechas |
| Proveedor | nombre, RUC, correo/teléfono de Ecuador, dirección y activo |
| Lote | producto, número, vencimiento, stock, costo y proveedor |
| MovimientoInventario | producto/lote/pedido, actor, tipo, cantidad, motivo y fecha |
| PedidoDetalleLote | asignación de cantidades reservadas a lotes |
| ConfiguracionEmisor | emisor SRI, ambiente/códigos y certificado cifrado |
| SecuenciaFactura | último secuencial por RUC/ambiente/establecimiento/punto |
| FacturaPedido | snapshot privado, estado, numeración, clave, XML firmado/autorizado y respuestas SRI |

El carrito guarda IDs/cantidades en localStorage. El servidor lee precio/stock, calcula en centavos y persiste Decimal. Cabecera, detalles y descuento de stock están en una transacción serializable; una línea sin stock revierte todo el pedido.

Cada confirmación incluye UUID de idempotencia. Repetir la misma solicitud devuelve el pedido existente sin otro descuento; la misma clave con otros datos devuelve 409. El cliente guarda solo clave y huella, no documento en claro. Los detalles preservan nombre/precio históricos. DELETE producto lo desactiva sin destruir el historial.

El editor de productos envía `esperadoUpdatedAt` con la versión que recibió al abrirse. Una compra u otra edición cambia esa versión; un guardado antiguo devuelve `409 PRODUCT_CHANGED` y conserva el stock/precio actual. Cierra y vuelve a abrir el editor para revisar los datos antes de guardar. Este campo es opcional para clientes API anteriores; el panel lo incluye siempre.

### Conexión entre administrador y clientes

Todos los módulos consultan la misma API y BD: el registro aparece en Usuarios; los productos y campañas administrados aparecen en la tienda; los pedidos del cliente aparecen en Pedidos, Detalles y dashboard, con descuento de stock. Cada cliente consulta únicamente su historial.

El agente de reposición tiene un modo **Integrated** que consulta los productos, proveedores y lotes del mismo PostgreSQL, sin copiar existencias ni cambiar stock al enviar un correo. Su modo **Standalone** incluye las tablas `Medicamentos`, `Proveedores` y `AuditoriaPedidos` para una instalación aislada. Se elige un solo modo; la tienda continúa realizando las ventas y entradas de inventario.

La prioridad **primordial** genera el correo de compra automáticamente; **intermedio** y **bajo** esperan aprobación del gerente. Las respuestas de ambos canales comparten una solicitud y una tarea de correo: aprobar dos veces no genera dos compras. La auditoría conserva el resultado y los envíos SMTP inciertos esperan revisión. Consulta [arquitectura, SQL, variables privadas y límites de los canales](docs/AGENTE-INVENTARIO.md).

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
| GET | /api/configuracion/fiscal | Público; tarifa vigente |
| GET/POST | /api/admin/configuracion/fiscal | admin; historial y nueva vigencia |
| GET/POST | /api/admin/proveedores | admin; listado y creación |
| PUT | /api/admin/proveedores/:id | admin; edición |
| GET/POST | /api/admin/lotes | admin; listado e ingreso |
| GET | /api/admin/inventario/movimientos | admin; historial |
| POST | /api/admin/inventario/ajustes | admin; entrada/salida justificada |
| GET/PUT | /api/admin/facturacion/configuracion | admin; emisor y numeración |
| POST | /api/admin/facturacion/certificado | admin; firma privada P12/PFX |
| GET/POST | /api/admin/facturacion/facturas | admin; listado y borrador |
| POST | /api/admin/facturacion/facturas/:id/emitir | admin; firma, envío/consulta SRI |
| GET | /api/pedidos/:id/factura | propietario del pedido o admin |
| GET | /api/facturacion/facturas/:id/xml | propietario del pedido o admin |
| GET | /api/facturacion/facturas/:id/ride | propietario del pedido o admin |
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

Controles adicionales: Helmet, API sin caché, cuerpo JSON de 32 KB y parsers de 3 MiB exclusivamente para imágenes y certificados después de autenticar al administrador, paginación y errores centralizados. Los certificados se cifran en la BD y nunca se devuelven al navegador. Config rechaza JWT_SECRET débil, CORS comodín y orígenes HTTP en producción. CORS usa orígenes exactos y no sustituye JWT/roles. Las prácticas siguen la [guía de Express](https://expressjs.com/en/advanced/best-practice-security.html).

JWT de 30 minutos en sessionStorage; logout revoca los tokens del usuario. La cédula del registro no se conserva; el documento del pedido se enmascara. No se piden ni guardan tarjeta, CVV o vencimiento. Una factura SRI conserva la identificación completa necesaria en un snapshot privado, con acceso del administrador y del comprador propietario; sus listados muestran identificación enmascarada. El admin ve datos de entrega necesarios, sin passwordHash ni huellas internas. Logger sin body ni Authorization.

.env, BD, dependencias y claves privadas se excluyen de Git/ZIP; el backend publica solo frontend/. El override deepmerge-ts 8.0.0 corrige la alerta transitiva detectada y se verificó con Prisma, migraciones y pruebas. No se declara certificación OWASP.

## HTTPS opcional

Requiere OpenSSL; el script detecta el incluido con Git para Windows:

~~~powershell
npm run cert:dev
npm run start:https
~~~

Abre **https://localhost:3443/**. El certificado self-signed de desarrollo puede mostrar advertencia de confianza; no se sobrescriben archivos existentes. Producción necesita certificado confiable o proxy HTTPS, NODE_ENV=production y CORS_ORIGIN real. TLS_CERT_PATH/TLS_KEY_PATH admiten certificados propios.

## Panel administrador

El panel adopta el diseño ERP de la referencia: barra lateral fija por áreas, cabecera compacta, dashboard con tarjetas y tablas de gestión a todo el ancho. Conserva los colores crema/vino de la farmacia. General contiene Dashboard; Inventario, Productos, Lotes y Movimientos; Compras, Proveedores; Ventas, Pedidos, Detalles y Facturación SRI; Comercial, Promociones; Administración, Usuarios y Configuración de IVA. “Ver tienda” permite revisar la página pública y “Cerrar sesión” revoca la sesión.

`/admin.html` abre el **Dashboard ejecutivo** con ocho indicadores reales: importe de pedidos del mes, importe acumulado, pedidos pendientes, stock bajo, productos activos, clientes activos, administradores y campañas vigentes (incluye vistas previas). Añade alertas de inventario, accesos rápidos, pedidos por estado, tendencia de seis meses y últimos pedidos. Los importes representan pedidos registrados; no son cobros ni facturas.

`GET /api/admin/resumen` genera el resumen en una transacción consistente de Prisma. Calcula dinero en centavos, meses con horario de Ecuador continental (America/Guayaquil), alertas con stock menor o igual a cinco, hasta diez productos en alerta y cinco pedidos recientes. Los meses sin pedidos muestran cero. No altera datos ni necesita otra migración.

Los accesos “Nuevo producto” y “Nueva promoción” abren sus formularios reales; las tarjetas llevan a las tablas correspondientes. El menú móvil usa fondo superpuesto, bloquea el contenido cubierto y mantiene el foco dentro del menú; Escape o tocar el fondo lo cierra y devuelve el foco. Un error del resumen ofrece Reintentar, sin métricas ficticias. La ampliación incorpora proveedores, inventario farmacéutico y facturación electrónica SRI. Nómina y contabilidad general siguen fuera del alcance acordado.

El cliente dispone de carrito, checkout y “Mis pedidos”. En la sesión admin, las acciones de compra se ocultan al revisar la tienda; /cuenta.html y /checkout.html llevan al panel y /pedidos.html abre todos los pedidos de clientes. Los enlaces /admin.html?tabla=productos, promociones, pedidos, usuarios o detalles seleccionan la sección correspondiente; valores desconocidos abren Productos. La API mantiene los permisos user/admin de pedidos exigidos por la rúbrica; la interfaz separa las tareas de cada rol.

En **Productos → Editar**, pulsa el selector de imagen, elige un JPG, PNG o WebP y revisa la vista previa. Guarda el producto para publicar el cambio. Admite hasta 2 MiB y 16 millones de píxeles; el servidor verifica el contenido, rechaza animaciones/SVG y recodifica WebP de hasta 1600 px sin metadatos. En modo local, las imágenes quedan en `frontend/assets/uploads/` con UUID generado por el servidor; en modo nube, se guardan en Supabase Storage conservando esa referencia y se sirven mediante una redirección pública. La subida exige admin antes de leer el JSON grande; tiene límite propio de diez intentos por minuto. La carga privada del certificado tiene su propio parser autorizado; las demás rutas conservan 32 KB.

En **Promociones**, carga una imagen propia o pulsa “Usar imagen del producto”. Configura **Descuento (%)**, de 0 a 85, publicación y fechas. Una franja amarilla muestra el porcentaje; el catálogo y la ficha presentan precio anterior tachado y precio rebajado. Solo campañas activas, vigentes y sin vista previa aplican descuento. Si coinciden varias, se aplica el mayor porcentaje y no se acumulan. El servidor calcula en centavos: por ejemplo, $7,50 con 25 % queda en $5,63. El carrito usa ese precio y el pedido guarda precio original, porcentaje y precio final históricos. Cambiar o eliminar la campaña no altera pedidos anteriores.

Las fechas tienen inicio inclusivo y fin exclusivo. El panel utiliza la hora de Ecuador (UTC−5) y envía ISO con zona. Al editar una vista previa, pulsa **Publicar descuento del X %** para aplicarla; guardar una propuesta conserva su estado de vista previa. Las campañas del seed comienzan como propuestas y una imagen propia requiere descripción accesible. La campaña de cuidado solar configurada por el administrador se publicó con 26 % y su vigencia original, hasta el 11 de octubre de 2026 a las 14:59 de Ecuador; no se amplió automáticamente.

En **Pedidos de clientes → Gestionar estado**, sigue pendiente → confirmado → preparado → entregado. Puedes cancelar desde pendiente, confirmado o preparado; entregado y cancelado son estados finales. La cancelación devuelve las cantidades al inventario exactamente una vez, dentro de la transacción de cambio de estado. El historial conserva quién hizo cada transición y cuándo; el cliente ve el estado e historial en “Mis pedidos”. Los cambios requieren `esperadoUpdatedAt`: una edición simultánea devuelve 409 para revisar los datos actuales.

**Mis pedidos** muestra una línea de seguimiento con iconos de reloj, confirmación, paquete y entrega. Distingue la etapa actual, las completadas y las pendientes, con fechas en hora de Ecuador. Un pedido cancelado conserva las etapas registradas y muestra su aviso específico. Mientras la página está visible, consulta el estado cada cinco segundos; también al volver a la pestaña. Conserva el historial abierto y el foco del teclado cuando cambia el estado. Los demás refrescos periódicos mantienen treinta segundos.

El seguimiento está publicado en Render. Se verificaron los archivos servidos, la sesión exigida y la conservación de los datos antes/después del despliegue, incluidas promociones editadas recientemente. [Evidencias de publicación y datos](docs/pruebas/reto2/README.md#publicación-del-seguimiento).

La conexión con WhatsApp queda pendiente hasta recibir los datos y comprobar la elegibilidad del negocio, según lo acordado con el dueño. Las confirmaciones y el seguimiento se gestionan actualmente desde la web. Responder «OK» en la aplicación de WhatsApp todavía no modifica pedidos. Se documentan los requisitos para la conexión futura en [WhatsApp y pedidos](docs/WHATSAPP-PEDIDOS.md).

Usuarios y detalles son tablas de consulta: no se modifican hashes, roles ni líneas históricas. Los pedidos admiten exclusivamente las transiciones previstas; sus importes y artículos no se reescriben. Las tablas administrativas requieren JWT/rol admin, independientemente del enlace visible en la UI.

## Respaldos y restauración

En modo **SQLite local**, el servidor crea un respaldo al arrancar y cada 24 horas mientras permanece activo. Conserva las siete copias completas más recientes en `server/backups/`. Cada carpeta contiene un snapshot SQLite mediante `VACUUM INTO`, las imágenes subidas referenciadas por productos/campañas y un manifiesto de tamaños y SHA-256. Un fallo de copia se anuncia en el servidor sin presentar un respaldo incompleto como válido. Estos comandos no respaldan PostgreSQL ni Storage; configura sus copias privadas siguiendo la guía de despliegue.

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

**136 pruebas Node:** API, fiscalidad, PVP, lotes/FEFO, migración histórica, firma/XML/SOAP SRI simulado, imágenes, respaldo, publicación de campañas y configuración de producción. **40 pruebas Chrome:** recorridos en escritorio/móvil, con comprobaciones adicionales a 320, 768 y 1920 px, teclado, axe y descuento consistente desde administrador hasta pedido. **34 pruebas del antecedente estático:** incluye sesión bloqueada y enlace Pages al servicio público. Usa Chrome instalado y servidor aislado localhost:3300 sin modificar BD de trabajo. Alternativa: npx playwright install chromium y elimina channel:'chrome' de la configuración. Las suites SRI utilizan datos y certificados sintéticos; no autorizan comprobantes reales.

El agente C# se prueba por separado con `dotnet test services/inventory-agent/tests/InventoryAgent.Tests.csproj --configuration Release` y .NET SDK 10. Las pruebas HTTP y de canales simulan los envíos. Las pruebas de PostgreSQL exigen la variable privada `INVENTORY_AGENT_TEST_CONNECTION`, crean esquemas temporales propios y los retiran al finalizar; sin esa variable se omiten explícitamente. El workflow [inventory-agent.yml](.github/workflows/inventory-agent.yml) utiliza PostgreSQL 17 independiente de la farmacia. Consulta [los resultados del agente](docs/pruebas/reto2/inventory-agent-results.json).

La verificación final del agente aprobó **92 de 92 pruebas**, incluidas **16 de PostgreSQL**, sin omisiones ni envíos reales; sus dependencias no reportaron vulnerabilidades. Se comprueba aprobación simultánea, callback antes de persistir el envío, stock/proveedor cambiado, recuperación tras fallos seguros y revisión obligatoria ante una entrega incierta. Los permisos del rol de producción requieren aplicar y revisar el ejemplo privado antes de activar el servicio.

La etapa inicial de conexión PostgreSQL/Storage comprobó autenticación, imágenes, edición, promociones, pedidos y reinicio de Render. Sus datos sintéticos se retiraron y su [evidencia histórica](docs/pruebas/reto2/nube.json) se conserva por separado. La ampliación actual aplicó las seis migraciones en SQLite y PostgreSQL, conserva todos los campos y filas originales de cada instalación y verifica RLS sin políticas públicas en las 16 tablas de Supabase. Ocho comprobaciones nativas de PostgreSQL probaron descuentos, IVA, PVP y lotes dentro de transacciones revertidas. No se reimportaron ni eliminaron cuentas o pedidos reales. Consulta [evidencia local](docs/pruebas/reto2/ampliacion-local.json), [evidencia de nube](docs/pruebas/reto2/ampliacion-nube.json) y [restricciones PostgreSQL](docs/pruebas/reto2/restricciones-postgresql.json).

La ampliación quedó publicada en Render y GitHub Pages. Pasaron 15 comprobaciones de la API real y se verificó la interfaz del administrador y del cliente. Emisor/firma SRI continúan vacíos para revisión del propietario; la validación real de emisión sigue pendiente. [Comprobaciones públicas](docs/pruebas/reto2/ampliacion-publicada.json) y [despliegue](docs/pruebas/reto2/ampliacion-despliegue.json).

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

Genera **entrega/Reto2_Olmedo_Elkin.zip** con frontend/backend MVC, schema/migración/seed, agente C#/SQL, configuración pública de referencia, lockfile, README, pruebas y cinco auditorías. Conserva el antecedente Reto 1 para reconstruir plantillas. Excluye secretos, BD personal, certificados, node_modules, bin/obj y logs. En otra carpeta: npm ci y npm run setup; el agente tiene su propia instalación descrita en su guía.

## Límites prácticos

SQLite sirve para la instalación local; la aplicación pública utiliza PostgreSQL y Storage de Supabase. Rate limit en memoria de una instancia. Los respaldos automáticos SQLite requieren el servidor activo y espacio disponible; no cubren los servicios de nube. Render y Supabase gratuitos tienen límites y pausas por inactividad, sin garantía de disponibilidad continua. El nuevo agente todavía requiere cuentas, plantillas y configuración privada: para Gmail SMTP necesita alojamiento siempre activo con puertos SMTP disponibles; Render Free bloquea esos puertos. No se implementan pasarela bancaria, logística automática, MFA, recuperación de clave ni verificación de correo. El administrador actualiza los estados; el pago y la entrega se coordinan con la farmacia. Mapa y WhatsApp dependen de servicios externos y el envío requiere confirmación del usuario.

