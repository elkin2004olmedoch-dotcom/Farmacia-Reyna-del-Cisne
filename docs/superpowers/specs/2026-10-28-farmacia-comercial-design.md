# Farmacia comercial: tres capas, entregas y seguimiento

Solicitud del propietario del 28 de octubre de 2026: ampliar la aplicación existente, conservar identidad y tecnologías, usar Supabase y los servicios existentes, incorporar entregas y seguimiento, mejorar estructura comercial y permitir operaciones administrativas mediante Farmi. Autoriza ejecutar el trabajo y las conexiones existentes. Cobertura confirmada: todo Puerto Quito; pueblos aledaños son ampliación futura. El administrador fijará y modificará la tarifa después de coordinar con los repartidores; no se ha proporcionado un importe inicial.

## Enfoque y arquitectura

Se conserva el monolito modular MVC y sus tres capas: presentación en `frontend/`; aplicación y reglas en Express, controladores y modelos de negocio; persistencia mediante Prisma 6 y PostgreSQL/Supabase. El cliente no accede a tablas ni recibe credenciales privadas. SQLite se conserva para desarrollo y pruebas. Se reutilizan usuarios, productos, pedidos, promociones, proveedores, lotes, movimientos y facturación existentes.

Alternativas consideradas por el implementador: ampliar el MVC existente (elegida por compatibilidad y alcance); reescribir como SPA o microservicios (introduciría tecnologías y fronteras operativas que el negocio todavía no necesita). Esta elección técnica no se presenta como una preferencia expresada por el propietario.

Se mantiene HTML/CSS/JavaScript, Express 5 y Prisma 6.19.3. No se introducen React, Tailwind ni dependencias nuevas sin necesidad demostrada. La carpeta original carece de metadatos Git; se conserva un respaldo de fuentes con hashes en TEMP y no se modifican checkouts anidados. Una publicación utilizará una copia de trabajo separada y verificará el estado remoto antes de integrar cambios.

## Datos y negocio

- `ZonaEntrega`: nombre, provincia, cantón, tarifa final en centavos nullable, clasificación IVA y fundamento para tarifa cero, actividad y versiones temporales. Se crea Puerto Quito/Pichincha con tarifa pendiente. El administrador puede mantener zonas y tarifas. Ningún otro pueblo se activa automáticamente.
- `Entrega`: relación única por pedido y repartidor existente (`Usuario.role=repartidor`), estado, versión, fechas de asignación/salida/llegada/finalización y última ubicación GPS. Índices por repartidor/estado y estado/fecha para bandejas reales. No hay historial de recorridos.
- `Pedido`: referencia opcional de zona, subtotal de productos, envío final en centavos, snapshot fiscal del envío y coordenadas opcionales de destino con fecha de aceptación. Los pedidos históricos conservan sus importes. `total` de pedidos nuevos incluye envío cuando corresponda; factura añade una línea de servicio con el snapshot fiscal, sin convertir el envío en un producto de inventario.
- `Producto`: indicadores administrativos `controlado`, `biologico` y `cadenaFrio`, además de `requiereReceta` existente. No se infieren estas clasificaciones por nombre ni se inventan registros sanitarios.
- Migraciones SQLite y PostgreSQL equivalentes, aditivas, con claves foráneas, checks e índices justificados. RLS y revocación de acceso público en las tablas nuevas; Express conserva la autorización JWT propia. No se eliminan tablas, columnas o registros.

La entrega automática requiere zona activa, tarifa definida y productos admitidos. La tarifa general de IVA procede de la configuración fiscal existente; tarifa cero del envío exige fundamento registrado por administración. El total y los centavos se calculan en backend y se congelan por pedido. Una tarifa modificada no reescribe pedidos ni facturas. No se permiten pedidos con precios o tarifas elegidos por el cliente.

## Reparto y autorización

Pedido conserva sus estados y controles de lotes, facturación, idempotencia y devolución única. Entrega añade `asignada → en_camino → en_destino → entregada`, además de `cancelada`. Asignación requiere pedido de domicilio confirmado/preparado; salida requiere preparado. Reasignación solo antes de salir. Finalización actualiza pedido, entrega e historial en la misma transacción; cancelación conserva las restricciones fiscales y devolución existentes y elimina GPS.

El administrador crea/desactiva repartidores y asigna entregas. El registro público siempre crea clientes. El repartidor solo consulta y actúa sobre sus entregas; no compra, modifica catálogo, gestiona inventario ni accede a pedidos ajenos. Su DTO activo contiene destinatario, teléfono y destino necesarios, sin email, documento, productos farmacéuticos ni importes. Al cerrar, deja de recibir contacto y dirección. El cliente solo consulta seguimiento propio. Un recurso ajeno devuelve 404; rutas protegidas conservan 401/403 y no-store.

Concurrencia logística por `esperadoVersion`; versiones GPS independientes para no invalidar acciones por cada posición. Repetir una transición ya aplicada no duplica efectos. Transacciones serializables con reintentos acotados y PrismaClient reutilizado.

## Ubicación, mapas y ventanas

Dos páginas nuevas: `entregas.html` (operativa de repartidor y gestión administrativa) y `seguimiento.html?pedido=<id>` (cliente propietario). Mis pedidos conserva sus tarjetas y enlaza el seguimiento. La ventana administrativa mantiene zonas/tarifas, repartidores y asignación; el repartidor ve destino, navegación, compartir/detener ubicación y acciones de estado. Al llegar aparece `tel:` mediante gesto del repartidor; no se automatizan llamadas.

Geolocation exige HTTPS y permiso explícito. Compartir ubicación es optativo y solo durante entrega activa. Se envía una muestra como máximo cada 10–15 segundos, con precisión y fecha, sin simular posiciones. Se rechazan valores inválidos, muestras antiguas/futuras o fuera de orden. Solo se muestra ubicación reciente (dos minutos); se purga después de 15 minutos y se borra al terminar/cancelar/reasignar. No se promete seguimiento con pestaña cerrada o móvil bloqueado. La aplicación no incluye coordenadas en logs. Los backups pueden conservar datos hasta vencer su retención.

Google Maps URLs proporciona navegación y apertura de ubicaciones sin clave; nuestra API proporciona el seguimiento privado. Para mapa integrado se utiliza el embed público de OpenStreetMap con atribución y carga por decisión del usuario, indicando la transferencia de coordenadas al proveedor. La política CSP mantiene orígenes exactos. No se usa un endpoint Google de embed no documentado ni se contrata facturación Cloud silenciosamente. Una integración Google con key solo se activa si existe configuración legítima con restricciones verificadas.

## Tienda y asistente

Referencia estructural observada: Fybeca (portada y categoría), sin copiar código, textos, fotografías, marcas o colores. Cabecera con logo actual, búsqueda destacada, cuenta, carrito y cobertura; categorías reales; campañas y destacados existentes; catálogo con filtros/orden preservados en URL; ficha con imagen, presentación y disponibilidad. No se inventan más vendidos, descuentos, envíos gratuitos ni plazos.

Carrito muestra miniatura con alt y dimensiones, nombre enlazado, precio, disponibilidad, cantidad y total. Conserva imágenes públicas normalizadas, bloqueo de receta/stock, foco, persistencia y validación. Las mascotas mantienen sus personajes y animaciones; sus accesos activan o enfocan controles reales. Se revisan flechas y botones mediante patrones de teclado apropiados, sin interceptar globalmente teclas de formularios.

Farmi conserva interpretación local determinística: acciones tipadas, campos requeridos, identidad inequívoca, sin eval, SQL, shell o endpoint genérico. Ejecuta operaciones ordinarias completas cuando la orden contiene sus datos y reutiliza endpoints/validaciones/concurrencia. Incluye productos, promociones, proveedores, lotes, movimientos, pedidos y entregas según capacidades reales. Puede abrir formularios para datos faltantes, privados o decisiones fiscales; no inventa datos sanitarios, firmas, roles, cobros o autorizaciones del SRI. Navegación no descarga todo el catálogo. Fechas y mensajes usan hora de Ecuador.

## Restricciones sanitarias y privacidad

Se conserva receta obligatoria bloqueada para compra automática. Controlados, biológicos y cadena fría requieren atención/procedimiento profesional y no se habilitan automáticamente. Se excluyen Rx/controlados/biológicos de campañas, ofertas y recomendaciones; las decisiones concretas deben validarse según clasificación sanitaria real. Se mantienen PVP, IVA por clasificación, registro sanitario, lotes, caducidad y trazabilidad.

Fuentes: [norma ARCSA final de farmacias, revisión 24-10-2023](https://www.controlsanitario.gob.ec/wp-content/plugins/download-monitor/download.php?force=1&id=11973), [publicidad ARCSA 2024-048](https://www.controlsanitario.gob.ec/wp-content/plugins/download-monitor/download.php?force=1&id=14318), [documentos vigentes](https://www.controlsanitario.gob.ec/documentos-vigentes/), [LOPDP](https://www.gob.ec/sites/default/files/regulations/2025-01/01%20Ley%20Org%C3%A1nica%20de%20Protecci%C3%B3n%20de%20Datos%20Personales.pdf), [facturación SRI](https://www.sri.gob.ec/facturacion-electronica), [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started), [OSM embed](https://wiki.openstreetmap.org/wiki/Export#Embeddable_HTML).

No se presenta un borrador de audiencia ARCSA como ley vigente ni se certifica cumplimiento universal. La habilitación comercial de categorías especiales, emisor/firma SRI, bases legales/avisos del responsable y operación real requieren datos y procedimientos auténticos. El trabajo autorizado incluye implementar controles y verificar conexiones; no emitir facturas reales, enviar comunicaciones a terceros o generar cobros de prueba sobre datos comerciales.

## Evidencia de aceptación

Pruebas con bases y cuentas temporales: autorizaciones, propiedad/asignación, carreras, repetición, tarifas congeladas, totales fiscales/XSD, stock/cancelación, GPS y retirada, clasificación sanitaria, comandos administrativos y navegación. Navegador escritorio/móvil y teclado/axe en pantallas anteriores y nuevas; sin fallos JS/CSP ni desbordamiento. Validación de ambos schemas y migración sobre instalaciones temporales. Lecturas y migración aditiva de Supabase solo después de backup verificable y revisión de SQL. Publicación con fuente revisada y rollback, sin sustituir datos comerciales. Documentar exactamente resultados y conexiones pendientes; ningún proveedor se presenta como conectado sin evidencia.
