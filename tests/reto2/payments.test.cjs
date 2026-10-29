'use strict';
const {test,after,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const jwt=require('jsonwebtoken');
const fs=require('node:fs');
const {app,db,directory}=require('./fixture.cjs');
let request=require('supertest')(app);
beforeEach(()=>{request=require('supertest')(require('../../server/app.cjs')());});
const originalFetch=global.fetch;
const envNames=['PAYPHONE_ENABLED','PAYPHONE_TOKEN','PAYPHONE_STORE_ID','PAYPHONE_ENVIRONMENT','PAYMENT_PUBLIC_ORIGIN','PAYMENT_API_ORIGIN'];
const originalEnv=Object.fromEntries(envNames.map(name=>[name,process.env[name]]));
function disabled(){for(const name of envNames)delete process.env[name];}
function enabled(environment='sandbox') {Object.assign(process.env,{PAYPHONE_ENABLED:'true',PAYPHONE_TOKEN:'synthetic-private-token',PAYPHONE_STORE_ID:randomUUID(),PAYPHONE_ENVIRONMENT:environment,PAYMENT_PUBLIC_ORIGIN:'https://tienda.example.ec',PAYMENT_API_ORIGIN:'https://api.example.ec',CORS_ORIGIN:'http://localhost:3000,https://tienda.example.ec'});}
function gateway(confirmResponse) {
 const calls=[],paymentId=randomUUID();
 global.fetch=async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body,options});return new Response(JSON.stringify(url.endsWith('/Prepare')?{paymentId,payWithCard:`https://pay.payphonetodoesposible.com/Anonymous/Index?paymentId=${paymentId}`}:typeof confirmResponse==='function'?confirmResponse(body):confirmResponse),{status:200});};
 return calls;
}
let user,other,driver,admin;
function auth(user){return 'Bearer '+jwt.sign({version:user.tokenVersion},process.env.JWT_SECRET,{subject:user.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'10m'});}
async function order(patch={}) {
 const product=await db.producto.findFirst();
 return db.pedido.create({data:{userId:user.id,total:14.8,subtotalProductos:12.5,costoEnvioCentavos:230,envioIvaPorcentaje:15,envioBaseImponible:2,envioIvaMonto:.3,baseImponible:13,ivaMonto:1.8,entrega:'pickup',nombre:'Comprador privado',email:'privado@example.ec',telefono:'0979275988',documento:'••••••0400',requestKey:randomUUID(),fingerprint:'synthetic',detalles:{create:[{productoId:product.id,nombreProducto:'Producto general',cantidad:1,precioUnitario:11.5,totalLinea:11.5,ivaPorcentaje:15,baseImponible:10,ivaMonto:1.5},{productoId:(await db.producto.findFirst({where:{id:{not:product.id}}})).id,nombreProducto:'Producto cero',cantidad:1,precioUnitario:1,totalLinea:1,ivaPorcentaje:0,baseImponible:1,ivaMonto:0}]},...patch}});
}
test('pago desactivado conserva pedidos y no expone credenciales',async()=>{
 disabled();
 [user,other,driver,admin]=await Promise.all(['user','user','repartidor','admin'].map((role,index)=>db.usuario.create({data:{nombre:'Prueba de pago',email:`pago-${index}@example.ec`,telefono:'0979275988',passwordHash:'synthetic-unused',role}})));
 const response=await request.get('/api/pagos/configuracion').expect(200);
 assert.deepEqual(response.body.data,{payphone:{disponible:false,entorno:null},demostracion:true,moneda:'USD'});
 const pedido=await order();
 await request.post(`/api/pedidos/${pedido.id}/pago/payphone`).set('Authorization',auth(user)).send({}).expect(503);
 assert.equal(await db.pago.count(),0);
 assert.equal((await db.pedido.findUnique({where:{id:pedido.id}})).estado,'pendiente');
});
test('pago exige propietario o administrador, rechaza repartidor y campos de importe/tarjeta',async()=>{
 disabled();const pedido=await order(),route=`/api/pedidos/${pedido.id}/pago`;
 await request.get(route).expect(401);
 await request.get(route).set('Authorization',auth(other)).expect(404);
 await request.get(route).set('Authorization',auth(driver)).expect(403);
 const summary=(await request.get(route).set('Authorization',auth(admin)).expect(200)).body.data;
 assert.equal(summary.pedido.totalCentavos,1480);assert.equal(summary.pedido.subtotalCentavos,1250);assert.equal(summary.pedido.costoEnvioCentavos,230);assert.equal(summary.pedido.ivaCentavos,180);
 assert.deepEqual(summary.pedido.detalles.map(x=>x.totalCentavos).sort((a,b)=>a-b),[100,1150]);
 assert.equal(summary.pago,null);assert.equal(summary.pedido.email,undefined);
 for(const body of [{amount:1},{tarjeta:'1234'},{token:'secret'}])await request.post(route+'/payphone').set('Authorization',auth(user)).send(body).expect(422);
});
test('PayPhone cerrado ante credenciales incompletas y orígenes manipulados',async()=>{
 for(const patch of [{PAYPHONE_TOKEN:''},{PAYPHONE_STORE_ID:'bad'},{PAYMENT_PUBLIC_ORIGIN:'https://evil.example.ec'},{PAYMENT_PUBLIC_ORIGIN:'https://tienda.example.ec/ruta'},{PAYMENT_API_ORIGIN:'http://api.example.ec'},{PAYPHONE_ENVIRONMENT:'unknown'}]) {
  enabled();Object.assign(process.env,patch);assert.equal((await request.get('/api/pagos/configuracion').expect(200)).body.data.payphone.disponible,false);
 }
});
test('página de pagos comunica solo el origen a PayPhone y conserva CSP',async()=>{
 const response=await request.get('/pagos.html').expect(200);
 assert.equal(response.headers['referrer-policy'],'strict-origin-when-cross-origin');
 assert.ok(response.headers['content-security-policy'].includes("default-src 'self'"));
 assert.equal((await request.get('/catalogo.html').expect(200)).headers['referrer-policy'],'no-referrer');
});
test('inicio concurrente prepara una vez el total e IVA histórico y reutiliza el enlace',async()=>{
 enabled();const calls=gateway(),pedido=await order(),route=`/api/pedidos/${pedido.id}/pago/payphone`;
 const results=await Promise.all([request.post(route).set('Authorization',auth(user)).send({}),request.post(route).set('Authorization',auth(user)).send({})]);
 assert.deepEqual(results.map(x=>x.status).sort(),[200,201]);assert.equal(calls.length,1);
 const pago=await db.pago.findUnique({where:{pedidoId:pedido.id}}),payload=calls[0].body;
 assert.deepEqual([payload.amount,payload.amountWithoutTax,payload.amountWithTax,payload.tax,payload.service,payload.tip,payload.currency],[1480,100,1200,180,0,0,'USD']);
 assert.equal(payload.clientTransactionId,pago.id);assert.equal(payload.responseUrl,'https://api.example.ec/api/pagos/payphone/respuesta');assert.equal(payload.cancellationUrl,`https://tienda.example.ec/pagos.html?pedido=${pedido.id}`);
 assert.equal(calls[0].url,'https://pay.payphonetodoesposible.com/api/button/Prepare');assert.equal(calls[0].options.redirect,'error');assert.ok(calls[0].options.signal);
 assert.equal(pago.estado,'pendiente');assert.equal((await db.pedido.findUnique({where:{id:pedido.id}})).estado,'pendiente');assert.equal(await db.facturaPedido.count({where:{pedidoId:pedido.id}}),0);
 const replay=await request.post(route).set('Authorization',auth(user)).send({}).expect(200);assert.match(replay.body.data.pago.urlPago,/^https:\/\/pay\.payphonetodoesposible\.com\/Anonymous\/Index/);assert.equal(calls.length,1);
 assert.ok(!JSON.stringify(replay.body).includes('synthetic-private-token'));
});
test('pedido cerrado o con fiscalidad antigua no prepara pagos',async()=>{
 enabled();const calls=gateway();
 for(const patch of [{estado:'cancelado'},{ivaMonto:null,baseImponible:null}]) {const pedido=await order(patch);await request.post(`/api/pedidos/${pedido.id}/pago/payphone`).set('Authorization',auth(user)).send({}).expect(409);assert.equal(await db.pago.count({where:{pedidoId:pedido.id}}),0);}
 assert.equal(calls.length,0);
});
test('SQLite rechaza centavos fraccionarios incluso fuera de Prisma',async()=>{
 const pedido=await order();
 await assert.rejects(db.$executeRawUnsafe('INSERT INTO "Pago" ("id","pedidoId","entorno","totalCentavos","sinIvaCentavos","baseIvaCentavos","ivaCentavos","createdAt","updatedAt") VALUES (?, ?, \'sandbox\',1480.5,100,1200.5,180,?,?)',randomUUID(),pedido.id,Date.now(),Date.now()));
 assert.equal(await db.pago.count({where:{pedidoId:pedido.id}}),0);
});
test('una URL ajena o fallo ambiguo deja revisión y nunca repite Prepare',async()=>{
 enabled();let calls=0;global.fetch=async()=>{calls++;return new Response(JSON.stringify({paymentId:'synthetic',payWithCard:'https://evil.example.ec/?paymentId=synthetic'}));};
 const pedido=await order(),route=`/api/pedidos/${pedido.id}/pago/payphone`;
 const result=(await request.post(route).set('Authorization',auth(user)).send({}).expect(201)).body.data;
 assert.equal(result.pago.estado,'revision');assert.equal(result.pago.urlPago,null);
 await request.post(route).set('Authorization',auth(user)).send({}).expect(200);assert.equal(calls,1);
});
test('la referencia de pago alojado no se puede reutilizar para otro pedido',async()=>{
 enabled();const calls=gateway(),first=await order(),second=await order();
 await request.post(`/api/pedidos/${first.id}/pago/payphone`).set('Authorization',auth(user)).send({}).expect(201);
 const response=(await request.post(`/api/pedidos/${second.id}/pago/payphone`).set('Authorization',auth(user)).send({}).expect(201)).body.data;
 assert.equal(response.pago.estado,'revision');assert.equal(response.pago.urlPago,null);assert.equal(calls.length,2);
});
test('retorno verificado aprueba solo pago sandbox y replay no confirma de nuevo ni emite factura',async()=>{
 enabled();const pedido=await order(),calls=gateway(body=>({transactionId:body.id,clientTransactionId:body.clientTxId,amount:1480,currency:'USD',statusCode:3,transactionStatus:'Approved'}));
 await request.post(`/api/pedidos/${pedido.id}/pago/payphone`).set('Authorization',auth(user)).send({}).expect(201);
 const pago=await db.pago.findUnique({where:{pedidoId:pedido.id}}),url=`/api/pagos/payphone/respuesta?id=10001&clientTransactionId=${pago.id}`;
 const returns=await Promise.all([request.get(url),request.get(url)]);assert.deepEqual(returns.map(x=>x.status),[303,303]);
 assert.equal(returns[0].headers.location,`https://tienda.example.ec/pagos.html?pedido=${pedido.id}`);assert.equal(returns[0].headers['referrer-policy'],'no-referrer');
 assert.equal(calls.length,2);assert.deepEqual(calls[1].body,{id:10001,clientTxId:pago.id});assert.equal(calls[1].url,'https://pay.payphonetodoesposible.com/api/button/V2/Confirm');
 assert.equal((await db.pago.findUnique({where:{id:pago.id}})).estado,'aprobado');
 await assert.rejects(db.pago.update({where:{id:pago.id},data:{providerTransactionId:99999}}));
 const current=await db.pedido.findUnique({where:{id:pedido.id}});assert.equal(current.estado,'pendiente');assert.equal(await db.facturaPedido.count({where:{pedidoId:pedido.id}}),0);
 await request.put(`/api/pedidos/${pedido.id}/estado`).set('Authorization',auth(admin)).send({estado:'cancelado',esperadoUpdatedAt:current.updatedAt.toISOString()}).expect(200);
});
test('callback ajeno, repetido, manipulado o con importe distinto nunca aprueba',async()=>{
 enabled();const calls=gateway(body=>({transactionId:body.id,clientTransactionId:body.clientTxId,amount:1,currency:'USD',statusCode:3,transactionStatus:'Approved'}));
 await request.get('/api/pagos/payphone/respuesta?id=123&clientTransactionId='+randomUUID()).expect(404);assert.equal(calls.length,0);
 const pedido=await order();await request.post(`/api/pedidos/${pedido.id}/pago/payphone`).set('Authorization',auth(user)).send({}).expect(201);
 const pago=await db.pago.findUnique({where:{pedidoId:pedido.id}}),url=`/api/pagos/payphone/respuesta?id=10002&clientTransactionId=${pago.id}`;
 await request.get(url+'&redirect=https://evil.example.ec').expect(422);assert.equal(calls.length,1);
 await request.get(url).expect(303);await request.get(url).expect(303);assert.equal(calls.length,2);assert.equal((await db.pago.findUnique({where:{id:pago.id}})).estado,'revision');
});
test('pago production en proceso bloquea cancelación y snapshot no se puede reescribir',async()=>{
 enabled('production');gateway();const pedido=await order();await request.post(`/api/pedidos/${pedido.id}/pago/payphone`).set('Authorization',auth(user)).send({}).expect(201);
 const current=await db.pedido.findUnique({where:{id:pedido.id}}),pago=await db.pago.findUnique({where:{pedidoId:pedido.id}});
 const response=await request.put(`/api/pedidos/${pedido.id}/estado`).set('Authorization',auth(admin)).send({estado:'cancelado',esperadoUpdatedAt:current.updatedAt.toISOString()}).expect(409);assert.equal(response.body.error.code,'PAYMENT_REQUIRES_RECONCILIATION');
 await assert.rejects(db.pago.update({where:{id:pago.id},data:{totalCentavos:1500,baseIvaCentavos:1220}}));
 assert.equal((await db.pago.findUnique({where:{id:pago.id}})).totalCentavos,1480);
});
test('respuesta con moneda, referencia o estado incoherente y timeout quedan en revisión sin reintentos',async()=>{
 enabled();let transactionId=21000;
 for(const patch of [{currency:'EUR'},{transactionId:90000},{transactionStatus:'Canceled'}]) {
  const calls=gateway(body=>({transactionId:body.id,clientTransactionId:body.clientTxId,amount:1480,currency:'USD',statusCode:3,transactionStatus:'Approved',...patch})),pedido=await order();
  await request.post(`/api/pedidos/${pedido.id}/pago/payphone`).set('Authorization',auth(user)).send({}).expect(201);
  const pago=await db.pago.findUnique({where:{pedidoId:pedido.id}}),id=transactionId++;
  await request.get(`/api/pagos/payphone/respuesta?id=${id}&clientTransactionId=${pago.id}`).expect(303);
  assert.equal((await db.pago.findUnique({where:{id:pago.id}})).estado,'revision');assert.equal(calls.length,2);
 }
 const calls=gateway(),pedido=await order();await request.post(`/api/pedidos/${pedido.id}/pago/payphone`).set('Authorization',auth(user)).send({}).expect(201);
 const pago=await db.pago.findUnique({where:{pedidoId:pedido.id}});let confirms=0;global.fetch=async()=>{confirms++;throw new DOMException('Synthetic timeout','TimeoutError');};
 const route=`/api/pagos/payphone/respuesta?id=30001&clientTransactionId=${pago.id}`;
 await request.get(route).expect(303);await request.get(route).expect(303);assert.equal(confirms,1);assert.equal(calls.length,1);assert.equal((await db.pago.findUnique({where:{id:pago.id}})).estado,'revision');
});
test('cambiar entorno impide reabrir cobros anteriores en ambas direcciones',async()=>{
 for(const environment of ['production','sandbox']) {
  enabled(environment);const calls=gateway(),pedido=await order(),route=`/api/pedidos/${pedido.id}/pago`;
  await request.post(route+'/payphone').set('Authorization',auth(user)).send({}).expect(201);
  enabled(environment==='production'?'sandbox':'production');
  const response=await request.post(route+'/payphone').set('Authorization',auth(user)).send({}).expect(409);assert.equal(response.body.error.code,'PAYMENT_ENVIRONMENT_CHANGED');
  assert.equal((await request.get(route).set('Authorization',auth(user)).expect(200)).body.data.pago.urlPago,null);assert.equal(calls.length,1);
 }
});
test('cancelación verificada conserva el pedido y permite cancelarlo sin presentar pago aprobado',async()=>{
 enabled('production');const calls=gateway(body=>({transactionId:body.id,clientTransactionId:body.clientTxId,amount:1480,currency:'USD',statusCode:2,transactionStatus:'Canceled'})),pedido=await order();
 await request.post(`/api/pedidos/${pedido.id}/pago/payphone`).set('Authorization',auth(user)).send({}).expect(201);
 const pago=await db.pago.findUnique({where:{pedidoId:pedido.id}});await request.get(`/api/pagos/payphone/respuesta?id=40001&clientTransactionId=${pago.id}`).expect(303);
 assert.equal((await db.pago.findUnique({where:{id:pago.id}})).estado,'cancelado');const current=await db.pedido.findUnique({where:{id:pedido.id}});assert.equal(current.estado,'pendiente');assert.equal(calls.length,2);
 await request.put(`/api/pedidos/${pedido.id}/estado`).set('Authorization',auth(admin)).send({estado:'cancelado',esperadoUpdatedAt:current.updatedAt.toISOString()}).expect(200);
});
after(async()=>{
 global.fetch=originalFetch;for(const name of envNames){if(originalEnv[name]===undefined)delete process.env[name];else process.env[name]=originalEnv[name];}
 await db.$disconnect();fs.rmSync(directory,{recursive:true,force:true});
});
