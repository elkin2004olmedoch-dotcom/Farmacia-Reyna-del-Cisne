# Entregas, seguimiento y privacidad

Estado: **manual de la candidata local del 28 de octubre de 2026**. La disponibilidad en los servicios publicados y los resultados de pruebas deben contrastarse con la evidencia final de entrega. Este manual no fija tarifas, plazos, horarios, permisos sanitarios ni datos registrales del negocio.

## Preparación por administración

1. Inicia sesión como administrador y abre **Entregas**. La zona inicial **Todo Puerto Quito** corresponde a Pichincha/Puerto Quito. Los pueblos aledaños siguen fuera de la cobertura inicial; no crees ni actives una zona futura hasta acordar su operación real.
2. En **Zonas y tarifas**, edita Puerto Quito. La tarifa se introduce en USD con hasta dos decimales e incluye IVA. Vacía significa pendiente y bloquea nuevos pedidos a domicilio; cero significa envío gratuito explícito. Guarda el importe real acordado con los repartidores.
3. Selecciona IVA general vigente o tarifa 0 % con fundamento. Para cero se exige texto de sustento de al menos ocho caracteres. Ese mínimo valida el campo, no la suficiencia jurídica del fundamento. Confirma con el negocio el tratamiento del servicio y su relación con la factura; no lo deduzcas del IVA de los medicamentos.
4. En **Crear repartidor**, usa sus datos auténticos y el formulario privado de contraseña inicial. El rol se fija en backend; el registro público crea clientes. Conserva las credenciales fuera de chats, informes y capturas.
5. Revisa ficha sanitaria, PVP, lotes, caducidad y stock reales antes de admitir un pedido. Receta, controlado, biológico o cadena de frío requieren revisión profesional y no admiten compra automática. Los controles implementados no acreditan habilitación sanitaria del servicio.

Cambiar una tarifa crea una versión histórica con actor y fecha. Su efecto es inmediato para nuevas compras; pedidos y facturas anteriores conservan sus importes. Desactivar un repartidor revoca sus tokens y desasigna entregas que todavía no salieron; se rechaza si tiene entregas en camino o en destino, que deben cerrarse o cancelarse conforme a los controles existentes.

## Recorrido de cliente, administrador y repartidor

1. **Cliente:** prepara el carrito, abre checkout y elige retiro o domicilio. Para domicilio selecciona zona activa, revisa productos, costo de envío y total; completa dirección escrita y teléfono. Con tarifa pendiente puede elegir retiro o coordinar con la farmacia, sin confirmar un costo inventado.
2. **Destino optativo:** pulsa el control de ubicación solo si deseas usar tu posición como destino. Comprueba que coincide con la dirección de entrega; una ubicación GPS puede ser distinta de la casa del destinatario. Se puede retirar antes de confirmar. Permiso denegado o falta de señal permiten continuar con la dirección escrita. Las coordenadas no verifican por sí solas cobertura: el backend compara provincia y cantón con la zona activa.
3. **Confirmación:** el servidor vuelve a comprobar cobertura, versión de tarifa, precios, stock, clasificación sanitaria y lotes. Una solicitud creada comienza como pedido pendiente; no demuestra pago, dispensación validada ni factura autorizada. El pago se coordina con la farmacia.
4. **Administrador:** revisa el pedido en el panel y pásalo a confirmado/preparado según la operación real. En Entregas selecciona el pedido a domicilio y un repartidor activo, y pulsa **Asignar entrega**. El selector pagina pedidos; usa Anterior/Siguiente si no aparece. Solo se asignan pedidos confirmados o preparados. **Reasignar** está disponible antes de salir.
5. **Repartidor:** inicia sesión con su cuenta y abre su bandeja en `entregas.html`. Solo recibe sus entregas. Revisa destinatario/dirección y usa **Navegar con Google Maps** si lo necesita. **Marcar salida** requiere pedido preparado; luego se habilita **Marcar llegada**. GPS es voluntario y no condiciona esos cambios.
6. **Llegada:** al marcar llegada la entrega pasa a en_destino y aparece **Llamar al destinatario**. Es un enlace `tel:` activado por el repartidor; el dispositivo decide cómo abrir la llamada. No se llama automáticamente ni se envían mensajes por ese acto.
7. **Cierre:** marca **Marcar entregada** solo tras la entrega efectiva. Pedido y entrega se actualizan juntos y se retiran las coordenadas. Administración puede cancelar, respetando restricciones fiscales y devolución única de inventario. No se permite saltar etapas; una entrega asignada no se reasigna después de salir.
8. **Seguimiento del cliente:** desde **Mis pedidos**, abre el seguimiento de su compra. Ve estados y fechas, y una posición únicamente si el repartidor la comparte y sigue reciente. La ausencia de posición no significa que el pedido esté cancelado ni autoriza inventar una ubicación o un tiempo estimado de llegada.

## Teclado y recuperación de errores

Usa Tab/Mayús+Tab para recorrer enlaces y campos; Enter/Espacio activa botones y abre los apartados desplegables. Las flechas operan los selectores nativos. Completa los campos por sus etiquetas, revisa errores asociados y el mensaje de estado antes de continuar. En los diálogos del panel, Escape permite salir y el foco vuelve al control que los abrió. Farmi se abre con su botón; al cerrar con Escape devuelve el foco al lanzador. No se requiere arrastrar un mapa ni usar gestos precisos para gestionar estados.

| Situación | Acción operativa |
|---|---|
| Tarifa pendiente o sin cobertura | Revisa zona/provincia/cantón. Administración configura la tarifa real; el cliente puede elegir retiro. Un código postal o GPS no activa pueblos futuros. |
| Tarifa cambió al confirmar | La API responde `409 DELIVERY_RATE_CHANGED` antes de reservar inventario. Actualiza cobertura, revisa el nuevo importe y confirma otra vez. No reenvíes un total anterior. |
| Otra persona cambió zona, pedido o entrega | Un 409 exige recargar/revisar datos y versión antes de intentar el cambio de nuevo. No fuerces una versión ni dupliques la operación. |
| No puede marcar salida | Verifica pedido preparado, repartidor asignado/activo y lotes vigentes. La asignación por sí sola no autoriza salida. |
| No aparece un pedido para asignar | Revisa modalidad domicilio, estado y páginas del selector. Actualiza datos tras confirmar o preparar en el panel. |
| Sesión caducada o rol incorrecto | 401 requiere iniciar sesión; 403 indica falta de permiso. La UI retira información privada al perder sesión. Un recurso ajeno responde 404. |
| No hay GPS, permiso denegado o muestra antigua | Continúa por dirección y estados. Comprueba HTTPS, permiso del dispositivo y señal si deseas compartir. No pulses repetidamente ni simules movimiento. |
| Se perdió conexión durante un cambio | Actualiza la bandeja y comprueba el estado persistido antes de repetir. Los estados repetidos ya aplicados no duplican efectos. |
| No pudo retirarse la ubicación del servidor | El GPS local se detiene; el aviso indica la retirada pendiente. Reintenta con **Actualizar entregas** al recuperar conexión. La posición deja de mostrarse al vencer dos minutos, aunque la limpieza física pueda ocurrir después. |
| Categoría sanitaria o factura impide avanzar | Revisión del administrador/profesional y del estado real; no cambiar casillas, fechas o roles para evadir el bloqueo. |

## Ubicación temporal y mapas

El punto del cliente es opcional, pertenece a un pedido a domicilio y se guarda solo al confirmar con `consienteUbicacion:true`; se conserva la fecha `ubicacionEntregaAceptadaAt`. Esa fecha registra la aceptación del flujo y no demuestra por sí sola que exista un aviso jurídico completo.

El repartidor inicia **Compartir mi ubicación** únicamente en camino/en destino. El navegador intenta enviar como máximo una muestra cada **12 segundos**; la API exige al menos diez segundos entre muestras, precisión válida y orden temporal, con una versión GPS independiente. Rechaza muestras de más de **dos minutos**, más de quince segundos futuras o fuera de orden. El seguimiento muestra fecha y precisión y oculta coordenadas sin actualización reciente durante dos minutos. Son límites técnicos de esta aplicación.

**Detener ubicación** cancela el observador local y solicita eliminar la última muestra del servidor. Al salir de la página se intenta retirarla con una petición de cierre, cuya entrega no está garantizada sin red. El servidor purga muestras de repartidor con más de **15 minutos desde su recepción**, al arrancar y cada minuto mientras está en ejecución: el plazo no es un borrado exacto al segundo y requiere que el proceso vuelva a ejecutar la limpieza. El punto del cliente se conserva hasta cerrar su pedido; no participa en esa purga de muestras del repartidor.

El navegador requiere permiso y contexto seguro para Geolocation. Mantener la página abierta y el dispositivo disponible permite recibir actualizaciones; cerrar pestaña, bloquear móvil, perder señal o suspender el navegador puede interrumpirlas. No hay aplicación nativa de fondo, rastreo garantizado, historial de trayectos ni ETA calculada. [Especificación W3C de Geolocation](https://www.w3.org/TR/geolocation/).

Google Maps se abre mediante **Maps URLs** con `api=1` y destino por dirección o coordenadas, sin clave de API. Abrirlo transmite ese destino a Google. La API de la farmacia proporciona el seguimiento privado; Google Maps recibe solo lo que se abre por decisión del usuario. No se contrataron JavaScript API ni Embed API por este flujo. [Documentación oficial de Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).

El mapa integrado de seguimiento utiliza el embed de OpenStreetMap con atribución y se carga al pulsar **Cargar mapa** cuando existe una posición reciente. Esa acción transmite las coordenadas mostradas y datos de conexión al proveedor. La página permite consultar estados sin cargarlo y retira el mapa cuando vence la posición. [Exportación e inserción de OpenStreetMap](https://wiki.openstreetmap.org/wiki/Export#Embeddable_HTML), [atribución y derechos](https://www.openstreetmap.org/copyright). No incluyas enlaces de mapas con coordenadas en informes públicos, analítica, mensajes o logs.

## Datos accesibles, borrado y conservación

| Dato | Acceso y ciclo de vida implementado |
|---|---|
| Destinatario, teléfono y dirección de entrega activa | Admin y repartidor asignado reciben solo lo necesario para operar. El DTO del repartidor no contiene email, documento, productos farmacéuticos ni importes. Reasignar retira el acceso del anterior. |
| Última ubicación del repartidor | Repartidor asignado la comparte/retira; comprador propietario y admin consultan únicamente muestra reciente. Se sobrescribe, sin tabla de trayecto. Reasignación y cierre la eliminan; la purga limita muestras abandonadas. |
| Coordenadas de destino | Opcionales y vinculadas al pedido. Al entregar/cancelar se borran junto con las del repartidor en la misma transacción. |
| Destino en una entrega cerrada | El DTO devuelve `destino:null`: el repartidor deja de recibir nombre, teléfono, dirección y punto del cliente. |
| Dirección textual y fecha de aceptación | Permanecen en el pedido, junto con información comercial/fiscal. Borrar coordenadas no borra estos datos. |
| Estados, actor/fechas, asignación y tarifa | Se conservan para operación y trazabilidad. No equivalen a historial GPS. El historial de tarifa conserva importe, clasificación, fundamento y actor. |
| Copias de seguridad | Pueden contener coordenadas capturadas antes de su retirada. Borrar la base activa no elimina copias previas ni datos ya transmitidos a un proveedor de mapas. |

La aplicación no implementa un plazo general de borrado de dirección, consentimiento, pedido o factura. El responsable debe definir y comunicar su retención por finalidad y obligación aplicable, y controlar restauraciones para no reintroducir localizaciones ya retiradas. El backup SQLite existente conserva por defecto las siete copias más recientes que reconoce su rutina, no una garantía de siete días; hay copias protegidas o forenses con otro ciclo. PostgreSQL y almacenamiento remoto requieren backups externos cuya retención real se debe revisar con el proveedor. No se presume configurada esa retención por este documento.

Antes de operar con datos reales, el responsable debe completar identidad/contacto, finalidades, bases legales, destinatarios/proveedores, transferencias, plazos y canal para derechos en el aviso aplicable. El permiso técnico del navegador no reemplaza esa información. La necesidad de evaluación de impacto o delegado se determina según tratamientos y supuestos reales, no automáticamente por mostrar un mapa. Referencias: [LOPDP, arts. 7–12, 25–26, 30 y 42](https://www.gob.ec/sites/default/files/regulations/2025-01/01%20Ley%20Org%C3%A1nica%20de%20Protecci%C3%B3n%20de%20Datos%20Personales.pdf), [SPDP sobre consentimiento](https://www.spdp.gob.ec/docs/proteccion-de-datos-personales/general/consentimiento/), [consulta SPDP-IRD-2026-0283-O](https://www.spdp.gob.ec/docs/consultas-absueltas/2026-2/oficio-n-spdp-ird-2026-0283-o/). El código y este manual no certifican cumplimiento legal integral.

## Contrato de la API de entregas

Prefijo `/api`; éxito `{ok:true,data:...}`; rutas privadas con Bearer y `no-store`. La lista de entregas usa `page`/`pageSize` (predeterminado 1/50, máximo 100) y filtro `estado`; la interfaz pide páginas de veinte. Los cuerpos rechazan campos inesperados. Para el detalle de tipos véase [el contrato de integración](superpowers/specs/2026-10-28-entregas-contract.md).

| Método y ruta | Permiso | Entrada/comportamiento |
|---|---|---|
| `GET /zonas-entrega` | Público | Zonas activas y versión; tarifa nullable. No devuelve fundamento ni historial administrativo. |
| `GET /admin/zonas-entrega` | Admin | Incluye inactivas e historial de tarifas. |
| `POST /admin/zonas-entrega` | Admin | Nombre, provincia, cantón, `tarifaCentavos`, `ivaCategoria`, `fundamentoIva`, `activa`. Centavos entero 0–10000000 o null; IVA general/cero. |
| `PUT /admin/zonas-entrega/:id` | Admin | Campos completos de zona y `esperadoVersion`; crea versión histórica. |
| `GET /admin/repartidores` | Admin | Identidad operativa y actividad; nunca hash o contraseña. |
| `POST /admin/repartidores` | Admin | Nombre, email, teléfono y contraseña; fuerza rol repartidor. |
| `PUT /admin/repartidores/:id` | Admin | `{activo:boolean}`; revoca sesión al cambiar actividad y protege entregas en curso. |
| `GET /entregas` | Admin/repartidor | Paginada; admin ve todas, repartidor solo asignadas. |
| `POST /entregas/asignar` | Admin | `pedidoId`, `repartidorId`; reasignación requiere `esperadoVersion`, primera asignación lo omite. |
| `PUT /entregas/:id/estado` | Admin/repartidor propio | `estado`, `esperadoVersion`. Asignada → en_camino → en_destino → entregada; cancelación solo admin. Repetir estado actual no duplica efectos. |
| `PUT /entregas/:id/ubicacion` | Repartidor propio | `latitud`, `longitud`, `precision`, `registradaAt` ISO con zona y `esperadoGpsVersion`; solo en camino/en destino. |
| `DELETE /entregas/:id/ubicacion` | Repartidor propio | Retira última muestra y aumenta `gpsVersion`. |
| `GET /pedidos/:id/seguimiento` | Comprador propietario/admin | Estado de pedido y entrega, fechas, versión y ubicación reciente; sin identidad del repartidor. Ajeno: 404. |

`POST /pedidos` añade en `comprador` los obligatorios `zonaEntregaId` y `esperadoTarifaVersion` para domicilio. Las coordenadas `latitudEntrega`/`longitudEntrega` deben venir emparejadas y con `consienteUbicacion:true`; retiro omite zona, versión y coordenadas. La validación transaccional de tarifa y cobertura ocurre antes de reservar stock. Un reintento idéntico de una compra ya creada recupera su snapshot histórico.

El cliente recibe `subtotalProductos`, `costoEnvioCentavos`, `envioIvaPorcentaje`, `envioBaseImponible`, `envioIvaMonto` y `zonaEntregaId`. La entrega operativa incluye IDs, estados/versiones/fechas, ubicación reciente y destino activo o null; no autoriza acceder al pedido completo por pertenecer al reparto.

## Pendientes de puesta en operación

Confirmar tarifa e IVA del servicio, procedimiento logístico y conservación de cada producto, cuentas auténticas de repartidores, aviso/retención del responsable y backups del destino. Verificar la candidata con bases/cuentas temporales y registrar los resultados reales antes de afirmar publicación. La clasificación sanitaria y la habilitación del operador se revisan conforme a [los criterios de Ecuador](ECUADOR-FARMACIA.md); no se deducen de que exista un botón de entrega. SRI, pagos y mensajería conservan sus controles y configuración propios; aquí no se han emitido facturas ni enviado comunicaciones reales.
