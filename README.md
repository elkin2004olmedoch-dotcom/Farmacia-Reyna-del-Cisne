# Farmacia Reina del Cisne

## Enlaces del proyecto

| Enlace | Qué puedes ver |
| --- | --- |
| [Abrir la farmacia del aula](https://farmacia-reina-del-cisne-aula.onrender.com/index.html) | Portada pública para presentar el catálogo, comprar e iniciar sesión como cliente o administrador. |
| [Código del frontend · src/](./src/) | Pantallas, estilos y JavaScript que usa el navegador. |
| [Código del backend · backend/](./backend/) | Servidor Express, rutas de la API, permisos y acceso a la base de datos. |
| [Abrir Supabase](https://supabase.com/dashboard/org/chodapgnhwgcvaszlngq) | Panel de la organización. Selecciona el proyecto de la farmacia para consultar sus tablas y relaciones. Requiere acceso a la organización. |
| [Abrir el servicio de la farmacia en Render](https://dashboard.render.com/web/srv-db5sg2ss728c738t3n6g) | Panel del backend principal con el estado y el historial de despliegues. Requiere acceso al servicio. |

Tienda y gestión farmacéutica con sede en Puerto Quito y cobertura configurable en Ecuador: catálogo, carrito, pedidos, administración y reparto. Conserva la identidad crema/vino, el logo y una mascota animada compartida por clientes y administración.

La cobertura nacional comienza con envío gratuito; Puerto Quito conserva su tarifa local. Si no se localiza el destino, el checkout selecciona retiro y exige confirmar nuevamente. La ventana de tarjetas valida datos sintéticos sin efectuar cobros. [Pagos y cobertura nacional](docs/PAGOS-Y-COBERTURA-NACIONAL.md).

## Abrir la aplicación

- [Tienda](https://farmacia-reyna-del-cisne-pruebas.pages.dev/): catálogo, carrito y compra desde el navegador.
- [Administración](https://farmacia-reyna-del-cisne-pruebas.pages.dev/admin): productos, usuarios y configuración; requiere rol admin.
- [Entregas](https://farmacia-reyna-del-cisne-pruebas.pages.dev/entregas): requiere cuenta de administrador o repartidor.
- [Pago de pedidos](https://farmacia-reyna-del-cisne-pruebas.pages.dev/pagos): abre un pedido desde **Mis pedidos** para consultar su importe y coordinar el pago con la farmacia.

Los accesos privados se entregan fuera del repositorio. El proyecto funciona desde el navegador; los instaladores, APK y proyectos nativos se retiraron el 23 de noviembre de 2026.

## Arquitectura

Tres capas: presentación HTML/CSS/JavaScript, aplicación Node.js/Express y persistencia Prisma 6/PostgreSQL en Supabase. SQLite se utiliza para desarrollo y pruebas.

| Ruta | Uso |
| --- | --- |
| src/ | Aplicación MVC publicada, catálogo, compra y administración |
| backend/ | API REST, autenticación JWT, roles y reglas de negocio |
| backend/prisma/ | Esquema y migraciones SQLite |
| backend/prisma/postgresql/ | Esquema y migraciones PostgreSQL |
| scripts/ | Generación de vistas, distribución y comprobaciones |
| tests/ | Pruebas con datos sintéticos y bases temporales |
| assets/, js/ y HTML de raíz | Antecedente académico conservado para test:reto1 |

El HTML de src/ se genera desde scripts/build-frontend.cjs y scripts/templates/. Cloudflare publica únicamente la salida de scripts/build-pages.cjs; Render mantiene la API existente. [Arquitectura comercial](docs/ARQUITECTURA-COMERCIAL.md).

La ubicación pública y el enlace de retiro usan el mismo marcador de Consulab compartido por el titular, definido en `src/models/pharmacy.js`. Abrir **Visítanos** carga el mapa; cerrar la sección lo descarga. Se mantienen los colores vino, rojo y crema. [Revisión y preparación del Reto 2](docs/REVISION-RETO-2-2026-11-03.md).

El catálogo consulta páginas de 24 productos y conserva búsqueda, filtros y orden en la URL. La cabecera y el catálogo ofrecen sugerencias con imagen y precio, selección por teclado y coincidencias aproximadas identificadas. Las fichas reúnen compra, disponibilidad, retiro/envío y los datos técnicos registrados. [Catálogo y búsqueda](docs/CATALOGO-Y-BUSQUEDA.md).

La tienda organiza sus referencias en 16 secciones compartidas por catálogo, administración y Goti. La ampliación incorpora 48 fichas con fotografías oficiales, empresa y presentación documentadas, publicadas para consulta hasta registrar sus datos comerciales. Administración puede completar precio y existencias y desactivar **Solo consulta**. La API comprueba nuevamente el estado al comprar, repetir un pedido o aplicar una promoción. [Secciones y productos para consulta](docs/PRODUCTOS-API-Y-ACTUALIZACIONES.md#secciones-y-referencias-para-consulta).

**Mi cuenta** incorpora direcciones guardadas y favoritos persistentes. **Volver a comprar** revisa los precios, existencias y restricciones actuales antes de pedir confirmación para añadir al carrito. Las fichas admiten reseñas únicamente de compras propias entregadas, con nombre abreviado y sin publicar datos de contacto. [Experiencia completa](docs/EXPERIENCIA-COMPLETA.md).

Las nuevas entregas se confirman mediante un código privado del comprador, con límite de intentos. El seguimiento incluye incidencias y una ventana estimada cuando existe una ruta calculada desde GPS reciente del repartidor; indica su origen, caducidad y posibles retrasos. Goti presenta productos y resúmenes visuales y abre el registro exacto después de una orden administrativa confirmada.

La [comparación con PLIEGO](docs/COMPARACION-PLIEGO-Y-ALCANCE.md) distingue requisitos académicos, mejoras útiles y funciones exclusivas de libros digitales. La compra concentra marca y regreso al catálogo; administración agrupa las opciones avanzadas. El carrito lateral confirma quitar/vaciar y permite deshacer una retirada comprobando disponibilidad actual. El registro web pendiente comprueba la confirmación cada dos segundos y puede continuar cuando el correo se verifica desde otro navegador, mediante un permiso temporal vinculado al alta. Una sesión ajena conserva su cuenta.

**Mis pedidos** permite al comprador cancelar sus pedidos pendientes o confirmados, con confirmación y control de versión. La API comprueba propiedad antes de cualquier reintento y repone existencias una sola vez; los cobros reales y las facturas emitidas mantienen sus restricciones de conciliación. La confirmación y el historial ofrecen un único acceso al comprobante, con impresión y envío al correo registrado; los controles técnicos de SRI permanecen en administración.

## Compra, pago y seguimiento

En los pedidos nuevos pagados en modo de práctica, la confirmación muestra el avance automático hasta la entrega o el retiro en 32 segundos. El servidor calcula las etapas desde la hora registrada del pago. Mis pedidos recupera el mismo avance tras recargar. Este recorrido no despacha a un repartidor ni acredita una entrega comercial. Para volver al flujo manual en compras futuras configura `PRACTICE_FULFILLMENT_ENABLED=false`. El historial anterior conserva su modalidad. Durante la presentación, la navegación mantiene Cobertura y tarifas y oculta los accesos operativos de reparto y facturación.

- Con pagos de prueba habilitados, el checkout revisa tarjeta o transferencia y total antes de guardar; pedido y pago se registran juntos. Cancelar conserva el carrito. El comprobante se solicita por correo después de confirmar. [Compra, seguridad y privacidad](docs/COMPRA-SEGURIDAD-Y-PRIVACIDAD.md).
- La pantalla de pago muestra el importe guardado del pedido. Tarjeta permite solicitar un enlace seguro por WhatsApp cuando PayPhone no está habilitado. Transferencia muestra banco, tipo, cuenta y titular configurados por el negocio y permite copiarlos junto al importe y referencia; el envío del comprobante queda pendiente de verificación.
- Con `PAYMENT_PRACTICE_ENABLED=true`, tarjeta y transferencia muestran **Pagar** y completan un recorrido identificado como **Sin cobro real**. El formulario valida marca, Luhn, vencimiento, CVV y titular en el navegador y descarta sus datos; la API recibe método y marca, nunca el número ni CVV. El resultado se guarda en `PagoPractica`, separado de los pagos comerciales, y el modo bloquea iniciar cobros PayPhone. Apagarlo es obligatorio antes de habilitar cobros reales.
- **Ver comprobante**, disponible en la confirmación y en **Mis pedidos**, abre el resumen imprimible. **Guardar PDF / imprimir** permite elegir **Guardar como PDF** en el navegador. Es un comprobante del pedido sin validez tributaria: no acredita un pago ni sustituye la factura SRI.
- Con el correo habilitado, los pedidos nuevos solicitan automáticamente el envío del comprobante al correo verificado de la cuenta. **Enviar a mi correo** permite reintentarlo; si existe una factura autorizada, envía su XML y representación imprimible. Una instalación nueva mantiene los envíos desactivados hasta configurar el proveedor y el remitente. La aceptación del proveedor no garantiza recepción en bandeja.
- La confirmación y **Mis pedidos** incluyen una vista de mapa voluntaria. **Ver mapa** utiliza un destino autorizado por el comprador o la ubicación reciente compartida por el repartidor, cuando existen. El seguimiento habitual sigue disponible; los pedidos cerrados no muestran ubicaciones.

La confirmación de correo conserva el backend JWT: enlace de un solo uso, caducidad de una hora y reenvío. En producción se exige confirmar el correo; si el envío está desactivado, el registro se pausa sin crear cuentas ni entregar JWT. Se eligió Brevo gratuito por API HTTPS; Resend sigue siendo compatible. El envío real requiere completar la cuenta, el remitente y las credenciales privadas. La [guía de correo y dominio](docs/CORREO-Y-DOMINIO.md) explica la activación y los pasos separados para un `.com` propio. Los correos usan la identidad de la farmacia e incluyen verificación, comprobante, factura autorizada y aviso de entrega.

Al pulsar **Confirmar y entrar**, el cliente recibe su sesión web y vuelve al catálogo. La sesión se entrega por el POST de confirmación mediante cookies HttpOnly, Secure y SameSite=Strict; el JWT no se guarda en el almacenamiento del navegador ni en el enlace. El token de correo se consume una sola vez e invalida las sesiones anteriores; confirmar un correo del personal no entrega una sesión administrativa. El formulario actual valida formato sin cobro real; aceptar tarjetas comerciales exige activar la cuenta PayPhone y guardar tarjetas para compras futuras requiere además autorización de tokenización del proveedor.

## Mascotas y confirmaciones

**Perfil:** clientes, administradores y repartidores pueden editar únicamente su nombre y teléfono desde **Mi cuenta**, el enlace **Perfil** del personal o escribiendo **perfil** en la mascota. Guardar actualiza los datos de la cuenta; cancelar recupera los últimos datos guardados. El correo se muestra enmascarado. La tabla administrativa de usuarios excluye correos y teléfonos en el backend. El formulario no cambia contraseñas, roles ni verificación, y no modifica los datos ya guardados en pedidos anteriores. `PUT /api/auth/me` usa exclusivamente la identidad de la sesión y rechaza campos adicionales.

En administración, escribe **actualizar** para elegir productos, promociones, pedidos o zonas. **Actualizar productos** lista el catálogo activo y permite seleccionar precio y stock; **poner en promoción** pide producto, porcentaje y fecha final en Ecuador. Pedidos y zonas muestran sus registros y datos editables. Proveedores y lotes abren sus formularios específicos. Las órdenes completas que guardan cambios muestran un resumen y requieren **Sí, confirmar**; **No, cancelar** descarta la propuesta. Una orden nueva invalida la anterior. El backend conserva permisos, restricciones sanitarias y controles de versión.

En la tienda, escribe **buscar productos** o **buscar Gel** para elegir producto y cantidad. La mascota pide confirmar antes de agregar, quitar o vaciar el carrito, vuelve a consultar precio y disponibilidad y solicita otra confirmación si cambia el precio. **Comprar** abre el checkout después de confirmar; no crea pedidos ni procesa pagos desde el chat. Las consultas médicas mantienen la derivación al farmacéutico.

Los cambios confirmados usan las mismas APIs que los formularios. La tienda visible recibe avisos del catálogo mediante una conexión compartida de eventos y conserva la recuperación por foco y las consultas periódicas. Los editores abiertos conservan su contenido. El modo Órdenes y ayuda procesa las acciones en la farmacia. El modo voluntario **Preguntar con Gemini** envía la pregunta general al backend para interpretar su tema en español. La farmacia responde con sus datos públicos y el catálogo vigente. Evita incluir datos personales o clínicos. Configura GEMINI_API_KEY en Render y, opcionalmente, GEMINI_MODEL. Si el proveedor falla, se usa la ayuda local.

## Desarrollo y pruebas

Requiere Node.js 22.13 o posterior compatible y las versiones fijadas en package-lock.json. Para probar una extracción NUEVA del proyecto, sin .env ni base existente:

```sh
npm ci --include=dev
npm run setup
npm start
```

Express sirve el frontend y la API en http://localhost:3000. Abre esa dirección para navegar y http://localhost:3000/cuenta.html para iniciar sesión. setup crea un .env privado con JWT_SECRET y contraseña administrativa aleatorios, genera Prisma, aplica migraciones SQLite y carga el catálogo inicial. El acceso inicial acepta ADMIN_USERNAME o ADMIN_EMAIL y la contraseña ADMIN_PASSWORD de ese archivo local. ADMIN_USERNAME define un identificador breve opcional, sin cambiar el correo necesario para verificar cuentas y enviar comprobantes. El registro de la web crea cuentas user; el administrador inicial procede del seed.

Este procedimiento es para una carpeta nueva y SQLite local: no debe ejecutarse con credenciales de producción ni para reemplazar una base existente. El despliegue PostgreSQL utiliza su esquema y variables privadas separados, como explica la [guía de despliegue](docs/DESPLIEGUE-GRATUITO.md). .env.example contiene únicamente ejemplos; los accesos de la web publicada se entregan por separado.

`CUSTOMER_REGISTRATION_REQUIRE_EMAIL` vacío conserva el valor por entorno: en desarrollo permite registrar usuarios sin un proveedor de correo; en producción exige verificación por defecto. No copies una configuración de clase sobre las variables del servicio publicado.

Comandos habituales: npm start, npm run build:frontend, npm run build:pages, npm test, npm run test:reto1 y npm run test:browser. Las pruebas de PostgreSQL requieren un servidor temporal separado. No se prueba con pedidos o pagos comerciales.

Los workflows de verificación se ejecutan manualmente desde Actions. No hay compilaciones automáticas de macOS/iOS, tareas programadas de notificaciones ni despliegues de GitHub Pages. Render permanece Free y con Auto-Deploy Off. [Despliegue](docs/DESPLIEGUE-GRATUITO.md).

## Seguridad y proveedores

La web usa sesiones persistentes revocables, renovación rotatoria, cookies HttpOnly y defensa CSRF. La API se solicita desde el mismo dominio con un proxy fijo de Pages al backend existente. **¿Olvidaste tu contraseña?** envía un enlace de un solo uso y cierra sesiones al cambiar la clave. [Sesiones y recuperación](docs/SESIONES-Y-RECUPERACION.md).

Antes de la migración 019, `setup:production` puede exigir un respaldo lógico de PostgreSQL cifrado con AES-256-GCM en un bucket privado separado. Comprueba su descarga e integridad antes de migrar y detiene el despliegue si falla. La clave permanece en variables privadas; no es un servicio de copias periódicas. [Alcance y recuperación del respaldo](docs/RESPALDO-POSTGRES.md).

No se incluyen claves, contraseñas de acceso, certificados, respaldos ni capturas con sesiones. .env, .publish/ y las salidas de pruebas están excluidos de Git. La administración exige autorización en la API, también cuando una URL se escribe directamente.

Goti procesa órdenes locales del panel y ofrece consultas informativas con Gemini. El seguimiento y el reparto muestran el mapa y la ruta dentro de la web de la farmacia. SRI exige configuración y certificado privados. [Entregas](docs/ENTREGAS-Y-PRIVACIDAD.md) y [seguridad de publicación](docs/SEGURIDAD_DESPLIEGUE.md).

El pago se coordina con la farmacia desde el pedido registrado; elegir un método, pedir un enlace o imprimir el comprobante no acredita el pago. PayPhone permanece desactivado mientras faltan la cuenta comercial y sus credenciales; no se han verificado transacciones reales ni de pruebas contra el proveedor. No se contrataron servicios ni se activaron cobros. [Pagos](docs/PAGOS-Y-PAYPHONE.md).

La ubicación web requiere permiso del usuario y un navegador activo; el seguimiento con la pantalla bloqueada depende del sistema y no está garantizado. Render Free puede suspenderse por inactividad. El Reto 3 sigue pendiente del framework asignado.

### Tres riesgos OWASP y sus mitigaciones

| Riesgo | Mitigación aplicada y evidencia |
| --- | --- |
| Control de acceso deficiente | JWT firmado, expiración, usuario activo y rol comprobados en servidor; autorización de propietario para pedidos y documentos. Un user recibe 403 al crear productos y 401 sin sesión. [Middleware](backend/middleware/auth.cjs), [rutas](backend/routes/index.cjs) y [pruebas de API](tests/reto2/api.test.cjs). |
| Fallos criptográficos | Contraseñas con bcrypt y coste 12; no se devuelven hashes ni se guardan contraseñas en claro. Clave de firma fuera de Git y HTTPS en la publicación. [Autenticación](backend/controllers/auth.cjs) y [configuración](backend/config.cjs). |
| Inyección y XSS | Listas de campos permitidos, validación/sanitización con express-validator, consultas Prisma parametrizadas y salida de texto escapada. Entradas inesperadas producen 422; errores centralizados no exponen stack en producción. [Validación](backend/middleware/validation.cjs), [errores](backend/middleware/errors.cjs) y [vistas](src/views/common.js). |

CORS admite orígenes exactos, sin comodín en producción. Los formularios tienen labels, foco visible y mensajes accesibles; el catálogo, carrito y modales se operan con teclado. Las pruebas de navegador verifican accesibilidad, adaptación móvil y manejo de red/401/403/500. Los permisos no dependen de ocultar botones en la interfaz.

Prisma permanece en 6.19.3. El override acotado de `@prisma/config` a `effect@3.22.1` corrige la [advisory de ReDoS de Effect](https://github.com/Effect-TS/effect/security/advisories/GHSA-7589-6fvf-x4pw), sin cambiar el framework ni añadir dependencias directas. Los resultados de auditoría corresponden a la fecha de ejecución y no garantizan ausencia futura de vulnerabilidades.

La administración de productos incorpora la tabla y el editor de la referencia entregada, PVP, edición parcial con versión y advertencias opcionales. [Productos, APIs y actualización automática](docs/PRODUCTOS-API-Y-ACTUALIZACIONES.md).

## API REST

Las rutas tienen prefijo /api. Las operaciones privadas reciben Authorization: Bearer <JWT>. Salvo el 204 sin contenido, las respuestas usan {ok:true,data:...}; los errores usan {ok:false,error:{code,message,details}}. Las colecciones paginadas devuelven items, total, page y pageSize.

| Método y ruta | Acceso | Resultado normal |
| --- | --- | --- |
| POST /api/auth/register | Público, validado y limitado | 201 en desarrollo sin verificación; 202 pendiente de correo cuando está habilitada, sin entregar JWT |
| POST /api/auth/login | Público, validado y limitado | 200: sesión/JWT y usuario sin hash; con MFA administrativo activo devuelve primero un desafío |
| GET /api/auth/me | Sesión válida | 200: perfil de la sesión |
| POST /api/auth/logout | Sesión válida | 204: revoca la sesión |
| GET /api/productos | Público | 200: catálogo paginado |
| GET /api/productos/:id | Público | 200: producto activo; 404 si no existe |
| POST /api/productos | admin | 201: producto persistido |
| PUT /api/productos/:id | admin | 200: producto actualizado |
| DELETE /api/productos/:id | admin | 204: baja lógica; conserva relaciones históricas |
| POST /api/pedidos | user/admin | 201: pedido y detalles en BD; total/stock calculados en servidor |
| POST /api/pedidos/:id/cancelacion | user/admin propietario | 200: cancelación pendiente/confirmada o reintento seguro; exige esperadoUpdatedAt y conserva conciliación de pagos/facturas |
| GET /api/pedidos/mis-pedidos | user/admin | 200: pedidos del usuario autenticado |
| GET /api/pedidos | admin | 200: todos los pedidos, paginados |
| GET /api/admin/recursos | admin | Descriptores de tablas y columnas autorizadas |
| GET /api/admin/roles | admin | Catálogo paginado de roles reconocidos |
| GET /api/admin/usuarios-roles | admin | Asignaciones vigentes paginadas, con usuarioId y rolId |
| GET /api/admin/tablas/usuario-rol/:id | admin | Rol de una cuenta por su identificador de usuario |
| GET /api/admin/tablas?tabla=productos&page=1&pageSize=10 | admin | 200: consulta paginada de cualquiera de los recursos registrados |
| GET /api/admin/tablas/:tabla/:id | admin | 200: registro autorizado; 404 si no existe |
| POST /api/admin/usuarios | admin | 201: cuenta validada, con rol y usuario opcional |
| GET /api/admin/usuarios/:id | admin | 200: datos editables, sin contraseña ni hash |
| PUT/PATCH /api/admin/usuarios/:id | admin | 200: cambio con esperadoUpdatedAt; 409 ante versión desactualizada |
| DELETE /api/admin/usuarios/:id | admin | 204: baja lógica y cierre de sesiones; protege al último administrador |

El panel permite CRUD de productos, gestión de usuarios y consulta de las 36 tablas mediante **Configuración y datos**. Las tablas de seguridad son de lectura limitada: no publican hashes, secretos MFA, tokens, XML ni certificados. Cada entidad conserva sus operaciones de negocio: los pedidos cambian de estado, el inventario se ajusta con movimientos y las sesiones se revocan.

Los dos esquemas conservan las mismas entidades y relaciones. [Normalización y dependencias funcionales](docs/NORMALIZACION.md). El título y el objetivo del enunciado permiten otro motor relacional: PostgreSQL/Supabase es el motor publicado; SQLite sirve para desarrollo. Se declara esta elección ante la frase interna que menciona únicamente SQL Server.

La web solicita JWT en cookies HttpOnly con `X-Farmacia-Web: 1` y origen autorizado; no expone el token a JavaScript. Clientes API pueden usar `Authorization: Bearer <JWT>`, como en los ejemplos siguientes. Con MFA, el desafío se completa en `/api/auth/mfa/login` antes de obtener acceso.

### Ejemplos de endpoints probados

Estos casos se ejecutan con una base SQLite temporal en [api.test.cjs](tests/reto2/api.test.cjs). Los JWT de los ejemplos son marcadores: no son credenciales de la publicación.

```http
POST /api/auth/login
Content-Type: application/json

{"email":"<ADMIN_EMAIL del fixture>","password":"<ADMIN_PASSWORD del fixture>"}
```

El acceso por `username` se comprueba por separado en [admin-access.test.cjs](tests/reto2/admin-access.test.cjs), que crea un alias sintético. Resultado comprobado: HTTP 200, data.token firmado y data.usuario.role igual a admin, sin passwordHash. Con ese token se prueba:

```http
POST /api/productos
Authorization: Bearer <JWT_ADMIN>
Content-Type: application/json

{"nombre":"Producto de prueba","precio":7.25,"stock":10,"categoria":"bienestar","descripcion":"Producto creado para probar la API","imagen":"assets/images/producto-vitaminas.jpg","alt":"Envase de prueba"}
```

Resultado comprobado: 201 y el registro en BD con stock 10. La misma solicitud con JWT_USER devuelve 403 y sin JWT devuelve 401. GET del producto devuelve 200; PUT con precio 8.50 persiste el cambio y sanitiza el nombre. DELETE devuelve 204 y lo retira del catálogo activo.

La suite también confirma el pedido de un user en BD, sus detalles, el descuento de stock y el acceso del admin a todos los pedidos. [frontend.spec.cjs](tests/reto2/frontend.spec.cjs) evidencia catálogo desde API, carrito persistente, login obligatorio, confirmación/vaciado y panel. [cross-origin.test.cjs](tests/reto2/cross-origin.test.cjs) comprueba CORS y [security-controls.test.cjs](tests/reto2/security-controls.test.cjs) refuerza roles e idempotencia.

Para repetir las comprobaciones de API mínimas, después de instalar dependencias y generar Prisma en la extracción nueva: `node --test tests/reto2/api.test.cjs`. El fixture crea una base temporal separada y no usa pedidos comerciales. Los resultados de cada ejecución se documentan con su fecha y alcance.

## Presentación integrada de los retos 1 y 2

Se revisa un solo proyecto, un repositorio y la misma farmacia publicada. El entregable obligatorio es un único ZIP integrado `Reto2_Olmedo_Elkin.zip`, generado con `powershell -File scripts/crear-reto2.ps1 -Nombre Reto2_Olmedo_Elkin.zip`. Incluye frontend, backend, migraciones, pruebas y documentación; excluye .env, bases, respaldos, certificados y dependencias instaladas. La aplicación MVC conserva y amplía el catálogo, carrito, identidad, accesibilidad y navegación del trabajo inicial, incorporando API, persistencia relacional, autenticación y permisos.

Las [diez auditorías del Reto 2](docs/AUDITORIAS-RETO-2.md) siguen la rúbrica del docente. El [guion de defensa](docs/DEFENSA-RETO-2.md) reúne los enlaces para exponer. Goti es un adelanto del Reto 3. La [guía del recorrido conjunto](docs/RECORRIDO-RETOS-1-Y-2.md) indica qué mostrar como cliente, administrador y repartidor, las órdenes de la mascota y cómo repetir la grabación con `npm run test:journey`. El recorrido usa una base temporal y desactiva correos y cobros comerciales; las capturas y videos se guardan como evidencias locales, fuera del repositorio.

| Contenido | Dónde comprobarlo en el mismo proyecto |
| --- | --- |
| Reto 1: HTML, CSS, JavaScript, adaptación y teclado | Tienda publicada, catálogo, ficha y carrito; pruebas de tests/ |
| Reto 2: MVC, Fetch, CRUD, JWT, roles y Prisma | src/, backend/ y tests/reto2/; administración y compra conectadas a la misma API |
| Identidad y asistentes | Mismo componente animado y atlas para clientes y administración; órdenes de cada rol con confirmación |

Ejecuta npm test para verificar juntos los dos grupos de pruebas con bases temporales; npm run test:browser y la configuración mascot-browser comprueban los recorridos y Chrome/Brave. Los nombres históricos de carpetas y las auditorías se conservan para trazabilidad. El HTML antiguo de raíz documenta la evolución; la aplicación publicada y servida por Express es src/.

La evaluación se hace sobre el código y el sitio completos. Los secretos, bases comerciales, certificados y respaldos privados permanecen fuera del repositorio. El Reto 3 espera el framework asignado; no se cambia la tecnología actual.

## Preparación de la defensa

La [guía de defensa y requisitos](docs/DEFENSA-RETO-2.md) relaciona cada requisito con su implementación y propone un recorrido de cliente, administrador y repartidor. Describe MVC, acceso a datos, Observer, middleware e inyección de dependencias con ejemplos reales del proyecto.

La administración ofrece **Configuración y datos** para seleccionar cualquier tabla, ver sus campos autorizados y abrir su gestión. Productos, precios, stock, promociones, usuarios, tarifas y parámetros fiscales se modifican desde sus formularios. Las variables de infraestructura y los secretos se configuran en el host y se mantienen fuera del navegador.

El acceso con un nombre breve se provisiona una vez sobre el administrador activo configurado por ADMIN_EMAIL. ADMIN_LOGIN_PASSWORD_HASH permite establecer un hash bcrypt privado; el provisionador revoca sus sesiones, audita la operación y evita restablecer la contraseña en despliegues posteriores con la misma configuración. El registro de clientes conserva su política de contraseñas y confirmación de correo.

## Reparto en el navegador

El repartidor dispone de mapa integrado, ruta desde su ubicación, inicio de recorrido, llegada, llamada y confirmación mediante código del comprador. Un único repartidor activo recibe automáticamente los pedidos a domicilio que cumplen sus requisitos. La asignación conserva la validación de pago, preparación y estado.

La captura continua empieza al iniciar el recorrido y requiere GPS autorizado. La ruta se vuelve a calcular con posiciones recientes; un navegador suspendido o un teléfono apagado no envía ubicación. El checkout pasa a retiro cuando no puede localizar el destino y exige confirmar de nuevo.

Los informes, auditorías y guías anteriores se conservan para trazabilidad. Las instrucciones de instalación nativa contenidas en documentos históricos ya no describen la distribución actual.
