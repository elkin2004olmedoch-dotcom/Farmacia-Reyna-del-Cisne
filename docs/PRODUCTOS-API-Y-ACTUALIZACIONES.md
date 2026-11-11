# Productos, APIs y actualizaciones

La administración de productos adopta la organización de la referencia entregada en `zzz`. Reutiliza la aplicación MVC existente y presenta ID, nombre, categoría, PVP y acciones, con contador, paginación y editor. Conserva los colores, los logos, Goti y los campos farmacéuticos.

## Producto y base de datos

`Producto.precio` sigue siendo el precio canónico en USD y se presenta como PVP en administración. Los identificadores existentes conservan sus relaciones con pedidos, lotes, movimientos, favoritos y reseñas.

`advertencias` admite texto opcional de hasta 1000 caracteres. El administrador puede guardarlo o retirarlo. La ficha muestra el apartado cuando tiene contenido. La API valida y normaliza el texto y la vista escapa su salida. El contenido debe proceder de la información del producto registrada por la farmacia.

La migración `202611100016_product_api_sync` añade el campo, la versión de promociones y dos tablas técnicas.

| Tabla | Finalidad |
| --- | --- |
| RegistroPendiente | Continuación temporal de un registro que espera confirmar el correo. Guarda el hash del permiso, su vencimiento y la sesión consumida. |
| RevisionCatalogo | Revisión opaca del catálogo, modificada por triggers dentro de la misma transacción de los datos públicos. |

Ambos esquemas conservan Prisma 6. Las migraciones son específicas de SQLite y PostgreSQL. PostgreSQL activa RLS en las dos tablas nuevas. El importador descarta permisos temporales y conserva el marcador técnico del destino. Restaurar un respaldo invalida las continuaciones de registro y las sesiones.

## Contratos REST

Las respuestas conservan el formato `{ok,data}` y los errores `{ok:false,error}`. Las listas administrativas están paginadas y limitadas a 100 registros por petición. La interfaz de productos muestra 20 por página.

| Recurso | Lectura | Escrituras y permisos |
| --- | --- | --- |
| Productos | GET `/api/productos`, GET `/api/productos/:id` públicos | POST, PUT, PATCH y DELETE lógico en `/api/productos`; administrador |
| Proveedores | GET colección y GET `/api/admin/proveedores/:id`; administrador | POST, PUT, PATCH y DELETE lógico; administrador |
| Promociones | GET `/api/promociones` público; GET `/api/admin/promociones/:id` privado | POST, PUT, PATCH y DELETE; administrador |
| Pedidos | Listados propios y listado administrativo | Creación, cancelación propia y transiciones de estado verificadas en el backend |
| Inventario | Lotes y movimientos privados | Ingreso de lotes y ajustes transaccionales con trazabilidad |
| Cuenta | Perfil, direcciones, favoritos, recompra y reseñas | Propietario autenticado, validación y condiciones de compra verificadas |
| Entregas y pagos | Consultas autorizadas por rol y propietario | Asignación, estados, GPS, incidencias, tarifas y operaciones de pago mediante sus servicios existentes |

PATCH exige `esperadoUpdatedAt`, al menos un campo editable y una lista exacta de campos permitidos. Valida el estado resultante, conserva los valores omitidos y devuelve 409 ante una versión desactualizada. «Guardar solo cambios» utiliza este contrato. «Guardar producto» conserva PUT completo. PUT de proveedores y promociones admite una versión opcional y mantiene el comportamiento previo para sus clientes existentes.

Las sesiones, verificaciones, historiales, auditoría y emisión fiscal se gestionan mediante operaciones específicas del negocio. Sus permisos se comprueban en el servidor.

## Actualización del catálogo

GET `/api/actualizaciones` transmite una revisión opaca mediante Server-Sent Events. Los triggers observan productos, promociones, lotes, configuración fiscal, cobertura y reseñas. Una transacción revertida conserva su revisión anterior. El canal público carece de nombres, correos, pedidos, posiciones y credenciales.

El servidor comparte una lectura del marcador por segundo mientras tiene clientes conectados. Cada documento comparte una conexión entre sus secciones. Al ocultarse la página se desconecta. Las conexiones duran 45 segundos y se recuperan con espera creciente si falla la red. La primera revisión revalida los datos iniciales para cubrir cambios ocurridos durante la conexión. Una revisión repetida conserva el resultado actual.

El cliente conserva la consulta periódica y la recuperación por foco para los cambios dependientes del tiempo, las vistas privadas y las interrupciones del canal. Los editores abiertos conservan su contenido y recuperan la actualización pendiente al cerrarse.

Los tiempos incluyen la red, las consultas y el renderizado. Render Free puede suspenderse por inactividad y necesita arrancar nuevamente. Las mediciones distinguen laboratorio y publicación.

## Confirmación de correo

Un registro web nuevo recibe una cookie HttpOnly/Secure/SameSite=Strict y un marcador opaco que permanece en la memoria del formulario. La cuenta y el permiso temporal se crean en una transacción. El servidor guarda únicamente el hash del permiso, con vencimiento de una hora.

El panel visible comprueba cada dos segundos POST `/api/auth/registro-pendiente`, con protección de origen y cabecera web. Al confirmar el enlace desde otro navegador o dispositivo, el panel original puede iniciar su propia sesión y continuar a su destino. El consumo se comprueba contra usuario, correo, rol, versión, época, caducidad y sesión vigente. Un reintento de respuesta perdida reutiliza la sesión durante 60 segundos. Una cuenta distinta que ya tenga sesión conserva su acceso.

El formulario abandona la comprobación al cerrarse y evita consultas simultáneas. Recargar la página pierde el marcador en memoria y permite continuar con el inicio de sesión habitual. El enlace de correo mantiene su confirmación explícita y uso único.

## Secciones y referencias para consulta

El registro compartido de `frontend/models/catalog-sections.js` define las 16 secciones y conserva los códigos `bienestar`, `cuidado` y `bebe`. El recurso `GET /api/productos/filtros` añade `categorias` con identificador, nombre, descripción, imagen y total de referencias activas. `GET /api/productos?categoria=<identificador>` combina la sección con búsqueda, laboratorio, presentación, orden y paginación. Los totales incluyen las fichas para consulta.

La migración `202611100017_catalog_sections` añade `Producto.soloConsulta` con valor predeterminado `false` en ambos motores. Las 48 referencias nuevas se incorporan con `soloConsulta=true` y valores técnicos cero de precio y stock. La tienda muestra **Consultar precio y disponibilidad**. El carrito, Goti, favoritos, comparación y recompra respetan el estado. La creación de pedidos devuelve `409 PRODUCT_CONSULTATION_ONLY` antes de reservar existencias o registrar un pago. Las campañas y los avisos de stock bajo aplican sus filtros correspondientes.

Para habilitar una referencia, administración registra precio positivo y existencias, completa los datos farmacéuticos exigidos por el tipo de producto y desactiva **Solo consulta**. Las restricciones de receta, control, biológicos y conservación se comprueban por separado. La edición mantiene el control de versión. Un producto histórico con precio cero conserva sus datos y permite actualizar campos descriptivos. Su compra continúa sujeta a un precio comercial válido.

`data/catalogo-ampliado.json` contiene las referencias y sus reclasificaciones iniciales. `data/fuentes-catalogo-ampliado.json` documenta las fuentes, las fotografías y sus hashes. Los medicamentos seleccionados incluyen registro, principio activo, concentración y referencia al listado ecuatoriano de venta libre. Las presentaciones regionales, el envase anterior de TENA y las diferencias de referencia de FUTURO se identifican en el manifiesto. [Listado OTC de ARCSA](https://www.controlsanitario.gob.ec/wp-content/plugins/download-monitor/download.php?force=1&id=15468).

`scripts/sync-catalog.cjs` aplica la ampliación una sola vez mediante el marcador `catalogo-secciones-v1`, dentro de una transacción serializable. Incorpora identificadores nuevos y reclasifica únicamente registros cuyo nombre y categoría coinciden con los antecedentes documentados, con versión monotónica. Los precios y cantidades existentes se conservan. Los reintentos recuperan la operación completa y las ediciones posteriores conservan su prioridad. La carga espera el marcador del catálogo inicial cuando la base está pendiente de importar.

`npm run setup` y `npm run setup:production` ejecutan esa sincronización después de las migraciones. El flujo de producción conserva `SKIP_INITIAL_SEED=true` para la base existente. Las pruebas verifican la incorporación de 48 referencias sobre 18 iniciales, repetición, concurrencia, reversión, activación y preservación de cambios en SQLite y PostgreSQL temporales.

## Verificación reproducible

Las suites utilizan bases temporales y datos sintéticos. Se añadieron regresiones para PATCH, permisos, CSRF, versiones concurrentes, fechas omitidas, advertencias, migración histórica, IVA vigente, importación, restauración, continuación de registro y actualización visible entre sesiones independientes.

Las pruebas PostgreSQL son opt-in y comprueban una instancia de loopback separada. Las pruebas de Pages ejercitan PATCH y transmisión del canal a través del worker real generado. Las mediciones esperan las peticiones finitas e identifican el canal de eventos como conexión persistente.
