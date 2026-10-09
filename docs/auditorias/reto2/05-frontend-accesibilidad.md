# Punto 5 — Frontend funcional y accesibilidad

## Objetivo y método

Comprobar que la interfaz usa la API y completa el flujo catálogo → carrito → login → pedido → historial y administración, con pantallas abiertas conectadas a los cambios persistidos. La validación anterior ejecutó Chrome en 1440×1000 y 375×900, pruebas de errores y axe-core sobre las nueve pantallas. La suite ampliada pasó sus 14 casos de navegador; la suite Node actual ya pasó 23 pruebas. Se conservaron la fachada, identidad crema/vino, categorías, mapa, WhatsApp y las 18 referencias del catálogo.

## Matriz de subpuntos

| Requisito | Implementación | Evidencia de navegador | Resultado |
|---|---|---|---|
| 5.1 Catálogo API | Model catalog con Fetch/async-await hacia GET productos | Búsqueda solar y tarjetas visibles | Implementado |
| 5.1 Tarjetas reutilizables | productCard en views/products.js para portada y catálogo | Cuatro destacados y listado general | Implementado |
| 5.1 Agregar al carrito | Acciones delegadas del controlador y validación de stock | Contador y selección aumentan | Implementado |
| 5.2 Agregar/quitar/aumentar/disminuir | Modelo cart y controlador checkout | Botones +/−, input, diálogo Quitar/Cancelar | Implementado |
| 5.2 Subtotal/total | Suma en centavos para vista; total definitivo recalculado en servidor | Cantidades y resumen consistentes | Implementado |
| 5.2 localStorage | IDs y cantidades con lectura defensiva | Recarga conserva carrito | Implementado |
| 5.2 Extra sessionStorage | JWT temporal, comparación y clave de reintento | Sesión y selección de comparación | Implementado |
| 5.3 Login obligatorio | Mensaje accesible y redirección al acceso; POST protegido | Invitado redirigido; API sin JWT 401 | Implementado |
| 5.4 Checkout API | POST pedidos con carrito, comprador y clave única | Pedido confirmado y recuperable por API | Implementado |
| 5.4 Vaciar/confirmar | Vacía solo después del éxito de servidor | Carrito cero y confirmación con ID | Implementado |
| 5.5 Admin productos | Lista paginada, creación, edición, eliminación por API | CRUD completo en ambos tamaños | Implementado |
| 5.5 Todas las tablas | Productos, Usuarios, Pedidos, Detalles y Promociones | Selector y consultas con admin | Implementado |
| 5.5 Solo admin | Enlace y contenido por rol, más autorización backend | User ve denegación y recibe 403 | Implementado |
| Separación cliente/admin | Cabecera, menú móvil, pie y secciones administrativas propios; login y rutas por rol | Admin sin carrito ni Mis pedidos, cliente conserva checkout/historial, logout | Implementado |
| Dashboard ERP | Barra lateral por áreas, ocho métricas de API, alertas, accesos rápidos, estados, tendencia y pedidos recientes | Datos del resumen coinciden con tarjetas; CRUD desde acceso rápido; 500/Reintentar y 401 | Implementado |
| Conexión de pantallas abiertas | Actualización al foco/visibilidad, cada 30 s y señal entre pestañas; API única | Caso ampliado con administrador y cliente en contextos independientes | Implementado y verificado en escritorio/móvil |
| Edición y compra concurrentes | Editor manda versión; checkout bloquea productos retirados/cantidades sin stock | Prueba API 409 sin restaurar unidades; nuevo flujo visual conserva datos de entrega | API y navegador verificados |

## Campañas y otras pantallas

Promociones pasó de datos estáticos a entidad de BD. Admin crea, edita y elimina campañas; decide publicación, vista previa, orden y vigencia. El cliente muestra solo campañas activas del servidor. Las campañas iniciales siguen identificadas como vista previa y no anuncian descuentos reales.

Las nueve páginas son inicio, catálogo, ficha, comparación, cuenta, checkout, pedidos, administrador y ayuda. Los componentes de comparación reutilizan los productos de la API. Contacto valida datos ecuatorianos y prepara un mensaje para que el usuario lo revise antes de enviarlo por WhatsApp.

El administrador entra directamente en el Dashboard ejecutivo al iniciar sesión. El diseño toma como referencia el ERP aportado: sidebar fija por áreas, topbar, tarjetas y tablas a todo el ancho, con colores crema/vino. Productos y Promociones ofrecen CRUD; Pedidos de clientes, Usuarios y Detalles son consultas de gestión. Ofrece Ver tienda y Cerrar sesión. Los enlaces ?tabla= seleccionan únicamente las cinco secciones permitidas; la ruta sin tabla muestra el resumen. La sesión admin redirige cuenta/checkout al dashboard e historial a todos los pedidos; las acciones de compra se ocultan en la tienda pública. El contrato de roles de la API de pedidos se mantiene según la rúbrica.

El dashboard obtiene ocho indicadores de /api/admin/resumen y muestra alertas de stock menor o igual a cinco, accesos a creación/gestión, pedidos por estado, una gráfica SVG de seis meses y los últimos cinco pedidos. La gráfica tiene título y descripción textual con todos los importes/cantidades; los períodos sin pedidos muestran cero. Se presentan importes de pedidos registrados, no ventas cobradas. Campos dinámicos se escapan. El estado de error ofrece Reintentar y no reemplaza cifras con ejemplos. Se mantienen solo las funciones actuales, según la elección del usuario.

Pruebas de separación: login admin incluso con next=checkout, enlaces de promociones, sección inválida, selector de las cinco tablas, redirecciones de cuenta/checkout/historial, controles de compra ocultos después de filtrar catálogo y en ficha, logout y acceso admin anónimo. El flujo cliente continúa probando registro, compra real, historial privado y denegación administrativa. Axe revisa las ocho pantallas comerciales con cliente y el panel con admin.

Correcciones verificadas en el panel: las solicitudes de tabla conservan su sección/página y solo la respuesta más reciente actualiza la vista; las acciones antiguas se eliminan y los botones de creación/paginación se bloquean durante carga. Un 401 limpia el área de gestión, cierra diálogos y menú, elimina la sesión y redirige al login administrativo. Las pruebas retienen una respuesta de Productos mientras cargan Promociones y simulan expiración durante edición.

La misma prueba incluye dos aperturas retrasadas del editor de promociones. La secuencia de apertura conserva juntos la campaña mostrada y el ID enviado al guardar, descartando respuestas antiguas y cambios de sección. Si tras un conflicto 409 del checkout falla la consulta del catálogo, el error se anuncia y se conservan carrito y formulario, sin dejar el fallo de red fuera del manejo de errores.

## Conexión de datos y conservación del trabajo

`controllers/updates.js` consulta nuevamente la API al recuperar el foco o volver visible la página, cada 30 segundos si está visible y cuando recibe una señal de cambios. Evita peticiones simultáneas del mismo refresco, agrupa avisos pendientes y retira listeners al salir de la página. Los cambios exitosos del modelo API publican `data:changed`; otras pestañas del mismo origen reciben una marca UUID en localStorage. Los contextos separados del navegador consultan los cambios por foco o por el intervalo, sin compartir sesiones.

Los controladores comparan los datos recibidos con los mostrados. Si no cambiaron, no reemplazan el DOM. Si cambiaron, actualizan la región de tarjetas, promociones, tabla, resumen o pedidos, conservando el foco equivalente sin desplazar la página. Búsqueda, categoría y orden del catálogo permanecen intactos. Comparación conserva los productos seleccionados que siguen disponibles. El detalle conserva la cantidad y usa handlers delegados; añadir al carrito consulta primero la ficha actual y valida el stock recibido.

El modelo de carrito escucha `storage`, por lo que un cambio en otra pestaña actualiza contador, líneas y total. El carrito continúa siendo una selección del navegador, no un pedido confirmado ni una sesión autenticada. Checkout conserva los campos del comprador y de entrega durante un refresco; pospone la consulta mientras se edita la cantidad, hay un diálogo o el pedido está enviándose. Un producto retirado o una cantidad mayor al stock se muestran como problema y deshabilitan continuar/confirmar; se puede reducir o quitar la línea sin perder las otras selecciones. El servidor sigue validando el stock de forma transaccional.

El panel refresca silenciosamente el dashboard o la sección/página actual, sin volver a cargar filtros ni abrir formularios. No aplica refrescos mientras existe un diálogo abierto, y solicita los datos al cerrarlo. Cada edición de producto guarda la versión de apertura y envía `esperadoUpdatedAt`: una compra u otra edición intermedia devuelve 409 y conserva el formulario para que el administrador revise el conflicto. Historial muestra el estado recibido, en lugar de etiquetar todos los pedidos como pendientes.

El nuevo caso `administración y cliente comparten datos persistidos y actualizan pantallas abiertas` comprueba cambios de producto y promoción desde un administrador, lectura desde cliente, conservación de filtros y formulario, compra persistida, stock y consultas del panel. Sus ejecuciones de escritorio y móvil forman parte de los 14 casos de navegador aprobados. Las pruebas Node aprobadas verifican además que los datos siguen conectados al abrir una nueva conexión Prisma y que repetir seed no restaura campañas eliminadas.

## Accesibilidad obligatoria

| Criterio | Control y comprobación |
|---|---|
| HTML5 semántico | Header, nav, main, section y footer; idioma es; jerarquía de títulos |
| Teclado | Salto al contenido; Tab/Enter; drawer móvil con foco inicial, recorrido limitado y contenido cubierto inert; Escape/fondo restauran foco; diálogos nativos |
| Foco visible | Contorno de tres píxeles; foco inicial y restauración en confirmación |
| Labels | Label asociado por ID; instrucciones y errores por aria-describedby |
| Componentes dinámicos | Role status/alert, aria-live, aria-expanded, aria-controls y diálogos nombrados |
| Contraste | Paleta crema/vino y contraste automático WCAG A/AA en nueve páginas, dashboard y tablas Productos/Pedidos |
| Responsive | Sin desbordamiento de página en escritorio/móvil; las tablas grandes tienen scroll propio accesible |

Axe se ejecuta con etiquetas WCAG 2 A/AA y 2.1 A/AA. No sustituye una evaluación completa con lectores de pantalla, usuarios con discapacidad o una certificación WCAG.

## Errores y estados

Estados visibles: carga, catálogo sin resultados, carrito vacío, tabla vacía, falta de stock, formulario inválido, sesión vencida y error de servidor/conexión. Una respuesta de red o 500 no se reemplaza silenciosamente por productos locales ficticios. El token se elimina ante 401; 403 muestra la denegación; los conflictos 409 conservan el carrito y permiten revisar disponibilidad.

## Hallazgos y cierre

- Cerrado: compra como invitado de la versión estática; ahora exige sesión en UI y servidor.
- Cerrado: panel solo visual; ahora consume CRUD protegido y muestra tablas de BD.
- Cerrado: confusión de formato monetario en prueba; se verifica formato es-EC con USD y coma decimal.
- Cerrado: controles de confirmación mezclaban eventos y renderizado; evento close movido a controller/dialog.js.
- Cerrado: las campañas cambiaban de un caso de prueba a otro; el flujo prueba también su eliminación, dejando datos de prueba consistentes.
- Implementado: catálogo, promociones, stock, pedidos y dashboard se actualizan desde la API en pantallas abiertas; la verificación ampliada pasó en escritorio y móvil.
- Cerrado en API: una edición administrativa antigua podía restaurar stock vendido; el control de versión devuelve 409 sin sobrescribirlo.
- Implementado: carrito entre pestañas, bloqueo visual de cantidades sin stock y estado real del historial; la verificación ampliada pasó en escritorio y móvil.

## Límites

El mapa, redes y WhatsApp requieren conexión. No se activa un modo de compra offline: los precios y stock se consultan al servidor. No se envían mensajes automáticamente. Los pedidos iniciales tienen estado pendiente y el pago se coordina con la farmacia; una confirmación en pantalla representa un registro persistido, no un cobro bancario.

El refresco usa consultas HTTP periódicas, no WebSocket ni actualización instantánea garantizada: otras sesiones reciben cambios al volver a la página o en el siguiente intervalo visible. Ante un fallo transitorio se conserva la última información recibida del servidor y se anuncia el error; no se crean datos de ejemplo. Las 14 ejecuciones de la suite ampliada aprobaron el flujo funcional y las comprobaciones de accesibilidad previstas.
