# Farmacia Reina del Cisne

Tienda y gestión farmacéutica para Puerto Quito, con catálogo, carrito, pedidos, administración y reparto. Conserva la identidad crema/vino, el logo y las mascotas.

## Abrir la aplicación

- [Tienda](https://farmacia-reyna-del-cisne-pruebas.pages.dev/): catálogo y acceso a **Instalar aplicación** en el pie de página.
- [Administración instalable en Windows](https://farmacia-reyna-del-cisne-pruebas.pages.dev/instalar-admin): Edge/Chrome normal y cuenta de administrador.
- [Entregas](https://farmacia-reyna-del-cisne-pruebas.pages.dev/entregas): requiere cuenta de administrador o repartidor.
- [Pago de pedidos](https://farmacia-reyna-del-cisne-pruebas.pages.dev/pagos): abre un pedido desde **Mis pedidos** para consultar su importe y coordinar el pago con la farmacia.
- [Reparto Android de pruebas](https://farmacia-reyna-del-cisne-pruebas.pages.dev/descargas/reparto-0.1.0.apk).

Los accesos privados se entregan fuera del repositorio. [Instalación de las apps](docs/APPS-E-INSTALACION.md).

## Arquitectura

Tres capas: presentación HTML/CSS/JavaScript, aplicación Node.js/Express y persistencia Prisma 6/PostgreSQL en Supabase. SQLite se utiliza para desarrollo y pruebas.

| Ruta | Uso |
| --- | --- |
| frontend/ | Aplicación MVC publicada, instalación, catálogo y administración |
| server/ | API REST, autenticación JWT, roles y reglas de negocio |
| server/prisma/ | Esquema y migraciones SQLite |
| server/prisma/postgresql/ | Esquema y migraciones PostgreSQL |
| mobile/ | Aplicación nativa independiente de reparto Android/iPhone |
| scripts/ | Generación de vistas, distribución y comprobaciones |
| tests/ | Pruebas con datos sintéticos y bases temporales |
| assets/, js/ y HTML de raíz | Antecedente académico conservado para test:reto1 |

El HTML de frontend/ se genera desde scripts/build-frontend.cjs y scripts/templates/. Cloudflare publica únicamente la salida de scripts/build-pages.cjs; Render mantiene la API existente. [Arquitectura comercial](docs/ARQUITECTURA-COMERCIAL.md).

## Compra, pago y seguimiento

- En el carrito puedes elegir tarjeta, transferencia o pago con la farmacia. Es una preferencia para continuar después de registrar el pedido; no se guarda como un pago ni cambia su estado.
- La pantalla de pago muestra el importe guardado del pedido. Tarjeta permite solicitar un enlace seguro por WhatsApp cuando PayPhone no está habilitado. Transferencia muestra banco, tipo, cuenta y titular configurados por el negocio y permite copiarlos junto al importe y referencia; el envío del comprobante queda pendiente de verificación.
- **Ver comprobante**, disponible en la confirmación y en **Mis pedidos**, abre el resumen imprimible. **Guardar PDF / imprimir** permite elegir **Guardar como PDF** en el navegador. Es un comprobante del pedido sin validez tributaria: no acredita un pago ni sustituye la factura SRI.
- Con el correo habilitado, los pedidos nuevos solicitan automáticamente el envío del comprobante al correo verificado de la cuenta. **Enviar a mi correo** permite reintentarlo; si existe una factura autorizada, envía su XML y representación imprimible. Los envíos siguen desactivados hasta configurar el proveedor y el remitente. La aceptación del proveedor no garantiza recepción en bandeja.
- La confirmación y **Mis pedidos** incluyen una vista de mapa voluntaria. **Ver mapa** utiliza un destino autorizado por el comprador o la ubicación reciente compartida por el repartidor, cuando existen. El seguimiento habitual sigue disponible; los pedidos cerrados no muestran ubicaciones.

La confirmación de correo conserva el backend JWT: enlace de un solo uso, caducidad de una hora y reenvío. En producción se exige confirmar el correo; si el envío está desactivado, el registro se pausa sin crear cuentas ni entregar JWT. Se eligió Brevo gratuito por API HTTPS; Resend sigue siendo compatible. El envío real requiere completar la cuenta, el remitente y las credenciales privadas. La [guía de correo y dominio](docs/CORREO-Y-DOMINIO.md) explica la activación y los pasos separados para un `.com` propio. Los correos usan la identidad de la farmacia e incluyen verificación, comprobante, factura autorizada y aviso de entrega.

Al pulsar **Confirmar y entrar**, el cliente recibe su sesión web y vuelve al catálogo. El JWT se entrega por el POST de confirmación y se conserva en la sesión del navegador, nunca en el enlace. El token de correo se consume una sola vez e invalida las sesiones anteriores; confirmar un correo del personal no entrega una sesión administrativa. El formulario de tarjeta pertenece a PayPhone: aceptar tarjetas reales exige activar la cuenta comercial y guardar tarjetas para compras futuras requiere además autorización de tokenización del proveedor.

## Mascotas y confirmaciones

**Perfil:** clientes, administradores y repartidores pueden editar únicamente su nombre y teléfono desde **Mi cuenta**, el enlace **Perfil** del personal o escribiendo **perfil** en la mascota. Guardar actualiza los datos de la cuenta; cancelar recupera los últimos datos guardados. El correo se muestra para consulta. El formulario no cambia contraseñas, roles ni verificación, y no modifica los datos ya guardados en pedidos anteriores. `PUT /api/auth/me` usa exclusivamente la identidad de la sesión y rechaza campos adicionales.

En administración, escribe **actualizar** para elegir productos, promociones, pedidos o zonas. **Actualizar productos** lista el catálogo activo y permite seleccionar precio y stock; **poner en promoción** pide producto, porcentaje y fecha final en Ecuador. Pedidos y zonas muestran sus registros y datos editables. Proveedores y lotes abren sus formularios específicos. Las órdenes completas que guardan cambios muestran un resumen y requieren **Sí, confirmar**; **No, cancelar** descarta la propuesta. Una orden nueva invalida la anterior. El backend conserva permisos, restricciones sanitarias y controles de versión.

En la tienda, escribe **buscar productos** o **buscar Gel** para elegir producto y cantidad. La mascota pide confirmar antes de agregar, quitar o vaciar el carrito, vuelve a consultar precio y disponibilidad y solicita otra confirmación si cambia el precio. **Comprar** abre el checkout después de confirmar; no crea pedidos ni procesa pagos desde el chat. Las consultas médicas mantienen la derivación al farmacéutico.

Los cambios confirmados usan las mismas APIs que los formularios. La tienda visible se actualiza al recuperar el foco y en sus consultas periódicas de 30 segundos, sin recargar; conserva los formularios abiertos. Los asistentes son locales y de órdenes definidas: no usan servicios externos de IA. La conversación no se guarda.

## Desarrollo y pruebas

Requiere Node.js 22.13 o posterior compatible y las versiones fijadas en package-lock.json. Para probar una extracción NUEVA del proyecto, sin .env ni base existente:

```sh
npm ci --include=dev
npm run setup
npm start
```

Express sirve el frontend y la API en http://localhost:3000. Abre esa dirección para navegar y http://localhost:3000/cuenta.html para iniciar sesión. setup crea un .env privado con JWT_SECRET y contraseña administrativa aleatorios, genera Prisma, aplica migraciones SQLite y carga el catálogo inicial. Consulta ADMIN_EMAIL y ADMIN_PASSWORD en ese archivo local. El registro de la web crea cuentas user; el administrador inicial procede del seed.

Este procedimiento es para una carpeta nueva y SQLite local: no debe ejecutarse con credenciales de producción ni para reemplazar una base existente. El despliegue PostgreSQL utiliza su esquema y variables privadas separados, como explica la [guía de despliegue](docs/DESPLIEGUE-GRATUITO.md). .env.example contiene únicamente ejemplos; los accesos de la web publicada se entregan por separado.

Comandos habituales: npm start, npm run build:frontend, npm run build:pages, npm test, npm run test:reto1 y npm run test:browser. Las pruebas de PostgreSQL requieren un servidor temporal separado. No se prueba con pedidos o pagos comerciales.

Los workflows de verificación se ejecutan manualmente desde Actions. No hay compilaciones automáticas de macOS/iOS, tareas programadas de notificaciones ni despliegues de GitHub Pages. Render permanece Free y con Auto-Deploy Off. [Despliegue](docs/DESPLIEGUE-GRATUITO.md).

## Seguridad y proveedores

No se incluyen claves, contraseñas de acceso, certificados, respaldos ni capturas con sesiones. .env, .publish/ y las salidas de pruebas están excluidos de Git. La administración exige autorización en la API; instalar una app no concede permisos.

Farmi procesa órdenes locales del panel, sin API de IA. El seguimiento abre Maps mediante enlaces o un mapa voluntario. SRI exige configuración y certificado privados. [Entregas](docs/ENTREGAS-Y-PRIVACIDAD.md) y [seguridad de publicación](docs/SEGURIDAD_DESPLIEGUE.md).

El pago se coordina con la farmacia desde el pedido registrado; elegir un método, pedir un enlace o imprimir el comprobante no acredita el pago. PayPhone permanece desactivado mientras faltan la cuenta comercial y sus credenciales; no se han verificado transacciones reales ni de pruebas contra el proveedor. No se contrataron servicios ni se activaron cobros. [Pagos](docs/PAGOS-Y-PAYPHONE.md).

La app nativa de reparto para iPhone requiere firma de Apple y pruebas físicas. Render Free puede suspenderse por inactividad; no acredita disponibilidad 24/7. El Reto 3 sigue pendiente del framework asignado.

### Tres riesgos OWASP y sus mitigaciones

| Riesgo | Mitigación aplicada y evidencia |
| --- | --- |
| Control de acceso deficiente | JWT firmado, expiración, usuario activo y rol comprobados en servidor; autorización de propietario para pedidos y documentos. Un user recibe 403 al crear productos y 401 sin sesión. [Middleware](server/middleware/auth.cjs), [rutas](server/routes/index.cjs) y [pruebas de API](tests/reto2/api.test.cjs). |
| Fallos criptográficos | Contraseñas con bcrypt y coste 12; no se devuelven hashes ni se guardan contraseñas en claro. Clave de firma fuera de Git y HTTPS en la publicación. [Autenticación](server/controllers/auth.cjs) y [configuración](server/config.cjs). |
| Inyección y XSS | Listas de campos permitidos, validación/sanitización con express-validator, consultas Prisma parametrizadas y salida de texto escapada. Entradas inesperadas producen 422; errores centralizados no exponen stack en producción. [Validación](server/middleware/validation.cjs), [errores](server/middleware/errors.cjs) y [vistas](frontend/views/common.js). |

CORS admite orígenes exactos, sin comodín en producción. Los formularios tienen labels, foco visible y mensajes accesibles; el catálogo, carrito y modales se operan con teclado. Las pruebas de navegador verifican accesibilidad, adaptación móvil y manejo de red/401/403/500. Los permisos no dependen de ocultar botones en la interfaz.

## API REST mínima del Reto 2

Las rutas tienen prefijo /api. Las operaciones privadas reciben Authorization: Bearer <JWT>. Salvo el 204 sin contenido, las respuestas usan {ok:true,data:...}; los errores usan {ok:false,error:{code,message,details}}. Las colecciones paginadas devuelven items, total, page y pageSize.

| Método y ruta | Acceso | Resultado normal |
| --- | --- | --- |
| POST /api/auth/register | Público, validado y limitado | 201: usuario user y JWT |
| POST /api/auth/login | Público, validado y limitado | 200: JWT y usuario sin contraseña/hash |
| GET /api/auth/me | Sesión válida | 200: perfil de la sesión |
| POST /api/auth/logout | Sesión válida | 204: revoca la sesión |
| GET /api/productos | Público | 200: catálogo paginado |
| GET /api/productos/:id | Público | 200: producto activo; 404 si no existe |
| POST /api/productos | admin | 201: producto persistido |
| PUT /api/productos/:id | admin | 200: producto actualizado |
| DELETE /api/productos/:id | admin | 204: baja lógica; conserva relaciones históricas |
| POST /api/pedidos | user/admin | 201: pedido y detalles en BD; total/stock calculados en servidor |
| GET /api/pedidos/mis-pedidos | user/admin | 200: pedidos del usuario autenticado |
| GET /api/pedidos | admin | 200: todos los pedidos, paginados |
| GET /api/admin/tablas?tabla=productos | admin | 200: consulta administrativa; también usuarios, pedidos, detalles y promociones |

El panel permite CRUD de productos y consulta de las cuatro tablas mínimas. Las entidades Producto, Usuario, Pedido y PedidoDetalle, sus relaciones, migraciones y seed están en ambos esquemas Prisma. El enunciado permite otro motor relacional: PostgreSQL/Supabase es el motor publicado; SQLite sirve para desarrollo.

### Ejemplos de endpoints probados

Estos casos se ejecutan con una base SQLite temporal en [api.test.cjs](tests/reto2/api.test.cjs). Los JWT de los ejemplos son marcadores: no son credenciales de la publicación.

```http
POST /api/auth/login
Content-Type: application/json

{"email":"<ADMIN_EMAIL del fixture>","password":"<ADMIN_PASSWORD del fixture>"}
```

Resultado comprobado: HTTP 200, data.token firmado y data.usuario.role igual a admin, sin passwordHash. Con ese token se prueba:

```http
POST /api/productos
Authorization: Bearer <JWT_ADMIN>
Content-Type: application/json

{"nombre":"Producto de prueba","precio":7.25,"stock":10,"categoria":"bienestar","descripcion":"Producto creado para probar la API","imagen":"assets/images/producto-vitaminas.jpg","alt":"Envase de prueba"}
```

Resultado comprobado: 201 y el registro en BD con stock 10. La misma solicitud con JWT_USER devuelve 403 y sin JWT devuelve 401. GET del producto devuelve 200; PUT con precio 8.50 persiste el cambio y sanitiza el nombre. DELETE devuelve 204 y lo retira del catálogo activo.

La suite también confirma el pedido de un user en BD, sus detalles, el descuento de stock y el acceso del admin a todos los pedidos. [frontend.spec.cjs](tests/reto2/frontend.spec.cjs) evidencia catálogo desde API, carrito persistente, login obligatorio, confirmación/vaciado y panel. [cross-origin.test.cjs](tests/reto2/cross-origin.test.cjs) comprueba CORS y [security-controls.test.cjs](tests/reto2/security-controls.test.cjs) refuerza roles e idempotencia.

Para repetir las 26 comprobaciones de API mínimas, después de instalar dependencias y generar Prisma en la extracción nueva: node --test tests/reto2/api.test.cjs. El fixture crea una base temporal separada y no usa pedidos comerciales. La última ejecución local aprobó 26/26, sin omisiones.

## Entrega académica

La entrega se nombra Reto2_Apellido_Nombre.zip e incluye fuente versionada, frontend/backend MVC, esquemas, migraciones, seed, pruebas, .env.example y este README. En un checkout Git limpio puede generarse sin historial ni archivos privados con:

```sh
git archive --format=zip --prefix=Farmacia-Reyna-del-Cisne/ --output=entrega/Reto2_Apellido_Nombre.zip HEAD
```

Crea antes la carpeta entrega si no existe. El archivo se obtiene del commit indicado: confirma tus cambios antes de generarlo. Los node_modules, .env, bases, certificados y respaldos privados no pertenecen a Git ni a la entrega. El código móvil se incluye como ampliación opcional; pagos reales, GPS continuo, firma iPhone y el framework del Reto 3 no son requisitos obligatorios del Reto 2.

## Evidencias

[Pruebas y publicación actuales](docs/APPS-INSTALABLES-2026-11-01.md). El material auxiliar y los informes históricos retirados tienen respaldo local privado del propietario; las mascotas activas y el código de negocio se conservan.
