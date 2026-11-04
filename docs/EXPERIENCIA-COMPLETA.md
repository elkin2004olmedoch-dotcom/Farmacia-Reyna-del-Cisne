# Experiencia completa de compra y entrega

## Diseño y alcance

El titular pidió completar y publicar los ocho puntos de catálogo, búsqueda, ficha, cuenta, seguimiento, mascota visual, rendimiento y confianza. Se conserva la implementación MVC con HTML/CSS/JavaScript, Express y Prisma 6, la identidad crema/vino/rojo, logos y Goti. Las referencias actuales son 18 productos comerciales documentados; una foto o referencia seleccionada no acredita existencias físicas ni certificaciones sanitarias no proporcionadas.

Se amplían los módulos actuales, compartiendo las APIs y validaciones de compra. Rehacer el frontend o usar almacenamiento local como única persistencia duplicaría reglas o perdería datos entre dispositivos. No se añaden frameworks ni dependencias. Las funciones nuevas de cuenta y reseñas pertenecen al servidor; el chat propone y confirma acciones con las mismas APIs.

### Cuenta y confianza

- Direcciones privadas por cuenta: alias, provincia, cantón, dirección y código postal opcional. Crear, editar, seleccionar en checkout y eliminar con confirmación; no modifica direcciones históricas de pedidos. Máximo diez direcciones, validación ecuatoriana y control de versión al editar.
- Favoritos persistentes por usuario/producto, únicos e idempotentes. Botones accesibles y vista en Mi cuenta; al volver a comprar se consulta de nuevo disponibilidad y precio.
- Volver a comprar muestra una propuesta con los precios actuales y los productos no disponibles o restringidos. Requiere confirmación para añadir al carrito; no crea pedidos ni cambia el historial. Sólo se consulta un pedido propio y no se aceptan precios del cliente.
- Reseñas de 1 a 5 y comentario de hasta 800 caracteres: sólo una por usuario/producto y con detalle de compra propia entregada. No se inventan opiniones. El público ve nombre abreviado, puntuación, fecha y «Compra verificada», nunca correo, teléfono ni identificador del pedido. El autor puede editar o retirar su reseña; toda elegibilidad y propiedad se validan en servidor. Los formularios avisan que no se incluyan datos personales ni médicos.

### Seguimiento

- Mantener el mapa dentro de la web, permiso voluntario, roles y retirada del GPS al cerrar. Los estados siguen sujetos a versiones y validación de preparación/asignación.
- Estimación calculada con una ruta real desde GPS reciente del repartidor al destino, con ventana y hora de cálculo. No se inventa una hora antes de disponer de datos. Se identifica como estimación, sin prometer tráfico en tiempo real. Se invalida si los datos caducan y se señala retraso cuando se supera la ventana.
- Incidencias de retraso, dirección, ausencia, avería u otro, notificadas por el administrador o repartidor asignado; estado abierta/resuelta y fecha visibles para el comprador. No exponen comentarios internos ni nuevos datos de contacto.
- Nuevas entregas requieren código de seis dígitos para cerrarse. Se deriva con HMAC usando el secreto del servidor y un nonce aleatorio; no se guarda texto plano. Sólo el comprador puede consultar su código; se limita y bloquea la verificación tras intentos erróneos. El código no sale en DTO del personal, logs ni listados públicos. Los registros históricos conservan el comportamiento previo hasta su finalización. La vía administrativa de estado de pedido no debe eludir el control de una nueva entrega activa.

### Mascota

Reutilizar el widget animado. Selección de productos mediante tarjetas con foto, nombre, presentación y precio; las confirmaciones siguen siendo obligatorias. Mostrar resumen vigente del carrito/pedido propio cuando se solicite. Al confirmar una orden administrativa, ofrecer un enlace fijo al registro modificado. Los enlaces sólo aceptan rutas internas e identificadores validados, nunca direcciones arbitrarias del texto del usuario. El repartidor conserva ayuda de sus propias entregas.

### Catálogo y rendimiento

Mantener búsquedas paginadas de 24, filtros y coincidencias aproximadas identificadas. Las imágenes reales incluyen dimensiones y carga diferida donde corresponde. Medir antes/después en escritorio y móvil, con API/base temporal y una consulta pública sin escrituras; registrar TTFB, LCP, CLS, interacciones y recursos bajo perfiles explícitos. No confundir medidas de laboratorio con percentiles de usuarios reales ni arranques en frío. Optimizar sólo cuellos de botella demostrados y generar un informe reproducible.

## Persistencia y seguridad

Se añaden DireccionGuardada, Favorito, ResenaProducto y EntregaIncidencia y campos opcionales de estimación/código en Entrega. No se eliminan tablas, columnas ni registros existentes. Ambos proveedores reciben migraciones equivalentes; PostgreSQL añade RLS sin acceso anónimo directo y permisos compatibles con el backend existente. Índices por propietario/fecha, unicidad de favorito/reseña y relaciones usadas por consulta; las migraciones se comprueban sobre bases temporales antes del despliegue autorizado.

Los cambios usan el PrismaClient compartido, transacciones cortas, listas de campos admitidos, permisos comprobados en backend y las cookies/CSRF existentes. Ninguna prueba crea cuentas, pedidos, correos, reseñas ni cobros reales en producción. Render conserva Free; PayPhone comercial, dominio y pruebas físicas de teléfonos no se sustituyen por simulaciones ni se certifican como resueltos por este trabajo.

## Aceptación

1. Catálogo actual completo y recursos válidos; filtros, búsquedas, teclado y ficha conservados.
2. Cuenta: direcciones, favoritos y recompra persisten, aíslan propietarios y revalidan precio/stock/restricciones.
3. Entrega: ruta real con GPS sintético, ventana con procedencia, retraso/incidencia y cierre con código comprobado; no se filtran códigos ni se elude el cierre.
4. Mascota: imágenes, resumen y enlaces internos; confirmar/cancelar, cambios de precio y sesión vencida comprobados.
5. Reseñas: una compra no entregada u otro propietario no puede publicar; media y lista sólo de compras verificadas y sin datos privados.
6. Mediciones móviles reproducibles antes/después, sin afirmar rendimiento de campo ni disponibilidad 24/7 del plan gratuito.
7. Pruebas generales, SQLite/PostgreSQL temporales, Chrome/Brave y móvil, accesibilidad/teclado, recorrido de roles, revisión independiente y publicación del mismo commit en ambos destinos.

## Uso funcional

1. En Mi cuenta, guarda una dirección con un alias de hasta 40 caracteres. En la compra, seleccionarla rellena la dirección y vuelve a comprobar cobertura; elegirla no confirma un pedido.
2. Pulsa Guardar en favoritos desde catálogo o ficha. Los productos aparecen en Mi cuenta, incluso desde otro dispositivo con la misma cuenta.
3. En Mis pedidos, pulsa Volver a comprar. Revisa diferencias de precio, artículos retirados, restricciones y existencias; confirmar sólo modifica el carrito. Si algo cambia mientras revisas, se pide otra confirmación.
4. Cuando recibas una compra, abre la ficha para puntuarla. Las reseñas muestran Compra verificada y nombre abreviado. Puedes editar o retirar tu propia reseña; no publiques información médica ni personal.
5. Durante un reparto, abre el seguimiento de tu pedido. La estimación depende de GPS compartido reciente y una ruta por calles; una ventana vencida se identifica como tal. Las incidencias del recorrido se muestran con su resolución.
6. Al recibir físicamente el pedido, comunica al repartidor los seis dígitos del seguimiento. El personal no puede consultarlos por su cuenta. Cinco códigos incorrectos bloquean los intentos durante quince minutos. Las entregas anteriores a esta ampliación conservan el flujo histórico.
7. En Goti, busca productos, consulta mi carrito o mis pedidos. La selección y compra mantienen sus confirmaciones. En administración, Ver registro abre el registro de la orden completada.

## Medición y pruebas reproducibles

`node scripts/measure-mobile.cjs etiqueta` utiliza una API y SQLite temporales; `--frontend-root ruta` permite comparar una copia pública anterior. `--public` mide únicamente la farmacia publicada, en un navegador aislado sin cuentas ni pedidos. Registra recursos, TTFB, LCP previo a interacción, CLS por ventanas y la duración máxima observada de interacciones. El perfil móvil emula 390 × 844, CPU cuatro veces más lenta y red de 10 Mbps/80 ms. Estas medidas de laboratorio no son INP ni percentiles de tráfico real. [Definiciones de las métricas](https://web.dev/articles/defining-core-web-vitals-thresholds).

Las dos fotografías PNG más pesadas conservan sus originales y referencias; la presentación usa variantes WebP sin pérdida. Las pruebas comparan dimensiones y todos los píxeles visibles. La carga inicial de catálogo/ficha reserva espacio; el atlas animado se descarga con prioridad baja y el favicon usa el icono pequeño de la marca ya existente.

Pruebas relevantes: customer-account-api/session/cart, reviews-api, delivery-progress/view, companion-cards e image-optimization; sus equivalentes de navegador comprueban escritorio/móvil, teclado y accesibilidad. postgres-experience comprueba las nuevas APIs, restricciones e índices en PostgreSQL temporal; postgres-delivery mantiene la regresión comercial. La aplicación de reparto 0.4.0 solicita el código y comparte el diálogo accesible con la web; compilar Android o copiar recursos de iOS no sustituye pruebas físicas ni firma de Apple.
