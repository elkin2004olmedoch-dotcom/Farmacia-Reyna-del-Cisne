'use strict';
const {test,after}=require('node:test'),assert=require('node:assert/strict'),jwt=require('jsonwebtoken'),{randomUUID}=require('node:crypto');
const fixture=require('./email-api-fixture.cjs').createFixture(),{db,config}=fixture,api=fixture.api(false);
const orders=require('../../server/models/pedidos.cjs'),deliveries=require('../../server/models/entregas.cjs');
const token=user=>'Bearer '+jwt.sign({version:user.tokenVersion},config.secret,{algorithm:'HS256',subject:user.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'5m'});
let admin,buyer,courier,other,zone,product;
after(()=>fixture.close());
async function ready({advance=true}={}){
 if(!admin){admin=await db.usuario.findFirst({where:{role:'admin'}});buyer=await db.usuario.create({data:{nombre:'Cliente Código',email:'codigo@example.ec',telefono:'+593979275988',passwordHash:'fixture'}});courier=await db.usuario.create({data:{nombre:'Repartidor Código',email:'codigo-driver@example.ec',telefono:'+593979275988',passwordHash:'fixture',role:'repartidor'}});other=await db.usuario.create({data:{nombre:'Cliente Ajeno',email:'codigo-other@example.ec',telefono:'+593979275988',passwordHash:'fixture'}});zone=await deliveries.saveZone(null,{nombre:'Cobertura Código',provincia:'Pichincha',canton:'Puerto Quito',tarifaCentavos:0,ivaCategoria:'general',fundamentoIva:null,activa:true},admin);product=await db.producto.create({data:{nombre:'Producto Código',precio:5,stock:40,categoria:'cuidado',descripcion:'Producto sintético',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase'}});}
 let {pedido}=await orders.create(buyer.id,{carrito:[{productoId:product.id,cantidad:1}],comprador:{name:buyer.nombre,email:buyer.email,phone:'0979275988',documentType:'cedula',document:'0102030400',delivery:'delivery',province:'Pichincha',city:'Puerto Quito',address:'Calle Principal y parque central',postalCode:'',zonaEntregaId:zone.id,esperadoTarifaVersion:zone.version},claveSolicitud:randomUUID()});
 for(const estado of ['confirmado','preparado'])pedido=(await orders.updateStatus(pedido.id,{estado,esperadoUpdatedAt:pedido.updatedAt.toISOString()},admin.id)).pedido;
 const assigned=await db.entrega.findUnique({where:{pedidoId:pedido.id}});
 let entrega=assigned?await deliveries.find(assigned.id,courier):await deliveries.assign({pedidoId:pedido.id,repartidorId:courier.id},admin);
 if(advance)for(const estado of ['en_camino','en_destino'])entrega=await deliveries.changeState(entrega.id,{estado,esperadoVersion:entrega.version},courier);
 return {pedido,entrega};
}
test('nueva entrega exige código, sólo dueño lo recibe y ni administración elude el cierre',async()=>{
 const {pedido,entrega}=await ready();assert.equal(entrega.codigoRequerido,true);
 const tracking=(await api.get('/api/pedidos/'+pedido.id+'/seguimiento').set('Authorization',token(buyer)).expect(200)).body.data;
 assert.match(tracking.entrega.codigoEntrega,/^\d{6}$/);assert.equal(entrega.codigoEntrega,undefined);assert.equal(entrega.codigoEntregaNonce,undefined);
 const staff=(await api.get('/api/pedidos/'+pedido.id+'/seguimiento').set('Authorization',token(admin)).expect(200)).body.data;assert.equal(staff.entrega.codigoEntrega,undefined);
 await api.get('/api/pedidos/'+pedido.id+'/seguimiento').set('Authorization',token(other)).expect(404);
 await api.put('/api/entregas/'+entrega.id+'/estado').set('Authorization',token(courier)).send({estado:'entregada',esperadoVersion:entrega.version}).expect(409);
 await assert.rejects(()=>orders.updateStatus(pedido.id,{estado:'entregado',esperadoUpdatedAt:pedido.updatedAt.toISOString()},admin.id),error=>error.code==='DELIVERY_CODE_REQUIRED');
 const wrong=tracking.entrega.codigoEntrega==='000000'?'000001':'000000';
 await api.put('/api/entregas/'+entrega.id+'/estado').set('Authorization',token(courier)).send({estado:'entregada',esperadoVersion:entrega.version,codigoEntrega:wrong}).expect(422);
 assert.equal((await db.entrega.findUnique({where:{id:entrega.id}})).codigoIntentos,1);
 await api.put('/api/entregas/'+entrega.id+'/estado').set('Authorization',token(courier)).send({estado:'entregada',esperadoVersion:entrega.version,codigoEntrega:tracking.entrega.codigoEntrega}).expect(200);
 const closed=await db.entrega.findUnique({where:{id:entrega.id}});assert.equal(closed.estado,'entregada');assert.equal(closed.codigoEntregaNonce,null);
});
test('incidencia se publica sin autor y se resuelve con versión y asignación actuales',async()=>{
 const {pedido,entrega}=await ready(),url='/api/entregas/'+entrega.id+'/incidencias';
 await api.post(url).set('Authorization',token(other)).send({tipo:'retraso',descripcion:'Tránsito detenido en el recorrido.',esperadoVersion:entrega.version}).expect(403);
 const created=(await api.post(url).set('Authorization',token(courier)).send({tipo:'retraso',descripcion:'Tránsito detenido en el recorrido.',esperadoVersion:entrega.version}).expect(201)).body.data;
 const tracking=(await api.get('/api/pedidos/'+pedido.id+'/seguimiento').set('Authorization',token(buyer)).expect(200)).body.data;
 assert.equal(tracking.entrega.incidencias.length,1);assert.equal(tracking.entrega.incidencias[0].actorId,undefined);assert.equal(tracking.entrega.incidencias[0].descripcion,'Tránsito detenido en el recorrido.');
 await api.put(url+'/'+created.id).set('Authorization',token(courier)).send({esperadoVersion:entrega.version}).expect(409);
 const current=await deliveries.find(entrega.id,courier);
 await api.put(url+'/'+created.id).set('Authorization',token(courier)).send({esperadoVersion:current.version}).expect(200);
});
test('cinco errores concurrentes se conservan y bloquean incluso el código correcto',async()=>{
 const {pedido,entrega}=await ready(),codigo=(await deliveries.tracking(pedido.id,buyer)).entrega.codigoEntrega,wrong=codigo==='000000'?'000001':'000000';
 const results=await Promise.allSettled(Array.from({length:5},()=>deliveries.changeState(entrega.id,{estado:'entregada',esperadoVersion:entrega.version,codigoEntrega:wrong},courier)));
 assert.equal(results.filter(result=>result.status==='fulfilled').length,0);
 const row=await db.entrega.findUnique({where:{id:entrega.id}});assert.equal(row.codigoIntentos,5);assert.ok(row.codigoBloqueadoHasta>Date.now());assert.equal(row.estado,'en_destino');
 await assert.rejects(()=>deliveries.changeState(entrega.id,{estado:'entregada',esperadoVersion:entrega.version,codigoEntrega:codigo},courier),error=>error.code==='DELIVERY_CODE_LOCKED');
 await db.entrega.update({where:{id:entrega.id},data:{codigoBloqueadoHasta:new Date(Date.now()-1)}});
 await deliveries.changeState(entrega.id,{estado:'entregada',esperadoVersion:entrega.version,codigoEntrega:codigo},courier);
});
test('incidencias rechazan repartidor ajeno, texto inválido y resolver otra entrega',async()=>{
 const a=await ready(),b=await ready(),stranger=await db.usuario.create({data:{nombre:'Repartidor Ajeno',email:'progress-stranger@example.ec',telefono:'+593979275988',passwordHash:'fixture',role:'repartidor'}}),url='/api/entregas/'+a.entrega.id+'/incidencias';
 await api.post(url).set('Authorization',token(stranger)).send({tipo:'otro',descripcion:'Observación válida sin datos privados.',esperadoVersion:a.entrega.version}).expect(404);
 await api.post(url).set('Authorization',token(courier)).send({tipo:'medicamento',descripcion:'Observación válida sin datos privados.',esperadoVersion:a.entrega.version}).expect(422);
 await api.post(url).set('Authorization',token(courier)).send({tipo:'otro',descripcion:'corto',esperadoVersion:a.entrega.version}).expect(422);
 const incident=await deliveries.incidence(a.entrega.id,{tipo:'direccion',descripcion:'El acceso principal está temporalmente cerrado.',esperadoVersion:a.entrega.version},courier);
 await assert.rejects(()=>deliveries.incidence(b.entrega.id,{incidenciaId:incident.id,esperadoVersion:b.entrega.version},courier),error=>error.code==='NOT_FOUND');
});
test('estimación sólo usa GPS persistido y se invalida al retirar ubicación o cambiar durante OSRM',async()=>{
 const {pedido,entrega}=await ready(),{createRouting}=require('../../server/models/rutas.cjs');
 const fetch=async url=>new Response(JSON.stringify({code:'Ok',routes:[{distance:1800,duration:240,geometry:{type:'LineString',coordinates:new URL(url).pathname.split('/').at(-1).split(';').map(point=>point.split(',').map(Number))}}]}));
 const service=createRouting({fetch});
 await service.calculate(entrega.id,courier,{latitud:.12,longitud:-79.24});assert.equal((await deliveries.tracking(pedido.id,buyer)).entrega.estimacion,null);
 await deliveries.setLocation(entrega.id,{latitud:.12,longitud:-79.24,precision:10,registradaAt:new Date().toISOString(),esperadoGpsVersion:entrega.gpsVersion},courier);
 await service.calculate(entrega.id,courier,{latitud:.12,longitud:-79.24});
 const estimated=(await deliveries.tracking(pedido.id,buyer)).entrega.estimacion;assert.equal(estimated.vigente,true);assert.match(estimated.fuente,/OSRM/);assert.equal(new Date(estimated.hasta)-new Date(estimated.desde),300000);
 await db.entrega.update({where:{id:entrega.id},data:{estimadaVenceAt:new Date(Date.now()-1),estimadaHasta:new Date(Date.now()-1)}});const expired=(await deliveries.tracking(pedido.id,buyer)).entrega.estimacion;assert.equal(expired.vigente,false);assert.equal(expired.retrasada,true);
 await deliveries.clearLocation(entrega.id,courier);assert.equal((await deliveries.tracking(pedido.id,buyer)).entrega.estimacion,null);
 const late=createRouting({fetch:async url=>{await deliveries.clearLocation(entrega.id,courier);return fetch(url);}});
 await assert.rejects(()=>late.calculate(entrega.id,courier,{latitud:.12,longitud:-79.24}),error=>error.code==='DELIVERY_CHANGED');
 assert.equal((await deliveries.tracking(pedido.id,buyer)).entrega.estimacion,null);
 const broken=createRouting({fetch:async()=>{throw new Error('provider');}});await assert.rejects(()=>broken.calculate(entrega.id,courier,{latitud:.12,longitud:-79.24}),error=>error.code==='ROUTE_UNAVAILABLE');
});
test('reasignar rota nonce y permisos; la asignación automática también exige código',async()=>{
 const {pedido,entrega}=await ready({advance:false}),old=await db.entrega.findUnique({where:{id:entrega.id}}),stranger=await db.usuario.findUnique({where:{email:'progress-stranger@example.ec'}});
 const current=await deliveries.assign({pedidoId:pedido.id,repartidorId:stranger.id,esperadoVersion:entrega.version},admin),row=await db.entrega.findUnique({where:{id:entrega.id}});
 assert.equal(current.codigoRequerido,true);assert.notEqual(row.codigoEntregaNonce,old.codigoEntregaNonce);assert.equal(row.codigoIntentos,0);assert.equal(row.estimadaHasta,null);await assert.rejects(()=>deliveries.find(entrega.id,courier),error=>error.code==='NOT_FOUND');
 assert.match((await deliveries.tracking(pedido.id,buyer)).entrega.codigoEntrega,/^\d{6}$/);
});
test('GPS a 12 y 24 segundos conserva la última ventana legítima sin recalcular ni prorrogar su caducidad',async t=>{
 const {pedido,entrega}=await ready(),routing=require('../../server/models/rutas.cjs'),original=routing.calculate;let calls=0;
 const transport=async url=>{calls++;return new Response(JSON.stringify({code:'Ok',routes:[{distance:1800,duration:240,geometry:{type:'LineString',coordinates:new URL(url).pathname.split('/').at(-1).split(';').map(point=>point.split(',').map(Number))}}]}));};
 routing.calculate=routing.createRouting({fetch:transport,now:()=>Date.now()}).calculate;
 t.after(()=>{routing.calculate=original;});t.mock.timers.enable({apis:['Date'],now:Date.now()});
 let gps=entrega.gpsVersion;
 const sample=async()=>{const saved=await deliveries.setLocation(entrega.id,{latitud:.12+gps/100000,longitud:-79.24,precision:10,registradaAt:new Date().toISOString(),esperadoGpsVersion:gps},courier);gps=saved.gpsVersion;return (await deliveries.tracking(pedido.id,buyer)).entrega.estimacion;};
 const first=await sample();assert.equal(first.vigente,true);assert.equal(calls,1);
 for(let index=0;index<2;index++){t.mock.timers.tick(12000);const next=await sample();assert.ok(next,'La ventana anterior sigue disponible mientras espera el siguiente cálculo.');assert.equal(next.vigente,true);assert.equal(new Date(next.desde).getTime(),new Date(first.desde).getTime());assert.equal(new Date(next.venceAt).getTime(),new Date(first.venceAt).getTime());assert.equal(calls,1);}
 t.mock.timers.tick(12000);const refreshed=await sample();assert.equal(calls,2);assert.ok(new Date(refreshed.calculadaAt)>new Date(first.calculadaAt));
 // A failed provider keeps the last honest window and never renews its expiration.
 routing.calculate=async()=>{calls++;throw new Error('provider unavailable');};t.mock.timers.tick(120000);const expired=await sample();assert.equal(expired.vigente,false);assert.equal(new Date(expired.venceAt).getTime(),new Date(refreshed.venceAt).getTime());
 await deliveries.clearLocation(entrega.id,courier);assert.equal((await deliveries.tracking(pedido.id,buyer)).entrega.estimacion,null);
});
test('reasignación manual y automática conservan cierre sin código de una entrega histórica',async()=>{
 const {pedido,entrega}=await ready({advance:false}),stranger=await db.usuario.findUnique({where:{email:'progress-stranger@example.ec'}});
 // Synthetic pre-015 delivery: the migration defaults existing records to false.
 await db.entrega.update({where:{id:entrega.id},data:{codigoEntregaRequerido:false,codigoEntregaNonce:null}});
 let current=await deliveries.assign({pedidoId:pedido.id,repartidorId:stranger.id,esperadoVersion:entrega.version},admin);assert.equal(current.codigoRequerido,false);
 await db.entrega.update({where:{id:entrega.id},data:{repartidorId:null}});await db.usuario.update({where:{id:courier.id},data:{activo:false}});
 try{await db.$transaction(tx=>deliveries.autoAssign(tx,pedido));}finally{await db.usuario.update({where:{id:courier.id},data:{activo:true}});}
 current=await deliveries.find(entrega.id,stranger);assert.equal(current.repartidorId,stranger.id);assert.equal(current.codigoRequerido,false);assert.equal((await db.entrega.findUnique({where:{id:entrega.id}})).codigoEntregaNonce,null);
 for(const estado of ['en_camino','en_destino','entregada'])current=await deliveries.changeState(entrega.id,{estado,esperadoVersion:current.version},stranger);
 assert.equal(current.estado,'entregada');
});
test('ruta con GPS compartido A e input de navegación B usa A y publica ETA con una sola consulta',async()=>{
 const {pedido,entrega}=await ready(),{createRouting}=require('../../server/models/rutas.cjs'),a={latitud:.1259,longitud:-79.248},b={latitud:.123429,longitud:-79.250469};
 await deliveries.setLocation(entrega.id,{...a,precision:10,registradaAt:new Date().toISOString(),esperadoGpsVersion:entrega.gpsVersion},courier);await db.entrega.update({where:{id:entrega.id},data:{estimadaHasta:null}});let calls=0,origin;
 const service=createRouting({fetch:async url=>{calls++;const coordinates=new URL(url).pathname.split('/').at(-1).split(';').map(value=>value.split(',').map(Number));origin=coordinates[0];return new Response(JSON.stringify({code:'Ok',routes:[{distance:800,duration:180,geometry:{type:'LineString',coordinates}}]}));}});
 await service.calculate(entrega.id,courier,b);assert.equal(calls,1);assert.deepEqual(origin,[-79.248,.1259]);const tracking=(await api.get('/api/pedidos/'+pedido.id+'/seguimiento').set('Authorization',token(buyer)).expect(200)).body.data;
 assert.equal(tracking.entrega.estimacion.vigente,true);assert.equal(tracking.entrega.estimacion.fuente,'OSRM · FOSSGIS');assert.equal(tracking.entrega.ubicacion.latitud,a.latitud);
});
test('sin GPS compartido válido la navegación B conserva su origen y no publica ETA',async()=>{
 const {pedido,entrega}=await ready(),{createRouting}=require('../../server/models/rutas.cjs'),b={latitud:.123429,longitud:-79.250469};let calls=0;
 const service=createRouting({fetch:async url=>{calls++;const coordinates=new URL(url).pathname.split('/').at(-1).split(';').map(value=>value.split(',').map(Number));assert.deepEqual(coordinates[0],[-79.250469,.123429]);return new Response(JSON.stringify({code:'Ok',routes:[{distance:800,duration:180,geometry:{type:'LineString',coordinates}}]}));}});
 await service.calculate(entrega.id,courier,b);assert.equal(calls,1);assert.equal((await deliveries.tracking(pedido.id,buyer)).entrega.estimacion,null);
});
test('retirar el GPS persistido durante OSRM invalida la ruta y no publica ETA ni repite proveedor',async()=>{
 const {pedido,entrega}=await ready(),{createRouting}=require('../../server/models/rutas.cjs');await deliveries.setLocation(entrega.id,{latitud:.1259,longitud:-79.248,precision:10,registradaAt:new Date().toISOString(),esperadoGpsVersion:entrega.gpsVersion},courier);await db.entrega.update({where:{id:entrega.id},data:{estimadaHasta:null}});let calls=0;
 const service=createRouting({fetch:async url=>{calls++;await deliveries.clearLocation(entrega.id,courier);const coordinates=new URL(url).pathname.split('/').at(-1).split(';').map(value=>value.split(',').map(Number));return new Response(JSON.stringify({code:'Ok',routes:[{distance:800,duration:180,geometry:{type:'LineString',coordinates}}]}));}});
 await assert.rejects(()=>service.calculate(entrega.id,courier,{latitud:.123429,longitud:-79.250469}),error=>error.code==='DELIVERY_CHANGED');assert.equal(calls,1);assert.equal((await deliveries.tracking(pedido.id,buyer)).entrega.estimacion,null);
});
