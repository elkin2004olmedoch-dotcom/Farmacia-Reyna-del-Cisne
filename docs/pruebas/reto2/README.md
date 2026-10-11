# Evidencias del Reto 2

Las pruebas de API y navegador se ejecutan contra SQLite real con las migraciones y el seed de entrega, en una BD temporal separada de `server/prisma/farmacia.db`. Las pruebas adicionales repetibles de nube usan un servidor HTTP de almacenamiento simulado y clientes de importación simulados. Separadamente se hizo una transferencia y una comprobación puntual contra PostgreSQL y Storage reales de Supabase, con credenciales privadas excluidas de las evidencias.

## Reproducir

```powershell
npm ci
npm run setup
npm test
npm run test:browser
npm audit
```

`api.test.cjs`: autenticación/roles, CRUD, precios, pedidos/detalles, stock, versiones, transiciones/historial, cancelación concurrente, idempotencia, descuentos, migración antigua, CORS, errores y seed. `resources.test.cjs`: MVC, archivos/imports y configuración segura. `uploadbackup.test.cjs`: imágenes, límites, respaldo consistente, SHA-256, restauración, retención y servidor activo. `frontend.spec.cjs`: compra, panel ERP, roles, conexión entre pantallas, imágenes, descuentos, estados y accesibilidad en escritorio/móvil.

`order-tracking.spec.cjs`: cuatro etapas con iconos SVG, cancelación sin entrega ficticia, fechas en Ecuador, axe y 320/375/768/1920 px. Cambia estados por la API administrativa en la BD temporal y comprueba que el cliente los recibe con un reloj de cinco segundos, sin recargar ni enviar eventos de foco. Verifica historial desplegado, foco conservado y consulta de factura retenida. No modifica pedidos reales ni conecta WhatsApp.

## Resultados HTTP comprobados

| Solicitud | Respuesta observada | Comprobación adicional |
|---|---|---|
| Login admin | 200, token JWT | Firma, issuer, audience y exp verificados; no se publica token |
| Registro user válido | 201 | Hash bcrypt coste 12 en BD; cédula no persistida |
| Registro con role=admin | 422 | No se crea administrador |
| Crear producto admin | 201 | Registro consultado por Prisma |
| Crear producto user | 403 | Rol aplicado por backend |
| Crear producto sin token | 401 | Sesión obligatoria |
| Editar producto admin | 200 | Precio nuevo persistido y texto sanitizado |
| Editor antiguo tras compra u otra edición | 409 PRODUCT_CHANGED | Stock y precio actuales no se sobrescriben |
| Catálogo/ficha | 200 | Datos visibles en frontend |
| Confirmar pedido user | 201 | Cabecera/detalles en BD y stock reducido |
| Repetir confirmación idéntica | 200 | Mismo ID y stock sin segundo descuento |
| Misma clave con otro contenido | 409 | Se rechaza duplicación inconsistente |
| Stock insuficiente | 409 | Reversión de todas las líneas |
| Dos compras sobre una unidad | 201 y 409 | Una venta, stock final cero |
| Mis pedidos | 200 | Usuario ajeno no ve los pedidos |
| Todos los pedidos, user | 403 | Acceso reservado a admin |
| Todos los pedidos/tablas, admin | 200 | Cinco tablas consultables, sin hashes |
| Campaña admin publicada | 201, GET público 200 | Creación/edición/eliminación también probadas en navegador |
| Campaña futura | GET 200 sin la campaña | Vigencia aplicada por servidor |
| Campaña vigente 25% sobre USD 7,50 (API) | Catálogo/ficha USD 5,63; pedido de tres USD 16,89 | Mayor descuento elegible; sin sumar campañas ni descontar vistas previas |
| Cambiar campaña/precio después de comprar | GET histórico mantiene importe y descuento | Snapshot y reintento idempotente conservados |
| Cambiar estado admin | 200 | Secuencia permitida, updatedAt e historial con actor |
| Cambiar estado user/sin token | 403 / 401 | Gestión reservada a administrador |
| Versión de pedido vencida o salto inválido | 409 | Sin cambiar estado ni stock |
| Dos cancelaciones del mismo pedido | 200 y 200 (una repetida) | Una reposición de unidades y un evento de cancelación |
| Reabrir estado final | No admite otra transición | Entregado/cancelado terminal; historial conservado |
| Subir JPEG/PNG/WebP admin | 201 WebP UUID | Decodificación, recodificación sin metadatos y ruta local |
| Subir archivo user/sin token | 403 / 401 antes del parser grande | Autorización efectiva |
| SVG/formato falso/ruta/base64/dimensiones | 422 | Validación independiente del navegador |
| Quitar imagen propia de campaña | PUT con imagen/alt null y GET 200 | BD guarda null y la vista usa imagen del producto |
| Eliminar producto admin | 204 | Historial conserva precio y nombre |
| Origen CORS no permitido | 403 | Sin Access-Control-Allow-Origin |
| JSON inválido | 400 | Sin stacktrace |
| Cuerpo excesivo | 413 | General 32 KB; parsers de imágenes/certificados autorizados 3 MiB y archivo binario máximo 2 MiB |
| Token expirado/revocado | 401 | Revocación efectiva tras logout |

## Resultado final observado

- [Pruebas Node](node-tests.txt): 133 aprobadas, cero fallos.
- [Pruebas Chrome](browser-tests.txt): 36 aprobadas, cero fallos; escritorio/móvil y controles adicionales en 320, 768 y 1920 px.
- [npm audit](npm-audit.json): cero vulnerabilidades reportadas.
- [Resumen de ejecución](resumen.json): los tres comandos terminaron con código cero.
- [Portada](capturas/inicio.png), [catálogo escritorio](capturas/catalogo.png) y [catálogo móvil](capturas/catalogo-movil.png): catálogo de trabajo de 18 referencias, sin credenciales ni tokens en pantalla.
- [Dashboard ERP](capturas/admin.png), [dashboard móvil](capturas/admin-movil.png) y [tabla de productos](capturas/admin-productos.png): datos sintéticos de la BD aislada de pruebas, navegación por áreas y estilo crema/vino.
- [Catálogo con promoción, escritorio](capturas/catalogo-promocion-escritorio.png) y [móvil](capturas/catalogo-promocion-movil.png): franja amarilla, porcentaje, precio original y precio descontado.
- [Detalle con promoción, escritorio](capturas/detalle-promocion-escritorio.png) y [móvil](capturas/detalle-promocion-movil.png): imagen subida y precio efectivo del producto.
- [Administración de estados, escritorio](capturas/administracion-estados-escritorio.png) y [móvil](capturas/administracion-estados-movil.png): diálogo de gestión e historial del pedido.
- [Seguimiento de pedido, escritorio](capturas/seguimiento-pedidos-preparado-escritorio.png) y [móvil](capturas/seguimiento-pedidos-preparado-movil.png): iconos de pendiente, confirmado, preparado y entregado; datos sintéticos.
- [Cancelación, escritorio](capturas/seguimiento-pedidos-cancelado-escritorio.png) y [móvil](capturas/seguimiento-pedidos-cancelado-movil.png): etapas alcanzadas y aviso de cancelación, sin marcar entrega. Las capturas de componentes ocultan el encabezado fijo únicamente durante la captura, para evitar que cubra la tarjeta al desplazarla; conservan las dimensiones reales.

Para regenerar las salidas ejecuta `npm run verify`. Las credenciales de tests corresponden a bases temporales y no son las claves aleatorias del administrador de trabajo. La API y el navegador no usan datos personales reales en esas pruebas.

## Preparación de despliegue gratuito

`production.test.cjs` cubre variables privadas, SSL, origen HTTPS, selección del cliente/namespace Prisma y seed con cliente PostgreSQL. `cloudimages.test.cjs` y `cloudroutes.test.cjs` cubren autorización, conversión WebP, subida, redirección pública, imágenes inexistentes, límites, timeout, CSP y errores sin credenciales. `cloudmigration.test.cjs` comprueba importación repetible, conflictos, conservación de IDs/hashes/pedidos y preparación de imágenes mediante clientes simulados.

El schema PostgreSQL y la migración se validaron/generaron con Prisma. Un entorno temporal sin cliente SQLite generado comprobó el cliente PostgreSQL, `Decimal`, precio descontado y aislamiento `Serializable` sin abrir una BD. Las 34 pruebas del antecedente estático también pasan, incluidos el inicio de sesión con almacenamiento bloqueado y el enlace Pages hacia el servicio público. [Alcance de nube](nube.json).

En la etapa inicial de conexión de Supabase: se aplicaron las migraciones, se comprobó RLS en las ocho tablas sin políticas públicas y se importaron un administrador, 18 productos, dos promociones, una semilla y una foto. Las siete tablas coinciden fila por fila con la fuente y la foto conserva SHA-256. Antes del despliegue público, la API ejecutada desde el equipo pasó 17 comprobaciones contra PostgreSQL/Storage reales. Sus registros e imagen sintéticos también fueron retirados. Ese recorrido previo se distingue de las comprobaciones públicas descritas a continuación. [Detalle sin secretos](nube.json).

El servicio público [Render Free](https://farmacia-reina-del-cisne.onrender.com/) respondió correctamente a 16 comprobaciones de API: salud PostgreSQL, login administrador conservado, resumen ERP, registro/login cliente, permisos separados, imagen en Storage, edición pública, promoción/descuento, pedido, stock y cancelación repetida. En el navegador real se verificaron las sesiones separadas, el pedido cancelado y una imagen PNG azul elegida desde el panel, convertida a WebP y visible en la ficha del cliente; el precio original USD 14 mostró USD 10,50 con 25 % de promoción. Esos datos eran sintéticos. Un despliegue manual y un reinicio del servicio conservaron las cuentas, campaña, pedido e imágenes; seis comprobaciones posteriores al reinicio compararon filas, hashes, login de ambos roles y ficha/historial. Después se retiraron solo los registros y dos fotos sintéticos y se confirmó otra vez la igualdad de las siete tablas originales y la foto trasladada. Pages tiene activado el origen público. [Portada publicada](capturas/nube-inicio.jpg), [dashboard con datos originales](capturas/nube-admin.jpg) y [detalle sin secretos](nube.json). Estas comprobaciones puntuales no garantizan disponibilidad continua.

La publicación del commit `230322d` terminó correctamente en los dos workflows de GitHub Pages. Un navegador abrió [la ficha original de GitHub](https://elkin2004olmedoch-dotcom.github.io/Farmacia-Reyna-del-Cisne/producto.html?id=alcohol-antiseptico) y llegó a la misma ficha en Render conservando el identificador; mostró precio USD 2,01, stock 600 y la foto original cargada. [Captura del resultado](capturas/nube-pages-producto.jpg). La cuenta pública utiliza ese mismo servicio; las cuentas nuevas se registran allí.

## Instalación desde la entrega

La entrega provisional se extrajo de forma segura en una carpeta privada nueva. Allí se ejecutaron npm ci y npm run setup: seis migraciones y quince modelos, con datos exclusivamente sintéticos. Pasaron 19 comprobaciones de catálogo, autenticación, IVA, PVP/descuento, proveedores/lotes/FEFO, compra y centavos, reconexión, permisos SRI, borrador/RIDE sin validez y bloqueo de emisión sin firma. Se actualizaron los dos controladores corregidos de foco y se recompiló esa copia antes de comprobar las nueve pantallas. La entrega final se regenera con esos mismos controladores, informes aprobados y documentación actualizada. Excluye datos personales, .env privados, BD, respaldos, claves y certificados P12/PFX/PEM/KEY. [Resultado de la instalación limpia](zip-verificado.json).


## HTTPS de desarrollo

Se generó certificado local self-signed y se inició `npm run start:https`. GET `https://localhost:3443/api/salud` respondió 200 con `{ok:true,data:{estado:"disponible"}}`. El cliente automatizado ignoró la confianza únicamente para esa comprobación local del certificado self-signed; no se desactivó la validación TLS de la aplicación ni de producción.

## Alcance de accesibilidad

Axe con etiquetas WCAG 2 A/AA y 2.1 A/AA en nueve pantallas y dos tamaños: ocho comerciales con cliente y panel con admin. Se incluyen editor de imágenes, diálogo de estados, catálogo con descuento y ficha con precio original/efectivo. Pruebas de salto al contenido, menús con Tab/Enter/Escape, foco y diálogos. Las tablas grandes tienen scroll propio. Esta evidencia no constituye certificación WCAG ni prueba con todos los lectores de pantalla.

## Separación de roles en la interfaz

El login de admin llega directamente al Dashboard ejecutivo de /admin.html aunque el destino solicitado sea checkout. El panel no contiene carrito, búsqueda de compras, comparación ni Mis pedidos. La navegación de promociones y el selector sincronizan sección/título; una sección desconocida vuelve a Productos. Las rutas de cuenta/checkout de admin llevan al dashboard y /pedidos.html abre Pedidos de clientes. En la tienda, los controles de compra de admin permanecen ocultos al filtrar y abrir fichas. Logout elimina la sesión y el acceso anónimo al panel solicita credenciales administrativas. El cliente conserva el recorrido de compra e historial y no puede abrir el área de gestión. Una respuesta de Productos retenida hasta después de Promociones se descarta; mientras carga no quedan acciones antiguas disponibles. Un 401 durante una edición cierra el diálogo, limpia el área y solicita nuevo login. Estas comprobaciones forman parte de los catorce casos Chrome.

## Dashboard ERP

Pruebas de API/modelo: acceso admin 200, invitado 401 y cliente 403; datos del snapshot; centavos sin errores de coma flotante; seis meses incluyendo meses sin pedidos; cambio diciembre/enero Ecuador; campañas activas/inactivas y fechas límite; productos activos/inactivos y stocks cero/cinco/seis; máximo diez alertas y cinco recientes; resumen vacío. Pruebas Chrome: ocho tarjetas coinciden con datos de API, gráfica con título/descripción accesibles, alerta del producto creado con cinco unidades, enlaces de Nuevo producto/Nueva promoción abren editores reales, error 500 sin cifras ficticias y reintento, 401 elimina sesión y redirige. El menú móvil enfoca su primer enlace y Tab permanece en menú/cierre; el contenido cubierto es inert y se rehabilita al cerrar con fondo/Escape. Axe incluye dashboard, tabla de productos y tabla de pedidos en ambos tamaños.

## Conexión entre administrador y cliente

El séptimo recorrido se ejecuta dos veces, en escritorio y móvil, con contextos independientes. Mantiene páginas abiertas antes de los cambios y comprueba datos del servidor, sin usar respuestas simuladas en ese recorrido.

| Flujo | Verificación observada |
|---|---|
| Registro cliente → Usuarios | Correo de la nueva cuenta aparece en el panel abierto al recuperar foco |
| Crear/editar producto → catálogo | Nombre, precio y stock actualizados conservando URL y filtro de búsqueda |
| Crear/editar campaña → portada | Publicación y descripción llegan a la portada abierta por foco/visibilidad |
| Subir imagen → producto/campaña | WebP local persistido, vista previa y visualización del cliente después de guardar |
| Quitar imagen propia → fallback | Campo null persistido y portada reutiliza imagen del producto |
| Promoción real → compra | Navegador: 25% sobre USD 7,50 muestra USD 5,63 en catálogo/ficha/carrito y registra una unidad por USD 5,63 |
| Refresco periódico | Reloj del navegador avanza 30 segundos y muestra el stock nuevo sin recargar ni enviar foco |
| Carrito entre pestañas | Conteo y vaciado de la compra se reflejan en las otras pestañas del cliente; no pasan a la sesión admin |
| Stock insuficiente → checkout | Cantidad de dos con stock uno bloquea Continuar/Confirmar y conserva los datos de entrega |
| Compra → gestión | Pedido, detalles, importe, stock reducido y métricas del dashboard coinciden con API |
| Estado administrativo → cliente | Confirmado/preparado/entregado o cancelado llegan a Mis pedidos con historial |
| Cancelación → inventario | Stock repuesto una sola vez, incluso en dos peticiones simultáneas; estado final persistido |
| Editor abierto durante una compra | Los campos no se reinician; guardado obsoleto devuelve 409 y no restaura stock vendido |
| Reabrir editor | Stock y precio actuales se cargan después de cerrar el formulario obsoleto |
| Historial y persistencia | Recarga conserva el pedido; otro PrismaClient recupera usuario, producto, campaña, pedido, detalles y stock |
| Seed repetido/base anterior | Conserva promociones borradas, ediciones, usuarios, hashes y stock; no duplica registros |

La prueba de respuestas atrasadas también retrasa la primera de dos aperturas de promociones: el formulario y la URL de guardado siguen perteneciendo a la segunda campaña elegida.

La prueba Node de descuento registra tres unidades a USD 5,63 y comprueba total USD 16,89, además de conservar el snapshot tras cambiar la campaña. El recorrido de navegador registra una unidad por USD 5,63; son comprobaciones distintas del mismo precio efectivo.

Mientras se guarda un registro o estado se bloquean Guardar, Cancelar y Escape hasta terminar la solicitud; no puede cerrarse y abrirse otra edición para que la respuesta anterior descarte ese trabajo nuevo. Producto/promoción bloquean también los campos, archivo, reset de imagen y porcentaje durante PUT; el diálogo de estado bloquea su selector y no admite envíos duplicados. Durante la carga de imagen se anuncia progreso y se bloquea guardar; cerrar o escoger otra imagen invalida la respuesta antigua. El reset de imagen de promoción se probó en API y navegador: persiste imagen/alt null y recupera la imagen del producto.

La base de trabajo se respaldó de forma privada antes de aplicar la migración aditiva `202610090002_seed_marker`. Se verificó integridad SQLite y la misma huella SHA-256 de los registros de las cinco entidades comerciales antes/después de migrar y ejecutar seed. La BD personal y su respaldo permanecen excluidos de Git y ZIP.

La migración `202610090003_commerce` se probó primero sobre datos anteriores en una base aislada. Conservó IDs, claves de idempotencia, totales, cantidades y precios; inicializó updatedAt desde createdAt y el precio original de detalles desde su snapshot. Luego se aplicó en la base de trabajo con otra copia privada y verificación de integridad: SHA-256 de los campos originales de Producto, Usuario, Pedido, PedidoDetalle y Promocion se mantuvo idéntico. No se inventaron eventos de estado anteriores ni se publicaron datos de la base real.

## Imágenes y respaldo/restauración

Las pruebas de subida cubren autorización antes del parser grande, firmas y formatos reales, base64 válido, JPEG/PNG/WebP sin animación, 2 MB binarios, límite JSON propio y dimensiones/píxeles. Comprueban WebP con nombre UUID, eliminación de metadatos y ruta local existente. SVG, formatos simulados, rutas ajenas, exceso de bytes o dimensiones se rechazan.

El respaldo usa `VACUUM INTO` para una SQLite consistente y copia imágenes referidas por productos/campañas. El manifiesto guarda tamaños y SHA-256; se comprueban integridad y claves foráneas. La prueba restaura en otra base temporal y recupera usuarios/hash/tokenVersion, pedidos/detalles/historial, claves de reintento e imágenes. La BD fuente no se modifica. También se probaron archivo alterado, rutas ajenas, servidor registrado activo, reemplazo con respaldo previo y retención de siete copias; restaurar la más antigua no borra su origen antes de terminar.

La prueba de recuperación de destino corrupto valida primero el respaldo fuente. Si el destino presenta corrupción SQLite identificada y no permite una copia consistente, conserva sus bytes originales en una carpeta privada `recovery-<fecha>-<uuid>`, incluidos DB y WAL/SHM existentes, con tamaños y SHA-256. Su manifiesto la identifica como recuperación forense, no como respaldo restaurable; no se poda automáticamente. Solo después se publica la base válida. Si falla esa conservación, se aborta sin reemplazar el destino; errores de permisos o espacio no activan una recuperación genérica. La prueba comprueba igualdad byte por byte y la recuperación posterior, sin destruir datos de trabajo reales.

`npm run backup` permite una copia manual de SQLite; fuera de test, en modo SQLite, el servidor respalda al arrancar y cada 24 horas activo. Restaurar exige detenerlo y ejecutar `npm run backup:restore -- --from "carpeta-del-respaldo" --offline`; añadir `--replace` solo si se pretende sustituir una base existente. Las copias son privadas y locales, sin cifrado, firma digital ni almacenamiento externo. SHA-256 comprueba coherencia con el manifiesto, no autenticidad por sí mismo. No se ejecutó una restauración destructiva de la base personal para estas pruebas.

Las actualizaciones son consultas HTTP al volver a la pestaña y cada 30 segundos mientras está visible, con un intervalo de cinco segundos en Mis pedidos. Formularios administrativos abiertos y cantidades en edición pausan el refresco correspondiente. No se afirma actualización instantánea entre navegadores ni cobertura de todos los fallos posibles.

## Ampliación fiscal, farmacéutica y SRI

La ejecución final completa aprobó 133 pruebas Node y 36 de navegador, con cero vulnerabilidades de dependencias. Incluye el cierre de sesión administrativa mientras hay un editor abierto, sin errores de foco. Fiscal/inventario prueba restricciones SQL/API, descuentos 85/86, IVA con vigencias, centavos mixtos, PVP, lotes vencidos, reservas FEFO y reposición única. SRI prueba XML contra XSD, firma criptográfica con tres referencias, P12 sintético, cifrado, secuencias/idempotencia, respuestas SOAP simuladas, permisos y descarga. No equivale a autorización ante el SRI.

[Administración fiscal en escritorio](capturas/admin-fiscal-escritorio.png), [móvil](capturas/admin-fiscal-movil.png), [detalle por teclado](capturas/cliente-detalle-accesible-escritorio.png) y [borrador SRI sintético](capturas/facturacion-borrador-escritorio.png) documentan las vistas aisladas de prueba.

Las migraciones reales preservaron todos los registros originales de ambas instalaciones. Se conservan [paridad local](ampliacion-local.json), [paridad de nube y RLS de las 16 tablas](ampliacion-nube.json) y [ocho restricciones de PostgreSQL real](restricciones-postgresql.json). No se publican copias, filas privadas ni credenciales.

La aplicación del commit `39aee06` quedó Live en Render Free y ambos procesos de GitHub Pages finalizaron correctamente. Pasaron 15 comprobaciones de API pública sin mutaciones comerciales: acceso conservado, IVA, campos farmacéuticos, imagen con el mismo SHA-256, módulos administrativos, permisos SRI y OpenSSL. En navegador se comprobó el dashboard, [IVA publicado](capturas/nube-iva-administrador.png), [SRI sin emisor/firma](capturas/nube-sri-pendiente.png) y el enlace original de Pages hacia la ficha con foto, precio y stock conservados y nota de IVA. [API pública](ampliacion-publicada.json) y [despliegue/interfaz](ampliacion-despliegue.json). No se agregaron datos tributarios del propietario ni se emitió una factura real; esa conexión se hará posteriormente.
