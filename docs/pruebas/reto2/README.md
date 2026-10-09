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

`api.test.cjs`: login admin, registro bcrypt, user 403, CRUD, pedido con detalles, stock, concurrencia, idempotencia, aislamiento de historial, campañas, CORS, errores y revocación. `resources.test.cjs`: estructura MVC, archivos/imports y configuración segura. `frontend.spec.cjs`: compra, administración con navegación propia, login/redirecciones por rol, logout, errores y accesibilidad en escritorio y móvil.

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
| Eliminar producto admin | 204 | Historial conserva precio y nombre |
| Origen CORS no permitido | 403 | Sin Access-Control-Allow-Origin |
| JSON inválido | 400 | Sin stacktrace |
| Cuerpo excesivo | 413 | Límite de 32 KB |
| Token expirado/revocado | 401 | Revocación efectiva tras logout |

## Resultado final observado

- [Pruebas Node](node-tests.txt): 23 aprobadas, cero fallos.
- [Pruebas Chrome](browser-tests.txt): 14 aprobadas, cero fallos; 1440 y 375 px.
- [npm audit](npm-audit.json): cero vulnerabilidades reportadas.
- [Resumen de ejecución](resumen.json): los tres comandos terminaron con código cero.
- [Portada](capturas/inicio.png), [catálogo escritorio](capturas/catalogo.png) y [catálogo móvil](capturas/catalogo-movil.png): catálogo de trabajo de 18 referencias, sin credenciales ni tokens en pantalla.
- [Dashboard ERP](capturas/admin.png), [dashboard móvil](capturas/admin-movil.png) y [tabla de productos](capturas/admin-productos.png): datos sintéticos de la BD aislada de pruebas, navegación por áreas y estilo crema/vino.

Para regenerar las salidas ejecuta `npm run verify`. Las credenciales de tests corresponden a bases temporales y no son las claves aleatorias del administrador de trabajo. La API y el navegador no usan datos personales reales en esas pruebas.

## Instalación desde la entrega

El ZIP se inspeccionó para verificar cinco auditorías, frontend/backend MVC, migración, seed, README, lockfile y .env.example. No contenía archivos .env privados, SQLite, claves ni certificados. Se extrajo en una carpeta de comprobación dentro de .publish, se ejecutaron npm ci y npm run setup y se verificaron catálogo, login admin, panel ERP y resumen protegido por HTTP. La copia inicial devolvió 18 productos activos y seis meses de tendencia. [Resultado de la copia limpia](zip-verificado.json).

## HTTPS de desarrollo

Se generó certificado local self-signed y se inició `npm run start:https`. GET `https://localhost:3443/api/salud` respondió 200 con `{ok:true,data:{estado:"disponible"}}`. El cliente automatizado ignoró la confianza únicamente para esa comprobación local del certificado self-signed; no se desactivó la validación TLS de la aplicación ni de producción.

## Alcance de accesibilidad

Axe con etiquetas WCAG 2 A/AA y 2.1 A/AA en nueve pantallas y dos tamaños: ocho pantallas comerciales con cuenta cliente y panel administrativo con cuenta admin. Pruebas de salto al contenido, menú de tienda y de administración con Tab/Enter/Escape, foco y diálogos. Las tablas grandes usan región con scroll propio. Esta evidencia no constituye certificación WCAG ni prueba con todos los lectores de pantalla.

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
| Refresco periódico | Reloj del navegador avanza 30 segundos y muestra el stock nuevo sin recargar ni enviar foco |
| Carrito entre pestañas | Conteo y vaciado de la compra se reflejan en las otras pestañas del cliente; no pasan a la sesión admin |
| Stock insuficiente → checkout | Cantidad de dos con stock uno bloquea Continuar/Confirmar y conserva los datos de entrega |
| Compra → gestión | Pedido, detalles, importe, stock reducido y métricas del dashboard coinciden con API |
| Editor abierto durante una compra | Los campos no se reinician; guardado obsoleto devuelve 409 y no restaura stock vendido |
| Reabrir editor | Stock y precio actuales se cargan después de cerrar el formulario obsoleto |
| Historial y persistencia | Recarga conserva el pedido; otro PrismaClient recupera usuario, producto, campaña, pedido, detalles y stock |
| Seed repetido/base anterior | Conserva promociones borradas, ediciones, usuarios, hashes y stock; no duplica registros |

La prueba de respuestas atrasadas también retrasa la primera de dos aperturas de promociones: el formulario y la URL de guardado siguen perteneciendo a la segunda campaña elegida.

La base de trabajo se respaldó de forma privada antes de aplicar la migración aditiva `202610090002_seed_marker`. Se verificó integridad SQLite y la misma huella SHA-256 de los registros de las cinco entidades comerciales antes/después de migrar y ejecutar seed. La BD personal y su respaldo permanecen excluidos de Git y ZIP.

Las actualizaciones son consultas HTTP al volver a la pestaña y cada 30 segundos mientras está visible. Formularios administrativos abiertos y cantidades en edición pausan el refresco correspondiente. No se afirma actualización instantánea entre navegadores ni cobertura de todos los fallos posibles.
