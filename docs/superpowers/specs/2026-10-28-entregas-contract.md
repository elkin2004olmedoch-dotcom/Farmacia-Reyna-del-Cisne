# Contrato de entregas (28-10-2026)

Todas las rutas se montan bajo `/api` mediante `require('./routes/entregas.cjs')(config)`. Éxito `{ok:true,data:...}`; errores AppError existentes. Privadas con Bearer y no-store. Paginación `page/pageSize` (por defecto 1/50, máximo 100).

## Zonas

- GET `/zonas-entrega`: público, array de zonas activas con `id,nombre,provincia,canton,tarifaCentavos,ivaCategoria,version,activa`. Tarifa null significa pendiente; cero es gratuidad explícita.
- GET `/admin/zonas-entrega`: admin, array completo incluidas inactivas, fundamento fiscal, fechas y `tarifas` (historial descendente: versión, importe, IVA, fundamento, actorId y fecha).
- POST `/admin/zonas-entrega`: admin `{nombre,provincia,canton,tarifaCentavos,ivaCategoria,fundamentoIva,activa}`. Tarifa entero 0..10000000 o null; categoria general/cero; cero exige fundamento >=8 caracteres.
- PUT `/admin/zonas-entrega/:id`: los mismos campos + `esperadoVersion` entero. Versiones históricas inmutables se conservan en ZonaEntregaTarifa; el cambio es inmediato.

## Repartidores y entregas

- GET `/admin/repartidores`: admin, array `{id,nombre,email,telefono,activo}`.
- POST `/admin/repartidores`: admin `{nombre,email,telefono,password}`; devuelve DTO anterior; rol forzado repartidor.
- PUT `/admin/repartidores/:id`: admin `{activo:boolean}`; desactivar revoca tokens, rechaza si tiene entregas en camino/en destino, desasigna entregas asignadas.
- GET `/entregas`: admin/repartidor, paginado `{items,total,page,pageSize}`. Repartidor solo propias, admin todas. `estado` opcional.
- POST `/entregas/asignar`: admin `{pedidoId,repartidorId,esperadoVersion?}`. Primera asignación omite versión; reasignación exige versión. Pedido domicilio confirmado/preparado. Solo reasigna antes de salir.
- PUT `/entregas/:id/estado`: admin/repartidor propio `{estado,esperadoVersion}`. Transiciones asignada→en_camino→en_destino→entregada; admin puede cancelar. Salida requiere pedido preparado. Repetición estado actual idempotente.
- PUT `/entregas/:id/ubicacion`: repartidor propio `{latitud,longitud,precision,registradaAt,esperadoGpsVersion}`. Números finitos, precisión 0..10000 metros; fecha ISO con zona, máxima antigüedad 2 minutos y futuro 15 segundos. Solo en_camino/en_destino. Muestras crecientes, máximo una cada 10 segundos. Devuelve `{gpsVersion,ubicacion}`.
- DELETE `/entregas/:id/ubicacion`: repartidor propio; retira coordenadas y avanza gpsVersion. Devuelve `{gpsVersion,ubicacion:null}`.
- GET `/pedidos/:id/seguimiento`: comprador propietario o admin; ajeno 404. `{pedidoId,estadoPedido,entrega:null|{id,estado,version,asignadaAt,salidaAt,llegadaAt,finalizadaAt,ubicacion}}`. Ubicación `{latitud,longitud,precision,registradaAt}` únicamente reciente (2 minutos). No datos personales del repartidor.

DTO entrega: `{id,pedidoId,repartidorId,estado,version,gpsVersion,asignadaAt,salidaAt,llegadaAt,finalizadaAt,estadoPedido,ubicacion,destino}`. Destino activo `{nombre,telefono,provincia,ciudad,direccion,latitud,longitud}`; al cerrar `destino:null`. Sin email, documento, medicamentos ni importes. Admin puede consultar detalles del pedido por sus rutas existentes.

## Pedido y fiscalidad

Comprador conserva campos existentes y añade `zonaEntregaId` y `esperadoTarifaVersion` obligatorios para domicilio. La versión es un entero positivo tomado de `zona.version`; si cambia antes de confirmar se responde 409 `DELIVERY_RATE_CHANGED` dentro de la transacción antes de reservar inventario. El cliente recarga la tarifa y solicita nueva confirmación del importe. Un reintento idéntico con la misma clave de solicitud devuelve su pedido histórico incluso si la tarifa cambió posteriormente. Retiro omite estos dos campos.

`latitudEntrega`/`longitudEntrega` son numéricas opcionales emparejadas, solo domicilio y `consienteUbicacion:true`. Sin coordenadas no se necesita consentimiento. Cobertura compara provincia/cantón normalizados con zona activa. Pedido devuelve `subtotalProductos,costoEnvioCentavos,envioIvaPorcentaje,envioBaseImponible,envioIvaMonto,zonaEntregaId`; total incluye envío. Snapshot independiente de cambios posteriores. Factura incorpora servicio SERV-ENVIO. Al entregar/cancelar se borran en la misma transacción las coordenadas del comprador y del repartidor; se conservan dirección textual, fecha de aceptación y datos comerciales/fiscales.

## Integración interna

`models/entregas.cjs` exporta `purgeExpiredLocations(now=new Date())` (promesa; borra muestras de más de 15 minutos), y funciones usadas por controlador. Root programa limpieza periódica sin registrar coordenadas. `models/pedidos.cjs` exporta `updateStatusTx(tx,id,input,actorId)` para transición con misma transacción y controles fiscales/lotes, y `assertOrderLotsCurrent(tx,pedidoId)` para comprobar vencimientos en cada avance logístico. Cualquier cierre genérico sincroniza Entrega y elimina GPS; entregar genéricamente exige entrega en_destino cuando existe. Registrar acciones administrativas por IDs y acción, nunca cuerpo/password/GPS.
