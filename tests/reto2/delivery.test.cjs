const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {db,request}=require('./fixture.cjs');
const express=require('express'),supertest=require('supertest'),jwt=require('jsonwebtoken');
const settings=require('../../server/config.cjs')();
const app=express();app.use(express.json());app.use('/api',require('../../server/routes/entregas.cjs')(settings));app.use(require('../../server/middleware/errors.cjs').errorHandler);
const api=supertest(app),delivery=require('../../server/models/entregas.cjs');
const sri=require('../../server/models/sri-document.cjs'),sriFixture=require('./sri-fixture.cjs');
const orders=require('../../server/models/pedidos.cjs');
let user,admin,product,driver,otherDriver,otherUser;
const token=u=>jwt.sign({version:u.tokenVersion},settings.secret,{algorithm:'HS256',subject:u.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'5m'});
const auth=u=>'Bearer '+token(u);
const zoneInput={nombre:'Todo Puerto Quito',provincia:'Pichincha',canton:'Puerto Quito',tarifaCentavos:230,ivaCategoria:'general',fundamentoIva:null,activa:true};
const currentZone=()=>db.zonaEntrega.findUnique({where:{id:'puerto-quito'}});
async function tariff(patch={}){const z=await currentZone();return delivery.saveZone(z.id,{...zoneInput,...patch,esperadoVersion:z.version},admin);}
async function advance(order,state){return (await orders.updateStatus(order.id,{estado:state,esperadoUpdatedAt:order.updatedAt.toISOString()},admin.id)).pedido;}
async function assigned({prepared=true}={}){let {pedido}=await create();pedido=await advance(pedido,'confirmado');if(prepared)pedido=await advance(pedido,'preparado');return {pedido,entrega:await delivery.assign({pedidoId:pedido.id,repartidorId:driver.id},admin)};}
const buyer={name:'Cliente Entrega',email:'entrega@example.ec',phone:'0979275988',documentType:'cedula',document:'0102030400',delivery:'delivery',province:'Pichincha',city:'Puerto Quito',address:'Avenida Principal numero 123',postalCode:'',zonaEntregaId:'puerto-quito'};
before(async()=>{
 user=await db.usuario.create({data:{nombre:buyer.name,email:buyer.email,telefono:'+593979275988',passwordHash:'fixture'}});
 admin=await db.usuario.findFirst({where:{role:'admin'}});
 product=await db.producto.create({data:{nombre:'Prueba entrega',precio:11.50,stock:50,categoria:'cuidado',descripcion:'Producto sintético de pruebas',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase'}});
 otherUser=await db.usuario.create({data:{nombre:'Otro Cliente',email:'otro-entrega@example.ec',telefono:'+593979275988',passwordHash:'fixture'}});
});
const create=async(patch={})=>orders.create(user.id,{carrito:[{productoId:product.id,cantidad:1}],comprador:{...buyer,esperadoTarifaVersion:(await currentZone()).version,...patch},claveSolicitud:randomUUID()});
test('domicilio rechaza tarifa inicial pendiente sin reservar stock',async()=>{
 await assert.rejects(()=>create(),e=>e.code==='DELIVERY_RATE_PENDING');
 assert.equal((await db.producto.findUnique({where:{id:product.id}})).stock,50);
});
test('tarifa administrable: control de rol, campos, versión, historial e IVA legal',async()=>{
 await api.get('/api/admin/zonas-entrega').expect(401);
 await api.post('/api/admin/zonas-entrega').set('Authorization',auth(user)).send(zoneInput).expect(403);
 const z=await currentZone();
 for(const patch of [{tarifaCentavos:'230'},{tarifaCentavos:-1},{ivaCategoria:'cero',fundamentoIva:null},{ivaCategoria:'cero',fundamentoIva:'<script>'},{activa:'true'}])await api.put('/api/admin/zonas-entrega/'+z.id).set('Authorization',auth(admin)).send({...zoneInput,esperadoVersion:z.version,...patch}).expect(422);
 const changed=await api.put('/api/admin/zonas-entrega/'+z.id).set('Authorization',auth(admin)).send({...zoneInput,esperadoVersion:z.version}).expect(200);
 assert.equal(changed.body.data.version,2);
 await api.put('/api/admin/zonas-entrega/'+z.id).set('Authorization',auth(admin)).send({...zoneInput,esperadoVersion:z.version}).expect(409);
 const history=(await api.get('/api/admin/zonas-entrega').set('Authorization',auth(admin)).expect(200)).body.data[0].tarifas;
 assert.equal(history.length,2);assert.equal(history[0].actorId,admin.id);assert.equal(history[1].tarifaCentavos,null);
 const pub=await api.get('/api/zonas-entrega').expect(200);assert.equal(pub.headers['cache-control'],'no-store');assert.equal(pub.body.data[0].tarifas,undefined);
});
test('cobertura, subtotal, snapshot de IVA y factura permanecen tras cambiar tarifa',async()=>{
 for(const patch of [{city:'Quito'},{province:'Esmeraldas'},{zonaEntregaId:'otro'},{zonaEntregaId:undefined}])await assert.rejects(()=>create(patch),e=>e.code==='DELIVERY_OUTSIDE_COVERAGE');
 const {pedido}=await create();assert.equal(Number(pedido.subtotalProductos),11.5);assert.equal(Number(pedido.total),13.8);assert.equal(pedido.costoEnvioCentavos,230);assert.equal(Number(pedido.envioBaseImponible),2);assert.equal(Number(pedido.envioIvaMonto),.3);
 const snapshot=sri.snapshot(pedido,sriFixture.buyer,sriFixture.emitter);assert.equal(snapshot.lineas[1].codigo,'SERV-ENVIO');assert.equal(snapshot.total,1380);assert.equal(snapshot.iva,180);
 await tariff({tarifaCentavos:500});assert.equal((await db.pedido.findUnique({where:{id:pedido.id}})).costoEnvioCentavos,230);
 assert.deepEqual(sri.snapshot(await db.pedido.findUnique({where:{id:pedido.id},include:{detalles:true}}),sriFixture.buyer,sriFixture.emitter),snapshot);
 await tariff({tarifaCentavos:0});const free=(await create()).pedido;assert.equal(free.costoEnvioCentavos,0);assert.equal(Number(free.total),11.5);assert.equal(sri.snapshot(free,sriFixture.buyer,sriFixture.emitter).lineas.length,2);
 await tariff({tarifaCentavos:200,ivaCategoria:'cero',fundamentoIva:'Referencia de prueba sintética sin validez legal'});const exempt=(await create()).pedido;assert.equal(exempt.envioIvaPorcentaje,0);assert.equal(Number(exempt.envioIvaMonto),0);assert.equal(sri.snapshot(exempt,sriFixture.buyer,sriFixture.emitter).lineas[1].base,200);
 await tariff();
});
test('comprador exige consentimiento y coordenadas numéricas emparejadas solo a domicilio',async()=>{
 buyer.esperadoTarifaVersion=(await currentZone()).version;
 for(const patch of [{latitudEntrega:0,longitudEntrega:-79},{latitudEntrega:'0',longitudEntrega:-79,consienteUbicacion:true},{latitudEntrega:91,longitudEntrega:-79,consienteUbicacion:true},{latitudEntrega:0,consienteUbicacion:true},{delivery:'pickup',zonaEntregaId:undefined,latitudEntrega:0,longitudEntrega:-79,consienteUbicacion:true}])await request.post('/api/pedidos').set('Authorization',auth(user)).send({carrito:[{productoId:product.id,cantidad:1}],comprador:{...buyer,...patch},claveSolicitud:randomUUID()}).expect(422);
 const response=await request.post('/api/pedidos').set('Authorization',auth(user)).send({carrito:[{productoId:product.id,cantidad:1}],comprador:{...buyer,latitudEntrega:0,longitudEntrega:-79,consienteUbicacion:true},claveSolicitud:randomUUID()}).expect(201);
 assert.equal(response.body.data.latitudEntrega,0);assert.ok(response.body.data.ubicacionEntregaAceptadaAt);
});
test('cambiar tarifa entre cotización y confirmación rechaza sin pedido ni reserva',async()=>{
 const quoted=await currentZone();
 const beforeStock=(await db.producto.findUnique({where:{id:product.id}})).stock,beforeOrders=await db.pedido.count({where:{userId:user.id}});
 await tariff({tarifaCentavos:quoted.tarifaCentavos+100});
 try{
  await assert.rejects(()=>create({esperadoTarifaVersion:quoted.version}),e=>e.code==='DELIVERY_RATE_CHANGED');
  assert.equal((await db.producto.findUnique({where:{id:product.id}})).stock,beforeStock);
  assert.equal(await db.pedido.count({where:{userId:user.id}}),beforeOrders);
 }finally{await tariff({tarifaCentavos:quoted.tarifaCentavos});}
});
test('reintento idempotente devuelve snapshot histórico aunque cambie tarifa',async()=>{
 const quoted=await currentZone(),input={carrito:[{productoId:product.id,cantidad:1}],comprador:{...buyer,esperadoTarifaVersion:quoted.version},claveSolicitud:randomUUID()};
 const first=await orders.create(user.id,input),beforeStock=(await db.producto.findUnique({where:{id:product.id}})).stock;
 await tariff({tarifaCentavos:quoted.tarifaCentavos+100});
 try{
  const replay=await orders.create(user.id,input);
  assert.equal(replay.replayed,true);assert.equal(replay.pedido.id,first.pedido.id);assert.equal(replay.pedido.costoEnvioCentavos,quoted.tarifaCentavos);
  assert.equal((await db.producto.findUnique({where:{id:product.id}})).stock,beforeStock);
 }finally{await tariff({tarifaCentavos:quoted.tarifaCentavos});}
});
test('API exige versión de tarifa numérica positiva en domicilio y devuelve 409 para cotización antigua',async()=>{
 const quoted=await currentZone(),input={carrito:[{productoId:product.id,cantidad:1}],comprador:{...buyer,esperadoTarifaVersion:quoted.version},claveSolicitud:randomUUID()};
 for(const version of [undefined,null,0,-1,1.5,'1'])await request.post('/api/pedidos').set('Authorization',auth(user)).send({...input,comprador:{...input.comprador,esperadoTarifaVersion:version}}).expect(422);
 await tariff({tarifaCentavos:quoted.tarifaCentavos+100});
 try{
  const response=await request.post('/api/pedidos').set('Authorization',auth(user)).send(input).expect(409);
  assert.equal(response.body.error.code,'DELIVERY_RATE_CHANGED');
 }finally{await tariff({tarifaCentavos:quoted.tarifaCentavos});}
});
test('cerrar elimina el punto preciso del comprador y del repartidor conservando consentimiento',async()=>{
 await tariff();
 for(const estado of ['entregado','cancelado']){
  let {pedido}=await create({latitudEntrega:.25,longitudEntrega:-79.2,consienteUbicacion:true});
  const accepted=pedido.ubicacionEntregaAceptadaAt;
  pedido=await advance(pedido,'confirmado');pedido=await advance(pedido,'preparado');
  if(estado==='entregado'){
   // Direct fixture only supplies the minimum closed-path delivery state.
   await db.entrega.create({data:{pedidoId:pedido.id,estado:'en_destino',latitud:.3,longitud:-79.1,precision:5,registradaAt:new Date(),recibidaAt:new Date()}});
  }else await db.entrega.create({data:{pedidoId:pedido.id,estado:'en_camino',latitud:.3,longitud:-79.1,precision:5,registradaAt:new Date(),recibidaAt:new Date()}});
  pedido=await advance(pedido,estado);
  assert.equal(pedido.latitudEntrega,null);assert.equal(pedido.longitudEntrega,null);assert.equal(pedido.ubicacionEntregaAceptadaAt.getTime(),accepted.getTime());assert.equal(pedido.direccion,buyer.address);
  const e=await db.entrega.findUnique({where:{pedidoId:pedido.id}});assert.equal(e.latitud,null);assert.equal(e.longitud,null);
 }
});
test('creación de repartidores usa hash, rol fijo y revocación de tokens',async()=>{
 const input={nombre:'Repartidor Prueba',email:'driver@example.ec',telefono:'0979275988',password:'EntregaPrueba2026!'};
 await api.post('/api/admin/repartidores').set('Authorization',auth(user)).send(input).expect(403);
 await api.post('/api/admin/repartidores').set('Authorization',auth(admin)).send({...input,role:'admin'}).expect(422);
 const created=(await api.post('/api/admin/repartidores').set('Authorization',auth(admin)).send(input).expect(201)).body.data;assert.equal(created.passwordHash,undefined);
 driver=await db.usuario.findUnique({where:{id:created.id}});assert.equal(driver.role,'repartidor');assert.ok(await require('bcrypt').compare(input.password,driver.passwordHash));
 otherDriver=await db.usuario.create({data:{nombre:'Otro Repartidor',email:'driver2@example.ec',telefono:'+593979275988',passwordHash:'fixture',role:'repartidor'}});
 await request.post('/api/pedidos').set('Authorization',auth(driver)).send({}).expect(403);
 await request.post('/api/auth/register').send({nombre:'Nuevo Cliente',email:'evil-role@example.ec',telefono:input.telefono,cedula:buyer.document,password:input.password,role:'repartidor'}).expect(422);
 await api.put('/api/admin/repartidores/'+otherDriver.id).set('Authorization',auth(admin)).send({activo:false}).expect(200);
 await api.get('/api/entregas').set('Authorization',auth(otherDriver)).expect(401);
 await api.put('/api/admin/repartidores/'+otherDriver.id).set('Authorization',auth(admin)).send({activo:true}).expect(200);
 otherDriver=await db.usuario.findUnique({where:{id:otherDriver.id}});
});
test('asignación y estados respetan propietario, preparación, versiones y DTO mínimo',async()=>{
 let {pedido,entrega}=await assigned({prepared:false});
 assert.equal(entrega.destino.nombre,buyer.name);assert.equal(entrega.destino.email,undefined);assert.equal(entrega.total,undefined);assert.equal(entrega.detalles,undefined);
 assert.deepEqual(await delivery.assign({pedidoId:pedido.id,repartidorId:driver.id},admin),entrega);
 await api.put('/api/entregas/'+entrega.id+'/estado').set('Authorization',auth(otherDriver)).send({estado:'en_camino',esperadoVersion:entrega.version}).expect(404);
 await api.get('/api/pedidos/'+pedido.id+'/seguimiento').set('Authorization',auth(otherUser)).expect(404);
 await api.get('/api/pedidos/'+pedido.id+'/seguimiento').set('Authorization',auth(driver)).expect(403);
 await assert.rejects(()=>delivery.changeState(entrega.id,{estado:'en_camino',esperadoVersion:entrega.version},driver),e=>e.code==='ORDER_NOT_READY');
 pedido=await advance(pedido,'preparado');
 await assert.rejects(()=>advance(pedido,'entregado'),e=>e.code==='DELIVERY_NOT_ARRIVED');
 entrega=await delivery.changeState(entrega.id,{estado:'en_camino',esperadoVersion:entrega.version},driver);
 await assert.rejects(()=>delivery.assign({pedidoId:pedido.id,repartidorId:otherDriver.id,esperadoVersion:entrega.version},admin),e=>e.code==='DELIVERY_ALREADY_STARTED');
 await assert.rejects(()=>delivery.setDriverActive(driver.id,false,admin),e=>e.code==='DRIVER_HAS_ACTIVE_DELIVERY');
 await assert.rejects(()=>delivery.changeState(entrega.id,{estado:'en_destino',esperadoVersion:1},driver),e=>e.code==='DELIVERY_CHANGED');
 entrega=await delivery.changeState(entrega.id,{estado:'en_destino',esperadoVersion:entrega.version},driver);
 entrega=await delivery.changeState(entrega.id,{estado:'entregada',esperadoVersion:entrega.version},driver);
 assert.equal(entrega.destino,null);assert.equal(entrega.estadoPedido,'entregado');assert.equal(entrega.ubicacion,null);
 assert.deepEqual(await delivery.changeState(entrega.id,{estado:'entregada',esperadoVersion:1},driver),entrega);
 assert.equal(await db.pedidoEstado.count({where:{pedidoId:pedido.id,estado:'entregado'}}),1);
 const mine=(await api.get('/api/entregas').set('Authorization',auth(otherDriver)).expect(200)).body.data;assert.equal(mine.total,0);
});
test('GPS valida fechas, orden, frecuencia y propiedad; TTL, retiro y cierre eliminan datos',async()=>{
 let {pedido,entrega}=await assigned();entrega=await delivery.changeState(entrega.id,{estado:'en_camino',esperadoVersion:entrega.version},driver);
 const sample={latitud:.12,longitud:-79.23,precision:15,registradaAt:new Date().toISOString(),esperadoGpsVersion:0};
 const route='/api/entregas/'+entrega.id+'/ubicacion';
 for(const patch of [{latitud:'0'},{latitud:91},{longitud:181},{precision:-1},{registradaAt:'tomorrow'},{esperadoGpsVersion:'0'}])await api.put(route).set('Authorization',auth(driver)).send({...sample,...patch}).expect(422);
 await api.put(route).set('Authorization',auth(otherDriver)).send(sample).expect(404);
 for(const seconds of [-121,16])await api.put(route).set('Authorization',auth(driver)).send({...sample,registradaAt:new Date(Date.now()+seconds*1000).toISOString()}).expect(409);
 let response=await api.put(route).set('Authorization',auth(driver)).send(sample).expect(200);assert.equal(response.body.data.gpsVersion,1);
 await api.put(route).set('Authorization',auth(driver)).send(sample).expect(409);
 await api.put(route).set('Authorization',auth(driver)).send({...sample,esperadoGpsVersion:1,registradaAt:new Date(Date.now()+1000).toISOString()}).expect(429);
 const tracking=await delivery.tracking(pedido.id,user);assert.equal(tracking.entrega.ubicacion.latitud,sample.latitud);assert.equal(tracking.entrega.repartidorId,undefined);
 await db.entrega.update({where:{id:entrega.id},data:{registradaAt:new Date(Date.now()-121000),recibidaAt:new Date(Date.now()-121000)}});
 assert.equal((await delivery.tracking(pedido.id,user)).entrega.ubicacion,null);
 await delivery.purgeExpiredLocations(new Date(Date.now()+16*60000));assert.equal((await db.entrega.findUnique({where:{id:entrega.id}})).latitud,null);
 response=await api.delete(route).set('Authorization',auth(driver)).expect(200);assert.equal(response.body.data.ubicacion,null);
 const gpsVersion=response.body.data.gpsVersion;
 await api.put(route).set('Authorization',auth(driver)).send({...sample,esperadoGpsVersion:gpsVersion,registradaAt:new Date().toISOString()}).expect(200);
 await orders.updateStatus(pedido.id,{estado:'cancelado',esperadoUpdatedAt:pedido.updatedAt.toISOString()},admin.id);
 const closed=await db.entrega.findUnique({where:{id:entrega.id}});assert.equal(closed.estado,'cancelada');assert.equal(closed.latitud,null);
 await api.put(route).set('Authorization',auth(driver)).send({...sample,esperadoGpsVersion:gpsVersion+1}).expect(409);
});
test('cancelar desde reparto devuelve inventario una sola vez y respeta factura emitida',async()=>{
 let {pedido,entrega}=await assigned();const stock=(await db.producto.findUnique({where:{id:product.id}})).stock;
 await db.facturaPedido.create({data:{pedidoId:pedido.id,ambiente:'1',emisorRuc:sriFixture.emitter.ruc,establecimiento:'001',puntoEmision:'001',secuencial:1,claveAcceso:'1'.repeat(49),fechaEmision:new Date(),snapshot:'{}',xmlBorrador:'<fixture/>'}});
 await assert.rejects(()=>delivery.changeState(entrega.id,{estado:'cancelada',esperadoVersion:entrega.version},admin),e=>e.code==='INVOICE_REQUIRES_RECONCILIATION');
 assert.equal((await db.entrega.findUnique({where:{id:entrega.id}})).estado,'asignada');assert.equal((await db.producto.findUnique({where:{id:product.id}})).stock,stock);
 const second=await assigned();const before=(await db.producto.findUnique({where:{id:product.id}})).stock;
 await delivery.changeState(second.entrega.id,{estado:'cancelada',esperadoVersion:second.entrega.version},admin);
 await delivery.changeState(second.entrega.id,{estado:'cancelada',esperadoVersion:second.entrega.version},admin);
 assert.equal((await db.producto.findUnique({where:{id:product.id}})).stock,before+1);assert.equal(await db.movimientoInventario.count({where:{pedidoId:second.pedido.id,tipo:'devolucion'}}),1);
});
test('carrera entregar/cancelar conserva un único cierre atómico',async()=>{
 let {pedido,entrega}=await assigned();entrega=await delivery.changeState(entrega.id,{estado:'en_camino',esperadoVersion:entrega.version},driver);entrega=await delivery.changeState(entrega.id,{estado:'en_destino',esperadoVersion:entrega.version},driver);
 const before=(await db.producto.findUnique({where:{id:product.id}})).stock;
 const results=await Promise.allSettled([delivery.changeState(entrega.id,{estado:'entregada',esperadoVersion:entrega.version},driver),orders.updateStatus(pedido.id,{estado:'cancelado',esperadoUpdatedAt:pedido.updatedAt.toISOString()},admin.id)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const current=await db.pedido.findUnique({where:{id:pedido.id},include:{reparto:true}});assert.equal(current.reparto.estado,current.estado==='entregado'?'entregada':'cancelada');
 assert.equal((await db.producto.findUnique({where:{id:product.id}})).stock,before+(current.estado==='cancelado'?1:0));
});
test('desactivar repartidor asignado lo desasigna y permite reasignar con versión nueva',async()=>{
 const {entrega}=await assigned();
 // Remaining active assignment from the invoice test is also safely unassigned.
 await delivery.setDriverActive(driver.id,false,admin);
 const e=await db.entrega.findUnique({where:{id:entrega.id}});assert.equal(e.repartidorId,null);assert.equal(e.version,entrega.version+1);
 await assert.rejects(()=>delivery.assign({pedidoId:e.pedidoId,repartidorId:driver.id,esperadoVersion:e.version},admin),x=>x.code==='DRIVER_UNAVAILABLE');
 assert.equal((await delivery.assign({pedidoId:e.pedidoId,repartidorId:otherDriver.id,esperadoVersion:e.version},admin)).repartidorId,otherDriver.id);
});
test('base de datos rechaza tarifas fraccionarias, booleanos inválidos y snapshot incompleto',async()=>{
 await assert.rejects(()=>db.$executeRawUnsafe('UPDATE "ZonaEntrega" SET "tarifaCentavos"=1.5 WHERE "id"=?','puerto-quito'));
 await assert.rejects(()=>db.$executeRawUnsafe('UPDATE "Producto" SET "controlado"=2 WHERE "id"=?',product.id));
 await assert.rejects(()=>db.$executeRawUnsafe('UPDATE "ZonaEntrega" SET "ivaCategoria"=\'cero\',"fundamentoIva"=NULL WHERE "id"=?','puerto-quito'));
 const order=await db.pedido.findFirst({where:{userId:user.id}});
 await assert.rejects(()=>db.pedido.update({where:{id:order.id},data:{envioBaseImponible:null}}));
 await assert.rejects(()=>db.pedido.update({where:{id:order.id},data:{latitudEntrega:0,longitudEntrega:0,ubicacionEntregaAceptadaAt:null}}));
});
test('un lote que vence tras preparar impide iniciar reparto y permite cancelar con trazabilidad',async()=>{
 const p=await db.producto.create({data:{nombre:'Entrega con lote',precio:10,stock:1,categoria:'cuidado',descripcion:'Fixture sintética trazable',imagen:product.imagen,alt:'Envase'}});
 const lot=await db.lote.create({data:{productoId:p.id,numero:'ENTREGA-TEST',vencimiento:'2099-01-01',stock:1,costoUnitario:1}});
 let {pedido}=await orders.create(user.id,{carrito:[{productoId:p.id,cantidad:1}],comprador:{...buyer,esperadoTarifaVersion:(await currentZone()).version},claveSolicitud:randomUUID()});pedido=await advance(pedido,'confirmado');pedido=await advance(pedido,'preparado');
 const e=await delivery.assign({pedidoId:pedido.id,repartidorId:otherDriver.id},admin);
 await db.lote.update({where:{id:lot.id},data:{vencimiento:'2020-01-01'}});
 await assert.rejects(()=>delivery.changeState(e.id,{estado:'en_camino',esperadoVersion:e.version},otherDriver),x=>x.code==='LOT_EXPIRED_ORDER');
 await delivery.changeState(e.id,{estado:'cancelada',esperadoVersion:e.version},admin);
 assert.equal((await db.lote.findUnique({where:{id:lot.id}})).stock,1);
});
after(()=>db.$disconnect());
