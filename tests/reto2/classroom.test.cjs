const {test,beforeEach,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const originalFetch=globalThis.fetch,originalStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
let demo,storage,writes,fetches;
const token={user:'clase-user',admin:'clase-admin',courier:'clase-repartidor'};
const product={nombre:'Gel de práctica',precio:4.5,stock:12,categoria:'cuidado',descripcion:'Producto ficticio de la prueba de clase.',imagen:'assets/images/producto-gel-antibacterial.svg',alt:'Ilustración de gel de práctica',stockMinimo:3,tipoProducto:'cuidado',ivaCategoria:'general'};
const buyer={name:'Nombre privado que no debe guardarse',email:'privado@example.invalid',phone:'0991234567',document:'0102030400',delivery:'pickup'};
async function call(path,{role,method='GET',body,headers,signal}={}){
  const response=await demo.classroomResponse(path,{method,headers:headers || (role?{Authorization:'Bearer '+token[role]}:{}),...(body===undefined?{}:{body:JSON.stringify(body)}),signal});
  assert.ok(response instanceof Response);assert.equal(response.headers.get('X-Farmacia-Classroom'),'true');
  const payload=response.status===204?null:await response.json();
  return {status:response.status,data:payload?.data,error:payload?.error,payload};
}
async function create({carrito=[{productoId:'clase-vitamina-c',cantidad:2}],comprador=buyer,claveSolicitud='solicitud-clase',role='user'}={}){return call('/pedidos',{role,method:'POST',body:{carrito,comprador,claveSolicitud}});}
async function updateOrder(order,estado,expected=order.updatedAt){return call('/pedidos/'+order.id+'/estado',{role:'admin',method:'PUT',body:{estado,esperadoUpdatedAt:expected}});}
async function state(){return JSON.parse(storage.get(demo.CLASSROOM_STATE_KEY));}

beforeEach(async()=>{
  demo=await import('../../frontend/models/classroom.js');storage=new Map([['farmacia-mvc-carrito','{"real-product":9}'],['farmacia-mvc-token','private-session-sentinel']]);writes=[];fetches=0;
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>storage.get(key)??null,setItem(key,value){writes.push(key);storage.set(key,String(value));}}});
  globalThis.fetch=()=>{fetches++;throw new Error('La clase no debe usar red.');};demo.resetClassroom();
});
afterEach(()=>{
  assert.equal(fetches,0,'Ninguna operación demo llega a fetch.');assert.ok(writes.every(key=>key===demo.CLASSROOM_STATE_KEY));
  assert.equal(storage.get('farmacia-mvc-carrito'),'{"real-product":9}');assert.equal(storage.get('farmacia-mvc-token'),'private-session-sentinel');
  globalThis.fetch=originalFetch;if(originalStorage)Object.defineProperty(globalThis,'localStorage',originalStorage);else delete globalThis.localStorage;
});

test('catálogo local, roles ficticios exactos y funciones excluidas nunca usan la API',async()=>{
  const result=await call('/productos?pageSize=2');assert.equal(result.status,200);assert.equal(result.data.total,4);assert.equal(result.data.items.length,2);assert.equal(result.data.items[0].precio,6.75);
  const user=await call('/auth/me',{role:'user'});assert.equal(user.data.role,'user');assert.equal(user.data.email,'cliente@example.invalid');
  for(const authorization of ['Bearer jwt-real-sentinel','Bearer constructor','Bearer __proto__','clase-user','Basic clase-user'])assert.equal((await call('/auth/me',{headers:{Authorization:authorization}})).status,401);
  for(const path of ['/admin/facturacion/facturas','/admin/proveedores','/admin/imagenes','/admin/tablas?tabla=usuarios','/admin/tablas?tabla=__proto__','https://example.invalid/api/productos','//example.invalid/productos'])assert.equal((await call(path,{role:'admin'})).status,404);
  assert.equal((await call('/auth/login',{method:'POST',body:{email:'irrelevante',password:'no-se-guarda'}})).status,404);
  assert.equal((await call('/pedidos/clase-pedido-inicial/pago/payphone',{role:'user',method:'POST',body:{}})).status,404);
  assert.equal((await call('/auth/logout',{role:'user',method:'POST'})).status,204);
});

test('roles y propiedad también se comprueban en la simulación',async()=>{
  assert.equal((await call('/admin/resumen')).status,401);
  assert.equal((await call('/admin/resumen',{role:'user'})).status,403);
  assert.equal((await call('/productos',{role:'courier',method:'POST',body:product})).status,403);
  assert.equal((await create({role:'admin'})).status,403);
  assert.equal((await call('/entregas',{role:'user'})).status,403);
  assert.equal((await call('/pedidos/clase-pedido-inicial/seguimiento',{role:'courier'})).status,403);
  const persisted=await state();persisted.orders[0].userId='clase-otro-cliente';storage.set(demo.CLASSROOM_STATE_KEY,JSON.stringify(persisted));
  assert.equal((await call('/pedidos/mis-pedidos',{role:'user'})).data.total,0);
  assert.equal((await call('/pedidos/clase-pedido-inicial/seguimiento',{role:'user'})).status,404);
  assert.equal((await call('/pedidos/clase-pedido-inicial/pago',{role:'user'})).status,404);
  assert.equal((await call('/pedidos/clase-pedido-inicial/seguimiento',{role:'admin'})).status,200);
});

test('productos: alta, edición con versión, validación y retirada sin borrar el historial',async()=>{
  const created=await call('/productos',{role:'admin',method:'POST',body:product});assert.equal(created.status,201);const id=created.data.id;
  const updated=await call('/productos/'+id,{role:'admin',method:'PUT',body:{precio:5,esperadoUpdatedAt:created.data.updatedAt}});assert.equal(updated.status,200);assert.equal(updated.data.precio,5);
  assert.equal((await call('/productos/'+id,{role:'admin',method:'PUT',body:{stock:99,esperadoUpdatedAt:created.data.updatedAt}})).status,409);
  assert.equal((await call('/productos/'+id)).data.stock,12);
  const invalid=await call('/productos/'+id,{role:'admin',method:'PUT',body:{nombre:'<script>fallo</script>',esperadoUpdatedAt:updated.data.updatedAt}});assert.equal(invalid.status,422);assert.equal(invalid.error.details[0].field,'nombre');
  assert.equal((await call('/productos',{role:'admin',method:'POST',body:{...product,imagen:'https://example.invalid/image.png'}})).status,422);
  assert.equal((await call('/productos/'+id,{role:'admin',method:'DELETE'})).status,204);
  assert.equal((await call('/productos/'+id)).status,404);
  const rows=(await call('/admin/tablas?tabla=productos',{role:'admin'})).data.items;assert.equal(rows.find(row=>row.id===id).activo,false);
});

test('campañas respetan vigencia, vista previa, mayor descuento y restricciones farmacéuticas',async()=>{
  const body={productoId:'clase-vitamina-c',titulo:'Práctica de descuentos',etiqueta:'DEMO',descripcion:'Campaña ficticia para clase.',descuentoPorcentaje:20,activa:true,vistaPrevia:true,orden:0,inicio:null,fin:null};
  const created=await call('/promociones',{role:'admin',method:'POST',body});assert.equal(created.status,201);assert.equal((await call('/productos/clase-vitamina-c')).data.precio,6.75);
  const published=await call('/promociones/'+created.data.id,{role:'admin',method:'PUT',body:{vistaPrevia:false}});assert.equal(published.status,200);assert.equal((await call('/productos/clase-vitamina-c')).data.precio,6);
  await call('/promociones/'+created.data.id,{role:'admin',method:'PUT',body:{fin:'2020-01-01T00:00:00Z'}});assert.equal((await call('/productos/clase-vitamina-c')).data.precio,6.75);
  const restricted=await call('/productos',{role:'admin',method:'POST',body:{...product,nombre:'Ejemplo con revisión',requiereReceta:true}});assert.equal(restricted.status,201);
  assert.equal((await call('/promociones',{role:'admin',method:'POST',body:{...body,productoId:restricted.data.id}})).status,422);
  assert.equal((await create({carrito:[{productoId:restricted.data.id,cantidad:1}]})).status,409);
  assert.equal((await call('/promociones/'+created.data.id,{role:'admin',method:'DELETE'})).status,204);
});

test('tarifa DEMO editable con versión, pedido guarda precios y envío históricos',async()=>{
  let zone=(await call('/zonas-entrega')).data[0];assert.equal(zone.tarifaCentavos,150);assert.match(zone.nombre,/DEMO/);
  const deliveryBuyer={...buyer,delivery:'delivery',province:'Pichincha',city:'Puerto Quito',zonaEntregaId:zone.id,esperadoTarifaVersion:zone.version,address:'Dirección privada que no debe guardarse'};
  zone=(await call('/admin/zonas-entrega/'+zone.id,{role:'admin',method:'PUT',body:{tarifaCentavos:250,esperadoVersion:zone.version}})).data;
  const stale=await create({comprador:deliveryBuyer});assert.equal(stale.status,409);assert.equal((await call('/productos/clase-vitamina-c')).data.stock,24);
  const ordered=await create({comprador:{...deliveryBuyer,esperadoTarifaVersion:zone.version}});assert.equal(ordered.status,201);assert.equal(ordered.data.subtotalProductos,13.5);assert.equal(ordered.data.costoEnvioCentavos,250);assert.equal(ordered.data.total,16);assert.equal((await call('/productos/clase-vitamina-c')).data.stock,22);
  const current=(await call('/admin/tablas?tabla=productos',{role:'admin'})).data.items.find(p=>p.id==='clase-vitamina-c');
  await call('/productos/'+current.id,{role:'admin',method:'PUT',body:{precio:20,esperadoUpdatedAt:current.updatedAt}});
  await call('/admin/zonas-entrega/'+zone.id,{role:'admin',method:'PUT',body:{tarifaCentavos:900,esperadoVersion:zone.version}});
  const stored=(await call('/pedidos/mis-pedidos',{role:'user'})).data.items.find(order=>order.id===ordered.data.id);assert.equal(stored.total,16);assert.equal(stored.detalles[0].precioUnitario,6.75);assert.equal(stored.costoEnvioCentavos,250);
  const persisted=storage.get(demo.CLASSROOM_STATE_KEY);assert.doesNotMatch(persisted,/Nombre privado|privado@example|Dirección privada|0102030400/);
});

test('confirmación idempotente no duplica pedidos ni stock y rechaza contenido diferente',async()=>{
  const one=await create(),two=await create();assert.equal(one.status,201);assert.equal(two.status,200);assert.equal(two.data.id,one.data.id);
  assert.notEqual(one.data.id.slice(0,8),'clase-pe','Los pedidos nuevos se distinguen del ejemplo inicial en la interfaz.');
  assert.equal((await call('/productos/clase-vitamina-c')).data.stock,22);assert.equal((await call('/pedidos/mis-pedidos',{role:'user'})).data.total,2);
  assert.equal((await create({carrito:[{productoId:'clase-vitamina-c',cantidad:1}]})).status,409);
  assert.equal((await create({comprador:{...buyer,name:'Otra persona ficticia'}})).status,409);
  const concurrent=await Promise.all([create({claveSolicitud:'concurrente'}),create({claveSolicitud:'concurrente'})]);assert.deepEqual(concurrent.map(result=>result.status).sort(),[200,201]);assert.equal(concurrent[0].data.id,concurrent[1].data.id);assert.equal((await call('/productos/clase-vitamina-c')).data.stock,20);
});

test('carrito inválido o stock insuficiente falla sin reservas parciales',async()=>{
  const invalid=[[],[{productoId:'clase-vitamina-c',cantidad:0}],[{productoId:'clase-vitamina-c',cantidad:1},{productoId:'clase-vitamina-c',cantidad:1}],[{productoId:'clase-vitamina-c',cantidad:1},{productoId:'clase-gel-manos',cantidad:99}]];
  for(const carrito of invalid)assert.ok([409,422].includes((await create({carrito})).status));
  assert.equal((await call('/productos/clase-vitamina-c')).data.stock,24);assert.equal((await call('/pedidos/mis-pedidos',{role:'user'})).data.total,1);
});

test('estados del pedido respetan versiones, finales e inventario al cancelar una sola vez',async()=>{
  const created=(await create()).data;const confirmed=(await updateOrder(created,'confirmado')).data;
  assert.equal((await updateOrder(confirmed,'preparado',created.updatedAt)).status,409);
  const canceled=(await updateOrder(confirmed,'cancelado')).data;assert.equal(canceled.estado,'cancelado');assert.equal((await call('/productos/clase-vitamina-c')).data.stock,24);
  assert.equal((await updateOrder(confirmed,'cancelado')).status,200);assert.equal((await call('/productos/clase-vitamina-c')).data.stock,24);
  assert.equal((await updateOrder(canceled,'confirmado')).status,409);
});

test('reparto completo controla asignación, preparación, GPS ficticio y privacidad final',async()=>{
  const zone=(await call('/zonas-entrega')).data[0],comprador={...buyer,delivery:'delivery',province:'Pichincha',city:'Puerto Quito',zonaEntregaId:zone.id,esperadoTarifaVersion:zone.version};
  let order=(await create({comprador})).data;
  assert.equal((await call('/entregas/asignar',{role:'admin',method:'POST',body:{pedidoId:order.id,repartidorId:'clase-repartidor'}})).status,409);
  order=(await updateOrder(order,'confirmado')).data;
  let delivery=(await call('/entregas/asignar',{role:'admin',method:'POST',body:{pedidoId:order.id,repartidorId:'clase-repartidor'}})).data;
  assert.equal((await call('/entregas/'+delivery.id+'/estado',{role:'courier',method:'PUT',body:{estado:'en_camino',esperadoVersion:delivery.version}})).status,409);
  assert.equal((await call('/entregas/'+delivery.id+'/ubicacion',{role:'courier',method:'PUT',body:{esperadoGpsVersion:0}})).status,409);
  order=(await updateOrder(order,'preparado')).data;
  const advance=async estado=>call('/entregas/'+delivery.id+'/estado',{role:'courier',method:'PUT',body:{estado,esperadoVersion:delivery.version}});
  delivery=(await advance('en_camino')).data;
  assert.equal((await call('/entregas/'+delivery.id+'/estado',{role:'courier',method:'PUT',body:{estado:'en_destino',esperadoVersion:1}})).status,409);
  const point=await call('/entregas/'+delivery.id+'/ubicacion',{role:'courier',method:'PUT',body:{esperadoGpsVersion:0,latitud:40.123,longitud:-73.456,precision:1,registradaAt:new Date().toISOString()}});assert.equal(point.status,200);assert.equal(point.data.ubicacion.latitud,0.12);assert.equal(point.data.ubicacion.longitud,-79.24);
  assert.equal((await call('/entregas/'+delivery.id+'/ubicacion',{role:'courier',method:'PUT',body:{esperadoGpsVersion:0}})).status,409);
  const tracking=(await call('/pedidos/'+order.id+'/seguimiento',{role:'user'})).data;assert.equal(tracking.entrega.ubicacion.precision,20);assert.equal(tracking.entrega.destino,undefined);
  delivery=(await advance('en_destino')).data;delivery=(await advance('entregada')).data;assert.equal(delivery.destino,null);assert.equal(delivery.ubicacion,null);assert.equal(delivery.estadoPedido,'entregado');
  const closed=(await call('/pedidos/'+order.id+'/seguimiento',{role:'user'})).data;assert.equal(closed.entrega.ubicacion,null);assert.equal(closed.estadoPedido,'entregado');
  assert.equal((await advance('en_camino')).status,409);assert.equal((await call('/productos/clase-vitamina-c')).data.stock,22);
  assert.doesNotMatch(storage.get(demo.CLASSROOM_STATE_KEY),/40\.123|-73\.456/);
});

test('resumen y pago de demostración usan los importes guardados sin registrar cobros',async()=>{
  const created=(await create()).data,summary=(await call('/admin/resumen',{role:'admin'})).data;
  assert.equal(summary.indicadores.pedidosTotales.cantidad,2);assert.equal(summary.indicadores.pedidosTotales.totalCentavos,475+1350);assert.equal(summary.indicadores.pedidosPendientes,1);assert.equal(summary.tendencia.length,6);assert.equal(summary.alertas[0].id,'clase-cuidado-bebe');
  const payment=(await call('/pedidos/'+created.id+'/pago',{role:'user'})).data;assert.equal(payment.pedido.totalCentavos,1350);assert.equal(payment.pago,null);assert.equal(payment.demostracion,true);assert.equal(payment.payphone.disponible,false);
  assert.equal((await state()).payments,undefined);
});

test('estado corrupto o sobredimensionado se recupera sin afectar claves reales',async()=>{
  for(const value of ['{json inválido',JSON.stringify({version:1,products:{}}),'x'.repeat(700001)]){
    storage.set(demo.CLASSROOM_STATE_KEY,value);const result=await call('/productos');assert.equal(result.status,200);assert.equal(result.data.total,4);assert.doesNotThrow(()=>JSON.parse(storage.get(demo.CLASSROOM_STATE_KEY)));
  }
  const persisted=await state();persisted.products[0].precio=-1;storage.set(demo.CLASSROOM_STATE_KEY,JSON.stringify(persisted));assert.equal((await call('/productos/clase-vitamina-c')).data.precio,6.75);
  await create();demo.resetClassroom();assert.equal((await call('/pedidos/mis-pedidos',{role:'user'})).data.total,1);
});

test('cancelación de solicitud y JSON inválido no modifican la demostración',async()=>{
  const controller=new AbortController();controller.abort();const before=storage.get(demo.CLASSROOM_STATE_KEY);
  await assert.rejects(demo.classroomResponse('/productos',{signal:controller.signal}),error=>error.name==='AbortError');assert.equal(storage.get(demo.CLASSROOM_STATE_KEY),before);
  const response=await demo.classroomResponse('/pedidos',{method:'POST',body:'{no es json'});assert.equal(response.status,400);assert.equal(storage.get(demo.CLASSROOM_STATE_KEY),before);
  assert.equal((await call('/productos?pageSize=101')).status,422);
});
