# Reparto integrado y revisión de referencia

3 de noviembre de 2026. Alcance: reparto web/nativo, asignación, límites de navegación y contraste de controles. No es una certificación ni una auditoría completa de ambos negocios.

## Identidad del personal y ayuda de reparto

Administración y reparto web comparten la paleta crema/vino del catálogo mediante `frontend/assets/operations.css`, sin duplicar sus modelos ni APIs. Se conservan logos, Goti y los colores de las estadísticas. Tablas, formularios y tarjetas de entrega ofrecen controles principales de al menos 44 píxeles; el mapa conserva la ruta dentro de la app y cerrar su panel devuelve el foco al pedido que lo abrió.

El administrador mantiene su panel, métricas, formularios y órdenes con resumen y confirmación/cancelación. En **Entregas y cobertura** configura zonas y coordina repartidores. El repartidor ve **Mis entregas**, sin formularios administrativos. Goti aparece también en esa bandeja con ayuda para actualizar la lista, consultar instrucciones de ruta/ubicación/entrega y abrir el perfil. La ayuda de reparto no modifica precios, promociones, pedidos ni estados; las acciones de entrega siguen pasando por los botones y confirmaciones existentes. Al perder sesión se retiran la mascota, el mapa y los datos privados.

`operations-polish.spec.cjs` comprueba identidad compartida, editor/tablas, roles, foco, controles, accesibilidad y ayuda de reparto en 320, 375, 768 y 1440 píxeles. Se mantienen las pruebas de conversación administrativa, asignación, permisos, GPS y cierre de entregas. Esta actualización visual corresponde a las pantallas web; no cambia permisos nativos ni recompila el APK 0.3.0. Las verificaciones con GPS sintético no sustituyen pruebas en teléfonos físicos.

## Recorrido

1. El pedido a domicilio nuevo se asigna dentro de su transacción si existe exactamente un repartidor activo. El pedido sigue pendiente; la farmacia confirma y prepara conforme a su operación. Los pedidos anteriores sin asignación se revisan al confirmarlos/prepararlos. Con cero o varios repartidores se utiliza la asignación administrativa. Retiro no crea entrega.
2. El repartidor ve sus entregas. **Ver ruta en la app** abre el mapa dentro de la pantalla. **Iniciar recorrido** exige preparación, cambia a en camino y solicita notificaciones/GPS. En la app instalada utiliza los plugins nativos existentes; en navegador sólo se garantiza el intento mientras la página esté disponible.
3. El marcador sigue muestras GPS recientes. La línea representa una ruta calculada por calles con OSRM, no una recta entre puntos. Se recalcula hasta cada treinta segundos con el mapa visible. No garantiza que una vía permita el paso ni sustituye las señales.
4. Sin coordenadas autorizadas del cliente, el repartidor confirma un destino de navegación con un toque o con campos de latitud/longitud operables por teclado. Sólo vive en memoria. No modifica la dirección ni el consentimiento del pedido.
5. **Llegué al destino** permite llamar al destinatario. **Pedido entregado** solicita confirmación, conserva la secuencia del backend y cierra ubicación, destino y mapa. No existe entrega automática por tiempo ni por proximidad GPS.

## Componentes y límites de seguridad

| Frontera | Control implementado / evidencia |
| --- | --- |
| Asignación | Transacción Serializable junto al pedido, restricción única de entrega por pedido y reintentos existentes. Se comprueban exactamente dos candidatos como máximo para detectar ambigüedad; conserva asignación previa. Pruebas de cero/uno/varios, retiro e idempotencia concurrente. |
| Ruta | `POST /api/entregas/:id/ruta`, sólo admin o repartidor asignado. Validación estricta de campos, tipos y pares; distancia local máxima de 100 km entre extremos. El pedido cerrado no permite cálculo. No admite una URL de proveedor del cliente. |
| Proveedor | URL HTTPS fija de FOSSGIS/OSRM; redirecciones rechazadas. Timeout de diez segundos, respuesta máxima 750 kB, hasta 20.000 puntos, comprobación de distancia y extremos. No reenvía Authorization ni datos de identidad, contacto o productos. Sin transacción abierta durante la llamada. Vuelve a autorizar después de recibirla. |
| Carga | Máximo una nueva consulta al proveedor por 1,1 segundos y proceso; caché en memoria de treinta segundos, hasta cien resultados. Cliente recalcula cada treinta segundos. Antes de ampliar a múltiples instancias se necesita un límite compartido acorde con el proveedor. |
| Mapa | Leaflet 1.9.4 local con licencia BSD, sin CDN de scripts; CSP conserva scripts/estilos propios y permite sólo el host HTTPS de mosaicos adicional. Atribución visible, sin precarga masiva ni descarga offline. Se conserva la caché HTTP normal de mosaicos. |
| Datos y sesión | Salida DOM como texto para nombres y direcciones. Mapa/posición se retiran al cierre y al perder sesión; respuestas tardías no restauran el mapa. JWT, roles, revocación, versiones y límites existentes siguen en el servidor. App nativa conserva acceso en memoria y renovación rotatoria en Keychain/Keystore. |

La ruta y la zona visible se comparten con los proveedores indicados al abrir/iniciar el mapa. Los resultados de ruta en caché son temporales de proceso; no se añade una tabla ni historial de trayectos. La configuración y el acceso operativo a estos proveedores deben revisarse antes de operar comercialmente a mayor escala. Políticas: [mosaicos OSM](https://operations.osmfoundation.org/policies/tiles/), [FOSSGIS](https://routing.openstreetmap.de/about.html), [API OSRM](https://project-osrm.org/docs/v5.24.0/api/).

## Comparación con el repositorio compartido

Se inspeccionó [andres18113/pliego-muejeje](https://github.com/andres18113/pliego-muejeje/tree/5cf793002754fcdbff483743ce3d6dd6cfee3326), commit `5cf793002754fcdbff483743ce3d6dd6cfee3326`, mediante lectura de código y decisiones documentadas. No se ejecutó su backend ni se probó su producción; las afirmaciones de sus documentos no se consideran pruebas de esta farmacia. No se copiaron sus fuentes o recursos. La implementación propia conserva HTML, CSS, JavaScript, Express y Prisma 6, sin Python ni migración a React/Java/Spring.

| Referencia observada | Aplicación / diferencia en farmacia |
| --- | --- |
| `SecurityConfiguration.java`: JWT, roles y CORS exacto | Controles equivalentes de finalidad ya existen en Express; se mantienen y se prueban para la nueva API de rutas. Nginx no sustituye autorización ni validación. |
| `AuthSessionCookie.java` y ADR-0010: renovación persistente con cookie HttpOnly | La app nativa ya utiliza renovación rotatoria y almacén cifrado. La tienda web incorpora cookies HttpOnly, renovación revocable y CSRF en la actualización de [sesiones y recuperación](SESIONES-Y-RECUPERACION.md). El proxy de Pages mantiene la API del mismo origen para esas cookies. |
| `LocationMap.tsx`: mapa OSM embebido y enlace externo | La farmacia añade mapa interactivo, marcador GPS y línea de ruta en su propio contenedor web/nativo. Leaflet local, autorización del pedido y proveedor de ruta aislado en backend. |
| ADR-0024 y `HomeDeliveryService.java`: etapas de entrega simuladas por reloj | No se adopta el avance automático de estados. Los botones del repartidor registran salida, llegada y entrega; una simulación no prueba recepción ni GPS. |
| Catálogo, carrito, compra, verificación, correos y comprobantes descritos en el proyecto | Son recorridos ya presentes en farmacia. Esta modificación no vuelve a certificar pagos, facturas ni correos. Los cobros reales requieren activar PayPhone; el modo de práctica permanece separado y explícito. |

## Lo que requiere dispositivos y cuentas reales

Un móvil completamente apagado o sin batería no envía nuevas posiciones. Pantalla bloqueada es un estado distinto: requiere la app nativa, GPS y permisos, y depende del sistema. Una web/PWA no garantiza el seguimiento en segundo plano. La app nativa no debe detenerse a la fuerza y requiere señal, red y batería.

Android 0.2.0 se entrega como APK de depuración; no equivale a publicación en Google Play. iPhone requiere macOS/Xcode, firma/aprovisionamiento y distribución válidos; la farmacia aún no dispone de Apple Developer. No se afirma instalación ni GPS físico de iPhone en esta entrega. Las pruebas de bloqueo, recuperación de red, batería, fabricante y renovación con el dispositivo bloqueado siguen en `mobile/README.md`.

Se mantiene Render Free por elección del propietario. Puede haber suspensión por inactividad y arranque en frío. Los servicios públicos de mapa/rutas tampoco ofrecen aquí SLA. No se afirma disponibilidad 24/7 ni seguridad superior a cualquier otro sitio.

## Evidencia local de esta actualización

- 101 pruebas Node de reparto, rutas, API móvil, sesiones, validación, seguridad y distribución: aprobadas con bases temporales y proveedor simulado.
- Tres pruebas de rutas/asignación en PostgreSQL 18 temporal: aprobadas, incluyendo reintento concurrente del mismo pedido sin duplicar entrega.
- Playwright: 26 casos de recorridos web en escritorio/móvil; 14 casos de instalación/mapas; 12 casos de interfaz móvil con sustitutos nativos explícitos. Incluyen ruta con desvío completamente encuadrada, movimiento, error del proveedor, teclado y retirada del destino. Los casos compartidos entre ejecuciones no representan pruebas físicas adicionales.
- Consulta real OSRM/FOSSGIS con coordenadas sintéticas: ruta de 29 puntos. Inspección visual con mosaicos reales OSM, sin errores HTTP de mosaicos ni desbordamiento móvil. Sin escrituras sobre pedidos de producción.
- Android: `assembleDebug lintDebug` aprobados; cero errores lint, diecinueve advertencias de herramientas/recursos conservadas. APK 0.2.0, versionCode 2, misma firma que 0.1.0. iOS: `cap sync ios` aprobado; no compilado ni instalado en iPhone en Windows.
- `npm audit --omit=dev` en raíz y móvil: cero avisos publicados para las dependencias de producción en la consulta realizada. Esto no certifica ausencia de vulnerabilidades ni incluye una auditoría exhaustiva de Leaflet vendorizado.
- Sin cambios de esquemas/migraciones ni versiones de dependencias npm. Leaflet 1.9.4 es la biblioteca adicional necesaria para el mapa; su licencia se distribuye con la web y el APK.

Referencias de implementación: [asignación](../server/models/entregas.cjs#L51), [proveedor de ruta](../server/models/rutas.cjs#L9), [autorización de la ruta](../server/routes/entregas.cjs#L20), [retirada de posición local](../mobile/src/tracker.js#L22). La evidencia de despliegue y los archivos locales de prueba se conservan en el informe privado de la entrega.

### Actualización de ruta automática (0.3.0)

Al abrir Ver ruta en la app se solicita la ubicación actual, también para consultar un pedido que todavía no ha salido. No se muestran campos de latitud/longitud ni se requiere confirmar un punto manual. Cuando falta el GPS de destino, el backend busca la dirección guardada con Nominatim: sólo acepta resultados específicos que coinciden con la calle o lugar y el cantón en Ecuador. Una calle se indica como aproximada; no se sustituye una dirección desconocida por el centro de la ciudad. Si el permiso se deniega se permite reintentar desde Usar mi ubicación; si no hay resultado o es ambiguo, la farmacia debe precisar la dirección. La captura continua del reparto comienza con Iniciar recorrido y conserva los controles existentes.

La búsqueda usa únicamente la dirección, provincia y cantón, sin nombre, teléfono, correo o productos. Caché de proceso y deduplicación, máximo una búsqueda cada 1,1 segundos y hasta cinco búsquedas pendientes. GEOCODING_ORIGIN permite cambiar el servicio compatible desde el backend sin actualizar la app. No hay autocompletado ni búsqueda periódica cuando la dirección no se encontró. El permiso de ubicación del sistema sigue siendo necesario.
