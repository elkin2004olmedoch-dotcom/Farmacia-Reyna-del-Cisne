'use strict';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto'),jwt=require('jsonwebtoken');
const {db,request}=require('./fixture.cjs');
let owner,other,admin,courier;
const headers=user=>({Authorization:'Bearer '+jwt.sign({version:user.tokenVersion},process.env.JWT_SECRET,{subject:user.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'5m'})});
const cancel=(order,user=owner,body={esperadoUpdatedAt:order.updatedAt})=>request.post('/api/pedidos/'+order.id+'/cancelacion').set(user?headers(user):{}).send(body);
before(async()=>{
 admin=await db.usuario.findUnique({where:{email:process.env.ADMIN_EMAIL}});
 const make=role=>db.usuario.create({data:{nombre:'Cliente Cancelación',email:randomUUID()+'@example.ec',telefono:'+593991234567',passwordHash:admin.passwordHash,role}});
 owner=await make('user');other=await make('user');courier=await make('repartidor');
});
after(()=>db.$disconnect());
async function makeOrder({user=owner,delivery=false,lots=false}={}){
 const product=await db.producto.create({data:{nombre:'Cuidado cancelación '+randomUUID(),precio:11.5,stock:20,categoria:'cuidado',tipoProducto:'cuidado',descripcion:'Producto sintético para cancelación',imagen:'assets/images/producto-vitaminas.jpg',alt:'Producto sintético'}});
 if(lots)await db.lote.create({data:{productoId:product.id,numero:randomUUID(),vencimiento:'2099-12-31',stock:20,costoUnitario:5}});
 const comprador={name:user.nombre,email:user.email,phone:'0991234567',documentType:'cedula',document:'0102030400',delivery:delivery?'delivery':'pickup',...(delivery?{province:'Pichincha',city:'Puerto Quito',address:'Calle Sintética 123 frente al parque',latitudEntrega:0.125,longitudEntrega:-79.25,consienteUbicacion:true}:{})};
 if(delivery){const zone=await db.zonaEntrega.create({data:{nombre:'Zona sintética',provincia:'Pichincha',canton:'Puerto Quito',tarifaCentavos:0}});Object.assign(comprador,{zonaEntregaId:zone.id,esperadoTarifaVersion:zone.version});}
 const order=(await request.post('/api/pedidos').set(headers(user)).send({claveSolicitud:randomUUID(),carrito:[{productoId:product.id,cantidad:2}],comprador}).expect(201)).body.data;
 return {order,product};
}
test('cancelación propia autentica, valida cuerpo estricto y nunca concede propiedad al admin',async()=>{
 const {order}=await makeOrder();
 await cancel(order,null).expect(401);await cancel(order,courier).expect(403);
 await cancel(order,other).expect(404);await cancel(order,admin).expect(404);
 for(const body of [{},[],{esperadoUpdatedAt:42},{esperadoUpdatedAt:'ayer'},{esperadoUpdatedAt:'2026-02-30T00:00:00Z'},{esperadoUpdatedAt:'2026-01-01T00:00:00'},...['estado','userId','precio','stock','codigoEntrega'].map(field=>({esperadoUpdatedAt:order.updatedAt,[field]:'inyectado'}))])await cancel(order,owner,body).expect(422);
 await cancel({...order,id:randomUUID()}).expect(404);
 await request.post('/api/pedidos/ID_INVALIDO/cancelacion').set(headers(owner)).send({esperadoUpdatedAt:order.updatedAt}).expect(422);
 const response=await cancel(order).expect(200);assert.equal(response.body.data.estado,'cancelado');
 assert.equal(response.body.replayed,false);assert.ok(!/requestKey|fingerprint|codigoEntrega|Nonce/.test(JSON.stringify(response.body)));
 await cancel(order,other).expect(404);await cancel(order,admin).expect(404);
 const ownAdmin=await makeOrder({user:admin});await cancel(ownAdmin.order,admin).expect(200);
});
test('versión vigente y límite antes de preparado conservan el camino administrativo',async()=>{
 const {order}=await makeOrder();
 let current=(await request.put('/api/pedidos/'+order.id+'/estado').set(headers(admin)).send({estado:'confirmado',esperadoUpdatedAt:order.updatedAt}).expect(200)).body.data;
 assert.equal((await cancel(order).expect(409)).body.error.code,'ORDER_CHANGED');await cancel(current).expect(200);
 for(const state of ['preparado','entregado']){
  const data=await makeOrder();current=data.order;
  for(const estado of ['confirmado','preparado',...(state==='entregado'?['entregado']:[])])current=(await request.put('/api/pedidos/'+current.id+'/estado').set(headers(admin)).send({estado,esperadoUpdatedAt:current.updatedAt}).expect(200)).body.data;
  await cancel(current).expect(409);assert.equal((await db.producto.findUnique({where:{id:data.product.id}})).stock,18);
 }
});
test('doble cancelación concurrente restaura producto y lotes una vez con actor e historial',async()=>{
 const {order,product}=await makeOrder({lots:true});
 const results=await Promise.all([cancel(order),cancel(order)]);assert.deepEqual(results.map(r=>r.status),[200,200]);
 assert.equal(results.filter(r=>r.body.replayed).length,1);await cancel(order).expect(200);
 assert.equal((await db.producto.findUnique({where:{id:product.id}})).stock,20);assert.equal((await db.lote.findFirst({where:{productoId:product.id}})).stock,20);
 const history=await db.pedidoEstado.findMany({where:{pedidoId:order.id,estado:'cancelado'}});assert.equal(history.length,1);assert.equal(history[0].actorId,owner.id);
 const movements=await db.movimientoInventario.findMany({where:{pedidoId:order.id,tipo:'devolucion'}});assert.equal(movements.length,1);assert.equal(movements[0].cantidad,2);assert.equal(movements[0].actorId,owner.id);
});
test('preparación concurrente y cancelación sólo permiten un resultado coherente',async()=>{
 const data=await makeOrder();const order=(await request.put('/api/pedidos/'+data.order.id+'/estado').set(headers(admin)).send({estado:'confirmado',esperadoUpdatedAt:data.order.updatedAt}).expect(200)).body.data;
 const results=await Promise.all([cancel(order),request.put('/api/pedidos/'+order.id+'/estado').set(headers(admin)).send({estado:'preparado',esperadoUpdatedAt:order.updatedAt})]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const stored=await db.pedido.findUnique({where:{id:order.id}});
 assert.equal((await db.producto.findUnique({where:{id:data.product.id}})).stock,stored.estado==='cancelado'?20:18);
 assert.equal(await db.pedidoEstado.count({where:{pedidoId:order.id,estado:'cancelado'}}),stored.estado==='cancelado'?1:0);
});
test('cobros production pendientes y aprobados bloquean sin alterar inventario',async()=>{
 for(const estado of ['pendiente','aprobado']){
  const {order,product}=await makeOrder();await db.pago.create({data:{pedidoId:order.id,entorno:'production',estado,totalCentavos:2300,sinIvaCentavos:2000,baseIvaCentavos:0,ivaCentavos:300,...(estado==='aprobado'?{providerTransactionId:123456,confirmadaAt:new Date()}:{} )}});
  assert.equal((await cancel(order).expect(409)).body.error.code,'PAYMENT_REQUIRES_RECONCILIATION');assert.equal((await db.producto.findUnique({where:{id:product.id}})).stock,18);
 }
});
test('facturas en proceso y autorizadas bloquean; borrador puro permite cancelar',async()=>{
 for(const state of ['EN_PROCESO','AUTORIZADA','BORRADOR']){
  const {order,product}=await makeOrder(),key='1'.repeat(49);
  await db.facturaPedido.create({data:{pedidoId:order.id,estado:state,ambiente:'1',emisorRuc:'1790012345001',establecimiento:'001',puntoEmision:'001',snapshot:'{}',xmlBorrador:'<sintetico/>',...(state==='EN_PROCESO'?{procesandoHasta:new Date(Date.now()+60000)}:{}),...(state==='AUTORIZADA'?{secuencial:1,claveAcceso:key,fechaEmision:new Date(),xmlFirmado:'<sintetico/>',numeroAutorizacion:key,fechaAutorizacion:new Date(),xmlAutorizado:'<sintetico/>'}:{})}});
  const response=await cancel(order).expect(state==='BORRADOR'?200:409);if(state!=='BORRADOR')assert.equal(response.body.error.code,'INVOICE_REQUIRES_RECONCILIATION');
  assert.equal((await db.producto.findUnique({where:{id:product.id}})).stock,state==='BORRADOR'?20:18);
 }
});
test('domicilio cancelado limpia destino, seguimiento, nonce e intentos sin solicitar código',async()=>{
 const {order}=await makeOrder({delivery:true});
 await db.entrega.update({where:{pedidoId:order.id},data:{codigoEntregaRequerido:true,codigoEntregaNonce:'sintetico',codigoIntentos:2,codigoBloqueadoHasta:new Date(Date.now()+60000)}});
 await cancel(order).expect(200);const stored=await db.pedido.findUnique({where:{id:order.id},include:{reparto:true}});
 assert.equal(stored.latitudEntrega,null);assert.equal(stored.longitudEntrega,null);assert.equal(stored.reparto.estado,'cancelada');assert.ok(stored.reparto.finalizadaAt);
 for(const field of ['codigoEntregaNonce','codigoBloqueadoHasta','latitud','longitud','precision','registradaAt','recibidaAt','sesionSeguimientoId','estimadaDesde','estimadaHasta'])assert.equal(stored.reparto[field],null);
 assert.equal(stored.reparto.codigoIntentos,0);assert.equal(stored.reparto.version,2);
});
test('sesión revocada durante la operación no autoriza cancelación',async()=>{
 const {order}=await makeOrder(),sessions=require('../../server/models/sesiones-web.cjs'),{row}=await sessions.create(owner);
 await db.sesionWeb.update({where:{id:row.id},data:{revokedAt:new Date()}});
 await assert.rejects(require('../../server/models/pedidos.cjs').cancelOwn(order.id,{esperadoUpdatedAt:order.updatedAt},{...owner,webSession:row.id}),e=>e.code==='INVALID_TOKEN');
 assert.equal((await db.pedido.findUnique({where:{id:order.id}})).estado,'pendiente');
});
