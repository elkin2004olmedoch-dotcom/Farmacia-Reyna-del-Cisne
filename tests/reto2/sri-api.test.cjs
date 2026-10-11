'use strict';
const {test,after}=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto'),jwt=require('jsonwebtoken'),express=require('express'),supertest=require('supertest');
const {db}=require('./fixture.cjs'),{errorHandler,AppError}=require('../../server/middleware/errors.cjs');
const {createBilling}=require('../../server/models/sri.cjs'),crypt=require('../../server/models/sri-crypto.cjs');
const fixture=require('./sri-fixture.cjs'),cert=fixture.certificateFixture();
const captures={receives:0,authorizations:0,signed:null,key:null,mode:'success'},transport={
  async receive(env,xml,key){captures.receives++;captures.signed=xml;captures.key=key;if(captures.mode==='offline')throw new AppError(502,'SRI_UNAVAILABLE','SRI test offline');return {estado:captures.mode==='returned'?'DEVUELTA':'RECIBIDA',mensajes:[]};},
  async authorize(env,key){captures.authorizations++;if(captures.mode==='offline')throw new AppError(502,'SRI_UNAVAILABLE','SRI test offline');return captures.mode==='pending'?{estado:'EN_PROCESO',mensajes:[]}:captures.mode==='denied'?{estado:'NO_AUTORIZADA',mensajes:[]}:{estado:'AUTORIZADA',numeroAutorizacion:key,fechaAutorizacion:new Date('2026-10-11T15:00:00Z'),comprobante:captures.signed,mensajes:[]};}
};
const config={secret:process.env.JWT_SECRET},billing=createBilling({db,secret:config.secret,transport});
const app=express();app.use('/api',require('../../server/routes/sri.cjs')(config,{db,transport}));app.use(errorHandler);const request=supertest(app);
let admin,user,other,adminToken,userToken,otherToken,product,orderId,invoiceId;
const token=account=>jwt.sign({version:account.tokenVersion},config.secret,{subject:account.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'1h'});
const authorization=value=>'Bearer '+value;
async function makeOrder(overrides={}){
  const {legacy=false,...changes}=overrides;
  const order=await db.pedido.create({data:{id:randomUUID(),userId:user.id,total:11.5,baseImponible:legacy?null:10,ivaMonto:legacy?null:1.5,estado:'confirmado',entrega:'pickup',nombre:'Cliente Prueba',email:user.email,telefono:user.telefono,documento:'••••••0400',requestKey:randomUUID(),fingerprint:'synthetic-test',...changes,detalles:{create:{productoId:product.id,nombreProducto:product.nombre,cantidad:2,precioUnitario:5.75,precioOriginal:11.5,descuentoPorcentaje:50,ivaPorcentaje:legacy?null:15,baseImponible:legacy?null:10,ivaMonto:legacy?null:1.5,totalLinea:legacy?null:11.5}}}});return order.id;
}
test('SRI autenticación y roles preceden incluso cuerpos grandes',async()=>{
  admin=await db.usuario.findUnique({where:{email:process.env.ADMIN_EMAIL}});
  user=await db.usuario.create({data:{nombre:'Cliente SRI',email:'sri-client@example.ec',telefono:'+593979275988',passwordHash:admin.passwordHash}});other=await db.usuario.create({data:{nombre:'Otro SRI',email:'sri-other@example.ec',telefono:'+593979275988',passwordHash:admin.passwordHash}});
  adminToken=token(admin);userToken=token(user);otherToken=token(other);
  await request.get('/api/admin/facturacion/configuracion').expect(401);await request.get('/api/admin/facturacion/configuracion').set('Authorization',authorization(userToken)).expect(403);
  await request.post('/api/admin/facturacion/certificado').send({archivoBase64:'A'.repeat(100000),password:'nonsecret'}).expect(401);
  await request.post('/api/admin/facturacion/certificado').set('Authorization',authorization(userToken)).send({archivoBase64:'A'.repeat(100000),password:'nonsecret'}).expect(403);
});
test('configuración persistida valida producción y secuencia sin exponer firma',async()=>{
  const initial=await request.get('/api/admin/facturacion/configuracion').set('Authorization',authorization(adminToken)).expect(200);assert.equal(initial.body.data.ambiente,'1');assert.equal(initial.body.data.certificado.presente,false);
  await request.put('/api/admin/facturacion/configuracion').set('Authorization',authorization(adminToken)).send({...fixture.emitter,ambiente:'2'}).expect(422);
  await request.put('/api/admin/facturacion/configuracion').set('Authorization',authorization(adminToken)).send({...fixture.emitter,establecimiento:'000'}).expect(422);
  const result=await request.put('/api/admin/facturacion/configuracion').set('Authorization',authorization(adminToken)).send({...fixture.emitter,secuencialInicial:25}).expect(200);assert.equal(result.body.data.proximoSecuencial,25);
  assert.ok(result.body.data.capacidades.opensslDisponible);assert.ok(!JSON.stringify(result.body).includes('certificadoCifrado'));
  await assert.rejects(db.configuracionEmisor.update({where:{id:'principal'},data:{ambiente:'3'}}));
});
test('borrador conserva importes del pedido y rechaza históricos sin IVA y cancelados',async()=>{
  product=await db.producto.create({data:{nombre:'Producto SRI Test',precio:11.5,stock:10,categoria:'bienestar',descripcion:'Sintético para las pruebas SRI',imagen:'assets/images/producto-vitaminas.jpg',alt:'Producto sintético'}});
  orderId=await makeOrder();const result=await request.post('/api/admin/facturacion/facturas').set('Authorization',authorization(adminToken)).send({...fixture.buyer,pedidoId:orderId}).expect(201);invoiceId=result.body.data.id;assert.equal(result.body.data.estado,'BORRADOR');assert.equal(result.body.data.claveAcceso,null);assert.equal(result.body.data.validezTributaria,false);assert.ok(!JSON.stringify(result.body).includes(fixture.buyer.identificacionComprador));
  const replay=await request.post('/api/admin/facturacion/facturas').set('Authorization',authorization(adminToken)).send({...fixture.buyer,pedidoId:orderId}).expect(200);assert.equal(replay.body.data.id,invoiceId);assert.equal(await db.facturaPedido.count({where:{pedidoId:orderId}}),1);
  const legacy=await makeOrder({legacy:true});await request.post('/api/admin/facturacion/facturas').set('Authorization',authorization(adminToken)).send({...fixture.buyer,pedidoId:legacy}).expect(409);
  const cancelled=await makeOrder({estado:'cancelado'});await request.post('/api/admin/facturacion/facturas').set('Authorization',authorization(adminToken)).send({...fixture.buyer,pedidoId:cancelled}).expect(409);
  await request.post(`/api/admin/facturacion/facturas/${invoiceId}/emitir`).set('Authorization',authorization(adminToken)).send({}).expect(409);
});
test('importación firma cifrada y parser protegido3MiB; secretos nunca retornan',async()=>{
  const invalid=await request.post('/api/admin/facturacion/certificado').set('Authorization',authorization(adminToken)).send({archivoBase64:'A'.repeat(100000),password:'synthetic'}).expect(400);assert.equal(invalid.body.error.code,'INVALID_CERTIFICATE');
  const result=await request.post('/api/admin/facturacion/certificado').set('Authorization',authorization(adminToken)).send({archivoBase64:cert.archivoBase64,password:cert.password}).expect(200);assert.equal(result.body.data.presente,true);
  const row=await db.configuracionEmisor.findUnique({where:{id:'principal'}});assert.ok(!row.certificadoCifrado.includes(cert.password));assert.ok(!row.certificadoCifrado.includes(cert.archivoBase64));assert.equal(crypt.decrypt(row.certificadoCifrado,config.secret).password,cert.password);
  const safe=await request.get('/api/admin/facturacion/configuracion').set('Authorization',authorization(adminToken)).expect(200);assert.ok(!JSON.stringify(safe.body).includes(cert.password));assert.ok(!JSON.stringify(safe.body).includes(cert.archivoBase64));
});
test('emisión firma verificable, secuencia atómica y autorización real simulada se persisten',async()=>{
  const result=await request.post(`/api/admin/facturacion/facturas/${invoiceId}/emitir`).set('Authorization',authorization(adminToken)).send({}).expect(200);assert.equal(result.body.data.estado,'AUTORIZADA');assert.equal(result.body.data.numero,'001-001-000000025');assert.equal(result.body.data.validezTributaria,false);assert.equal(captures.receives,1);assert.equal(captures.authorizations,1);
  const row=await db.facturaPedido.findUnique({where:{id:invoiceId}});assert.equal(row.numeroAutorizacion,row.claveAcceso);assert.ok(crypt.verifyXml(row.xmlFirmado,cert.certificatePem));assert.equal(row.procesandoHasta,null);
  await request.post(`/api/admin/facturacion/facturas/${invoiceId}/emitir`).set('Authorization',authorization(adminToken)).send({}).expect(200);assert.equal(captures.receives,1);assert.equal((await billing.getConfig()).proximoSecuencial,26);
  await assert.rejects(billing.setConfig({...fixture.emitter,secuencialInicial:25}),{code:'SEQUENCE_ALREADY_USED'});
});
test('factura propia, XML y RIDE impiden IDOR, descargas autorizadas conservan prueba',async()=>{
  const own=await request.get(`/api/pedidos/${orderId}/factura`).set('Authorization',authorization(userToken)).expect(200);assert.equal(own.body.data.id,invoiceId);assert.ok(!JSON.stringify(own.body).includes(fixture.buyer.identificacionComprador));
  await request.get(`/api/pedidos/${orderId}/factura`).set('Authorization',authorization(otherToken)).expect(404);await request.get(`/api/facturacion/facturas/${invoiceId}/xml`).set('Authorization',authorization(otherToken)).expect(404);await request.get(`/api/facturacion/facturas/${invoiceId}/ride`).set('Authorization',authorization(otherToken)).expect(404);
  const xml=await request.get(`/api/facturacion/facturas/${invoiceId}/xml`).set('Authorization',authorization(userToken)).expect(200);assert.match(xml.headers['content-type'],/application\/xml/);assert.ok(xml.text.includes('<estado>AUTORIZADO</estado>'));
  const ride=await request.get(`/api/facturacion/facturas/${invoiceId}/ride`).set('Authorization',authorization(userToken)).expect(200);assert.ok(ride.text.includes('SIN VALIDEZ TRIBUTARIA'));assert.ok(ride.text.includes('PRUEBAS'));assert.match(ride.headers['content-security-policy'],/default-src 'none'/);
  const list=await request.get('/api/admin/facturacion/facturas?limit=5&page=1').set('Authorization',authorization(adminToken)).expect(200);assert.equal(list.body.data.limit,5);assert.equal(list.body.data.items.length,1);
});
test('SRI pendiente, devolución y caída nunca se convierten en autorización falsa ni duplican clave',async()=>{
  captures.mode='pending';const pending=await billing.createInvoice({...fixture.buyer,pedidoId:await makeOrder()});const first=await billing.emit(pending.factura.id);assert.equal(first.estado,'EN_PROCESO');assert.equal(first.numeroAutorizacion,null);const receives=captures.receives;const second=await billing.emit(first.id);assert.equal(second.claveAcceso,first.claveAcceso);assert.equal(captures.receives,receives);
  captures.mode='returned';const returned=await billing.createInvoice({...fixture.buyer,pedidoId:await makeOrder()});assert.equal((await billing.emit(returned.factura.id)).estado,'DEVUELTA');
  captures.mode='offline';const offline=await billing.createInvoice({...fixture.buyer,pedidoId:await makeOrder()});await assert.rejects(billing.emit(offline.factura.id),{code:'SRI_UNAVAILABLE'});const old=await db.facturaPedido.findUnique({where:{id:offline.factura.id}});assert.equal(old.estado,'ERROR');assert.equal(old.numeroAutorizacion,null);assert.ok(old.xmlFirmado);assert.equal(old.procesandoHasta,null);
  captures.mode='pending';const retry=await billing.emit(old.id);assert.equal(retry.claveAcceso,old.claveAcceso);assert.equal(retry.numeroAutorizacion,null);assert.equal(retry.estado,'EN_PROCESO');
});
test('producción requiere confirmación de configuración y de cada emisión',async()=>{
  await billing.setConfig({...fixture.emitter,ambiente:'2',confirmarProduccion:true});const invoice=await billing.createInvoice({...fixture.buyer,pedidoId:await makeOrder()});await assert.rejects(billing.emit(invoice.factura.id),{code:'PRODUCTION_CONFIRMATION_REQUIRED'});
  await billing.setConfig(fixture.emitter);
});
test('DB bloquea estado inexistente, autorización incompleta y secuencia duplicada',async()=>{
  const row=await db.facturaPedido.findUnique({where:{id:invoiceId}});await assert.rejects(db.facturaPedido.update({where:{id:row.id},data:{estado:'INVENTADO'}}));
  const draft=await billing.createInvoice({...fixture.buyer,pedidoId:await makeOrder()});await assert.rejects(db.facturaPedido.update({where:{id:draft.factura.id},data:{estado:'AUTORIZADA'}}));
  await assert.rejects(db.facturaPedido.create({data:{pedidoId:await makeOrder(),ambiente:row.ambiente,emisorRuc:row.emisorRuc,establecimiento:row.establecimiento,puntoEmision:row.puntoEmision,secuencial:row.secuencial,claveAcceso:row.claveAcceso,fechaEmision:row.fechaEmision,snapshot:row.snapshot,xmlBorrador:row.xmlBorrador}}));
  await assert.rejects(db.facturaPedido.update({where:{id:row.id},data:{numeroAutorizacion:null}}));
});
test('emisiones simultáneas no duplican factura ni claves entre pedidos distintos',async()=>{
  const documents=new Map(),calls=[];
  let received,release;const reached=new Promise(resolve=>received=resolve),hold=new Promise(resolve=>release=resolve);
  const concurrent=createBilling({db,secret:config.secret,transport:{async receive(env,xml,key){documents.set(key,xml);calls.push(key);received();await hold;return {estado:'RECIBIDA',mensajes:[]};},async authorize(env,key){return {estado:'AUTORIZADA',numeroAutorizacion:key,fechaAutorizacion:new Date(),comprobante:documents.get(key),mensajes:[]};}}});
  const first=await concurrent.createInvoice({...fixture.buyer,pedidoId:await makeOrder()});const emission=concurrent.emit(first.factura.id);await reached;
  await assert.rejects(concurrent.emit(first.factura.id),{code:'INVOICE_PROCESSING'});release();const done=await emission;assert.equal(calls.length,1);assert.equal(done.estado,'AUTORIZADA');
  const [a,b]=await Promise.all([makeOrder(),makeOrder()]);const [fa,fb]=await Promise.all([concurrent.createInvoice({...fixture.buyer,pedidoId:a}),concurrent.createInvoice({...fixture.buyer,pedidoId:b})]);
  const results=await Promise.all([concurrent.emit(fa.factura.id),concurrent.emit(fb.factura.id)]);assert.notEqual(results[0].claveAcceso,results[1].claveAcceso);assert.notEqual(results[0].numero,results[1].numero);assert.ok(results.every(r=>r.estado==='AUTORIZADA'));
});
test('autorización con XML alterado jamás se guarda como AUTORIZADA',async()=>{
  let signed;
  const malicious=createBilling({db,secret:config.secret,transport:{async receive(env,xml){signed=xml;return {estado:'RECIBIDA',mensajes:[]};},async authorize(env,key){return {estado:'AUTORIZADA',numeroAutorizacion:key,fechaAutorizacion:new Date(),comprobante:signed.replace('<importeTotal>11.50</importeTotal>','<importeTotal>12.50</importeTotal>'),mensajes:[]};}}});
  const invoice=await malicious.createInvoice({...fixture.buyer,pedidoId:await makeOrder()});await assert.rejects(malicious.emit(invoice.factura.id),{code:'SRI_AUTHORIZATION_MISMATCH'});const row=await db.facturaPedido.findUnique({where:{id:invoice.factura.id}});assert.equal(row.estado,'ERROR');assert.equal(row.numeroAutorizacion,null);assert.equal(row.xmlAutorizado,null);
});
test('cambio de IVA entre pedido y emisión exige conciliación sin consumir secuencia',async()=>{
  const invoice=await billing.createInvoice({...fixture.buyer,pedidoId:await makeOrder()}),before=(await billing.getConfig()).proximoSecuencial;
  const fiscal=await db.configuracionFiscal.create({data:{tarifaGeneral:14,inicioVigencia:new Date(Date.now()-1000),referenciaNormativa:'SIMULACION DE PRUEBA: cambio de IVA, sin efecto real'}});
  try{await assert.rejects(billing.emit(invoice.factura.id),{code:'NEED_TAX_RECONCILIATION'});const row=await db.facturaPedido.findUnique({where:{id:invoice.factura.id}});assert.equal(row.secuencial,null);assert.equal(row.claveAcceso,null);assert.equal((await billing.getConfig()).proximoSecuencial,before);assert.equal(JSON.parse(row.snapshot).lineas[0].tarifa,15);}
  finally{await db.configuracionFiscal.delete({where:{id:fiscal.id}});}
});
after(async()=>{cert.cleanup();await db.$disconnect();});
