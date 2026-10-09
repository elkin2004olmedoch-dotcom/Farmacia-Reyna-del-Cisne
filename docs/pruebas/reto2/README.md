# Evidencias del Reto 2

Las pruebas se ejecutan contra SQLite real con las migraciones y el seed de entrega. Cada ejecución usa una BD temporal separada de `server/prisma/farmacia.db`; no prueba un mock de persistencia ni modifica datos personales de trabajo.

## Reproducir

```powershell
npm ci
npm run setup
npm test
npm run test:browser
npm audit
```

`api.test.cjs`: autenticación/roles, CRUD, precios, pedidos/detalles, stock, versiones, transiciones/historial, cancelación concurrente, idempotencia, descuentos, migración antigua, CORS, errores y seed. `resources.test.cjs`: MVC, archivos/imports y configuración segura. `uploadbackup.test.cjs`: imágenes, límites, respaldo consistente, SHA-256, restauración, retención y servidor activo. `frontend.spec.cjs`: compra, panel ERP, roles, conexión entre pantallas, imágenes, descuentos, estados y accesibilidad en escritorio/móvil.

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
| Cuerpo excesivo | 413 | General 32 KB; parser de imágenes autorizado 3 MB y archivo binario máximo 2 MB |
| Token expirado/revocado | 401 | Revocación efectiva tras logout |

## Resultado final observado

- [Pruebas Node](node-tests.txt): 37 aprobadas, cero fallos.
- [Pruebas Chrome](browser-tests.txt): 14 aprobadas, cero fallos; 1440 y 375 px.
- [npm audit](npm-audit.json): cero vulnerabilidades reportadas.
- [Resumen de ejecución](resumen.json): los tres comandos terminaron con código cero.
- [Portada](capturas/inicio.png), [catálogo escritorio](capturas/catalogo.png) y [catálogo móvil](capturas/catalogo-movil.png): catálogo de trabajo de 18 referencias, sin credenciales ni tokens en pantalla.
- [Dashboard ERP](capturas/admin.png), [dashboard móvil](capturas/admin-movil.png) y [tabla de productos](capturas/admin-productos.png): datos sintéticos de la BD aislada de pruebas, navegación por áreas y estilo crema/vino.
- [Catálogo con promoción, escritorio](capturas/catalogo-promocion-escritorio.png) y [móvil](capturas/catalogo-promocion-movil.png): franja amarilla, porcentaje, precio original y precio descontado.
- [Detalle con promoción, escritorio](capturas/detalle-promocion-escritorio.png) y [móvil](capturas/detalle-promocion-movil.png): imagen subida y precio efectivo del producto.
- [Administración de estados, escritorio](capturas/administracion-estados-escritorio.png) y [móvil](capturas/administracion-estados-movil.png): diálogo de gestión e historial del pedido.

Para regenerar las salidas ejecuta `npm run verify`. Las credenciales de tests corresponden a bases temporales y no son las claves aleatorias del administrador de trabajo. La API y el navegador no usan datos personales reales en esas pruebas.

## Instalación desde la entrega

El ZIP se inspeccionó para verificar cinco auditorías, frontend/backend MVC, tres migraciones, seed, README, lockfile y .env.example. No contenía archivos .env privados, SQLite, respaldos, imágenes personales subidas, claves ni certificados. Se extrajo en una carpeta de comprobación dentro de .publish y se ejecutaron npm ci y npm run setup. Se verificaron catálogo, login admin, panel ERP, selectores de imagen, porcentaje, historial/estados y resumen protegido por HTTP. Las tres migraciones quedaron aplicadas, los nuevos campos/defaults y las claves foráneas fueron correctos; subir imágenes y cambiar estados sin sesión devolvió 401 sin modificar la base. La copia inicial devolvió 18 productos activos y seis meses de tendencia. [Resultado de la copia limpia](zip-verificado.json).

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

`npm run backup` permite una copia manual; fuera de test el servidor respalda al arrancar y cada 24 horas activo. Restaurar exige detenerlo y ejecutar `npm run backup:restore -- --from "carpeta-del-respaldo" --offline`; añadir `--replace` solo si se pretende sustituir una base existente. Las copias son privadas y locales, sin cifrado, firma digital ni almacenamiento externo. SHA-256 comprueba coherencia con el manifiesto, no autenticidad por sí mismo. No se ejecutó una restauración destructiva de la base personal para estas pruebas.

Las actualizaciones son consultas HTTP al volver a la pestaña y cada 30 segundos mientras está visible. Formularios administrativos abiertos y cantidades en edición pausan el refresco correspondiente. No se afirma actualización instantánea entre navegadores ni cobertura de todos los fallos posibles.
