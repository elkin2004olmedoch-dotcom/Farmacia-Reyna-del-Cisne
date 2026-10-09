# Punto 5 — Frontend funcional y accesibilidad

## Objetivo y método

Comprobar que la interfaz usa la API y completa el flujo catálogo → carrito → login → pedido → historial y administración. Se ejecutó Chrome en 1440×1000 y 375×900, pruebas de errores y axe-core sobre las nueve pantallas. Se conservaron la fachada, identidad crema/vino, categorías, mapa, WhatsApp y las 18 referencias del catálogo.

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

## Campañas y otras pantallas

Promociones pasó de datos estáticos a entidad de BD. Admin crea, edita y elimina campañas; decide publicación, vista previa, orden y vigencia. El cliente muestra solo campañas activas del servidor. Las campañas iniciales siguen identificadas como vista previa y no anuncian descuentos reales.

Las nueve páginas son inicio, catálogo, ficha, comparación, cuenta, checkout, pedidos, administrador y ayuda. Los componentes de comparación reutilizan los productos de la API. Contacto valida datos ecuatorianos y prepara un mensaje para que el usuario lo revise antes de enviarlo por WhatsApp.

El administrador entra directamente en el Dashboard ejecutivo al iniciar sesión. El diseño toma como referencia el ERP aportado: sidebar fija por áreas, topbar, tarjetas y tablas a todo el ancho, con colores crema/vino. Productos y Promociones ofrecen CRUD; Pedidos de clientes, Usuarios y Detalles son consultas de gestión. Ofrece Ver tienda y Cerrar sesión. Los enlaces ?tabla= seleccionan únicamente las cinco secciones permitidas; la ruta sin tabla muestra el resumen. La sesión admin redirige cuenta/checkout al dashboard e historial a todos los pedidos; las acciones de compra se ocultan en la tienda pública. El contrato de roles de la API de pedidos se mantiene según la rúbrica.

El dashboard obtiene ocho indicadores de /api/admin/resumen y muestra alertas de stock menor o igual a cinco, accesos a creación/gestión, pedidos por estado, una gráfica SVG de seis meses y los últimos cinco pedidos. La gráfica tiene título y descripción textual con todos los importes/cantidades; los períodos sin pedidos muestran cero. Se presentan importes de pedidos registrados, no ventas cobradas. Campos dinámicos se escapan. El estado de error ofrece Reintentar y no reemplaza cifras con ejemplos. Se mantienen solo las funciones actuales, según la elección del usuario.

Pruebas de separación: login admin incluso con next=checkout, enlaces de promociones, sección inválida, selector de las cinco tablas, redirecciones de cuenta/checkout/historial, controles de compra ocultos después de filtrar catálogo y en ficha, logout y acceso admin anónimo. El flujo cliente continúa probando registro, compra real, historial privado y denegación administrativa. Axe revisa las ocho pantallas comerciales con cliente y el panel con admin.

Correcciones verificadas en el panel: las solicitudes de tabla conservan su sección/página y solo la respuesta más reciente actualiza la vista; las acciones antiguas se eliminan y los botones de creación/paginación se bloquean durante carga. Un 401 limpia el área de gestión, cierra diálogos y menú, elimina la sesión y redirige al login administrativo. Las pruebas retienen una respuesta de Productos mientras cargan Promociones y simulan expiración durante edición.

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

## Límites

El mapa, redes y WhatsApp requieren conexión. No se activa un modo de compra offline: los precios y stock se consultan al servidor. No se envían mensajes automáticamente. Los pedidos iniciales tienen estado pendiente y el pago se coordina con la farmacia; una confirmación en pantalla representa un registro persistido, no un cobro bancario.
