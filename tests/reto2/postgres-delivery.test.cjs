'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {randomUUID,randomBytes}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');

// Opt-in only: never discover a database from .env or deployment credentials.
test('PostgreSQL aislado: migraciones, API, entrega, fiscalidad, permisos e importación',{
 skip:!process.env.PHARMACY_TEST_DATABASE_URL,
 timeout:120000
},async t=>{
 const metaPath=process.env.PHARMACY_TEST_POSTGRES_META || path.join(os.tmpdir(),'farmacia-postgres-20261028.json');
 const meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));
 const url=new URL(process.env.PHARMACY_TEST_DATABASE_URL),expected=new URL(meta.url);
 assert.ok(['postgres:','postgresql:'].includes(url.protocol));
 assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'Only loopback PostgreSQL is allowed');
 assert.equal(url.hostname,expected.hostname);assert.equal(url.port,String(meta.port));
 assert.ok(/^\/farmacia_test(?:_[a-z0-9]+)?$/.test(url.pathname),'Only synthetic test databases are allowed');
 assert.equal(url.username,'farmacia_test');assert.equal(url.password,'');
 assert.deepEqual([...url.searchParams.keys()].sort(),['connection_limit','schema']);
 assert.equal(url.searchParams.get('schema'),'public');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-pg-validation-'));
 // Isolate both migrations and seed from the repository's .env discovery.
 const env={SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,TEMP:os.tmpdir(),TMP:os.tmpdir(),NODE_ENV:'test',
  JWT_SECRET:randomBytes(48).toString('hex'),CORS_ORIGIN:'http://localhost:3000',
  ADMIN_EMAIL:'postgres-admin@example.ec',ADMIN_PASSWORD:'SyntheticPostgres2026!',UPLOAD_DIR:path.join(directory,'uploads')};
 const {PrismaClient}=require('../../node_modules/.prisma-farmacia-postgresql');
 const control=new PrismaClient({datasources:{db:{url:url.href}}});
 const clients=[control];
 t.after(async()=>{await Promise.allSettled(clients.map(client=>client.$disconnect()));});
 async function database(label){
  const name='farmacia_test_'+label+randomUUID().replaceAll('-','');
  await control.$executeRawUnsafe('CREATE DATABASE "'+name+'"');
  const target=new URL(url.href);target.pathname='/'+name;
  const client=new PrismaClient({datasources:{db:{url:target.href}}});clients.push(client);
  return {client,url:target.href};
 }
 function migrate(provider,databaseUrl){
  const source=path.join(root,'server/prisma',provider==='postgresql'?'postgresql':'');
  const copied=path.join(directory,provider);if(!fs.existsSync(copied)){
   fs.mkdirSync(copied);fs.copyFileSync(path.join(source,'schema.prisma'),path.join(copied,'schema.prisma'));
   fs.cpSync(path.join(source,'migrations'),path.join(copied,'migrations'),{recursive:true});
  }
  const output=execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy','--schema',path.join(copied,'schema.prisma')],{cwd:directory,env:{...env,DATABASE_URL:databaseUrl},encoding:'utf8',windowsHide:true});
  fs.appendFileSync(path.join(directory,'migrations.log'),output.replaceAll(databaseUrl,'[synthetic database]'));
 }
 // Roles exist before migrations so REVOKE branches are exercised as on Supabase.
 for(const role of ['anon','authenticated'])await control.$executeRawUnsafe(`DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${role}') THEN CREATE ROLE "${role}" NOLOGIN; END IF; END $$`);
 const main=await database('api');migrate('postgresql',main.url);
 Object.assign(process.env,env,{DATABASE_URL:main.url});
 require('dotenv').config=()=>({parsed:{}});
 execFileSync(process.execPath,['-e',`require(${JSON.stringify(require.resolve('dotenv'))}).config=()=>({parsed:{}});require(${JSON.stringify(path.join(root,'server/prisma/seed.cjs'))});`],{cwd:directory,env:{...env,DATABASE_URL:main.url},stdio:'pipe',windowsHide:true});
 const db=require('../../server/models/db.cjs');clients.push(db);
 const api=require('supertest')(require('../../server/app.cjs')());
 const sri=require('../../server/models/sri-document.cjs'),sriFixture=require('./sri-fixture.cjs');
 let adminAuth,userAuth,driverAuth,otherAuth,product,order,delivery,snapshot;
 const buyer={name:'Cliente PostgreSQL',email:'postgres-user@example.ec',phone:'0979275988',documentType:'cedula',document:'0102030400',delivery:'delivery',province:'Pichincha',city:'Puerto Quito',address:'Avenida Sintetica numero 123',postalCode:'',zonaEntregaId:'puerto-quito'};
 const zone={nombre:'Todo Puerto Quito',provincia:'Pichincha',canton:'Puerto Quito',tarifaCentavos:230,ivaCategoria:'general',fundamentoIva:null,activa:true};
 async function setRate(value){const current=await db.zonaEntrega.findUnique({where:{id:'puerto-quito'}});return (await api.put('/api/admin/zonas-entrega/puerto-quito').set('Authorization',adminAuth).send({...zone,tarifaCentavos:value,esperadoVersion:current.version}).expect(200)).body.data;}
 async function state(value){order=(await api.put('/api/pedidos/'+order.id+'/estado').set('Authorization',adminAuth).send({estado:value,esperadoUpdatedAt:order.updatedAt}).expect(200)).body.data;}
 async function deliveryState(value){delivery=(await api.put('/api/entregas/'+delivery.id+'/estado').set('Authorization',driverAuth).send({estado:value,esperadoVersion:delivery.version}).expect(200)).body.data;}

 await t.test('login, registro, roles, tarifa e IVA del pedido',async()=>{
  adminAuth='Bearer '+(await api.post('/api/auth/login').send({email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD}).expect(200)).body.data.token;
  const registration={nombre:buyer.name,email:buyer.email,telefono:buyer.phone,cedula:buyer.document,password:'SyntheticCustomer2026!'};
  userAuth='Bearer '+(await api.post('/api/auth/register').send(registration).expect(201)).body.data.token;
  otherAuth='Bearer '+(await api.post('/api/auth/register').send({...registration,email:'postgres-other@example.ec'}).expect(201)).body.data.token;
  await api.get('/api/admin/zonas-entrega').expect(401);
  await api.get('/api/admin/zonas-entrega').set('Authorization',userAuth).expect(403);
  const driver=(await api.post('/api/admin/repartidores').set('Authorization',adminAuth).send({nombre:'Repartidor PostgreSQL',email:'postgres-driver@example.ec',telefono:buyer.phone,password:'SyntheticDriver2026!'}).expect(201)).body.data;
  driverAuth='Bearer '+(await api.post('/api/auth/login').send({email:driver.email,password:'SyntheticDriver2026!'}).expect(200)).body.data.token;
  await api.post('/api/pedidos').set('Authorization',driverAuth).send({}).expect(403);
  product=await db.producto.create({data:{nombre:'Producto PG sintético',precio:11.5,stock:10,categoria:'cuidado',descripcion:'Prueba aislada',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase'}});
  const rate=await setRate(230);
  await api.put('/api/admin/zonas-entrega/puerto-quito').set('Authorization',adminAuth).send({...zone,tarifaCentavos:1.5,esperadoVersion:rate.version}).expect(422);
  const input={carrito:[{productoId:product.id,cantidad:1}],comprador:{...buyer,esperadoTarifaVersion:rate.version,latitudEntrega:.1,longitudEntrega:-79.2,consienteUbicacion:true},claveSolicitud:randomUUID()};
  order=(await api.post('/api/pedidos').set('Authorization',userAuth).send(input).expect(201)).body.data;
  assert.equal(Number(order.subtotalProductos),11.5);assert.equal(Number(order.total),13.8);assert.equal(order.costoEnvioCentavos,230);assert.equal(Number(order.envioIvaMonto),.3);
  snapshot=sri.snapshot(await db.pedido.findUnique({where:{id:order.id},include:{detalles:true}}),sriFixture.buyer,sriFixture.emitter);
  assert.equal(snapshot.total,1380);assert.equal(snapshot.iva,180);assert.equal(snapshot.lineas[1].codigo,'SERV-ENVIO');
  await setRate(500);
  await api.post('/api/pedidos').set('Authorization',userAuth).send({...input,claveSolicitud:randomUUID()}).expect(409);
  assert.equal((await db.producto.findUnique({where:{id:product.id}})).stock,9);
  assert.equal((await api.post('/api/pedidos').set('Authorization',userAuth).send(input).expect(200)).body.data.id,order.id);
  assert.deepEqual(sri.snapshot(await db.pedido.findUnique({where:{id:order.id},include:{detalles:true}}),sriFixture.buyer,sriFixture.emitter),snapshot);
  await state('confirmado');await state('preparado');
  delivery=(await api.post('/api/entregas/asignar').set('Authorization',adminAuth).send({pedidoId:order.id,repartidorId:driver.id}).expect(200)).body.data;
  assert.equal(delivery.destino.email,undefined);assert.equal(delivery.detalles,undefined);
 });
 await t.test('GPS, propietario, retiro y cierre borran coordenadas manteniendo fiscalidad',async()=>{
  assert.ok(delivery,'Requires successful order setup');await deliveryState('en_camino');
  const route='/api/entregas/'+delivery.id+'/ubicacion';
  const sample={latitud:.2,longitud:-79.3,precision:7,registradaAt:new Date().toISOString(),esperadoGpsVersion:0};
  await api.put(route).set('Authorization',userAuth).send(sample).expect(403);
  await api.put(route).set('Authorization',driverAuth).send(sample).expect(200);
  await api.get('/api/pedidos/'+order.id+'/seguimiento').set('Authorization',otherAuth).expect(404);
  const tracking=(await api.get('/api/pedidos/'+order.id+'/seguimiento').set('Authorization',userAuth).expect(200)).body.data;
  assert.equal(tracking.entrega.ubicacion.latitud,.2);assert.equal(tracking.entrega.repartidorId,undefined);
  const withdrawn=(await api.delete(route).set('Authorization',driverAuth).expect(200)).body.data;
  assert.equal(withdrawn.ubicacion,null);
  await api.put(route).set('Authorization',driverAuth).send({...sample,esperadoGpsVersion:withdrawn.gpsVersion,registradaAt:new Date().toISOString()}).expect(200);
  await deliveryState('en_destino');await deliveryState('entregada');
  const closed=await db.pedido.findUnique({where:{id:order.id},include:{reparto:true,detalles:true}});
  assert.equal(closed.estado,'entregado');assert.equal(closed.latitudEntrega,null);assert.equal(closed.longitudEntrega,null);assert.ok(closed.ubicacionEntregaAceptadaAt);
  assert.equal(closed.reparto.latitud,null);assert.equal(closed.reparto.longitud,null);assert.equal(delivery.destino,null);
  assert.deepEqual(sri.snapshot(closed,sriFixture.buyer,sriFixture.emitter),snapshot);
 });
 await t.test('PayPhone sintético: reserva concurrente, Confirm, snapshot y conciliación de producción',async()=>{
  const names=['PAYPHONE_ENABLED','PAYPHONE_TOKEN','PAYPHONE_STORE_ID','PAYPHONE_ENVIRONMENT','PAYMENT_PUBLIC_ORIGIN','PAYMENT_API_ORIGIN','CORS_ORIGIN'];
  const previous=Object.fromEntries(names.map(name=>[name,process.env[name]])),originalFetch=global.fetch,calls=[],paymentId=randomUUID();
  try {
   Object.assign(process.env,{PAYPHONE_ENABLED:'true',PAYPHONE_TOKEN:'synthetic-token-not-real',PAYPHONE_STORE_ID:randomUUID(),PAYPHONE_ENVIRONMENT:'production',PAYMENT_PUBLIC_ORIGIN:'https://test.example.ec',PAYMENT_API_ORIGIN:'https://api.example.ec',CORS_ORIGIN:'http://localhost:3000,https://test.example.ec'});
   global.fetch=async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body});return new Response(JSON.stringify(url.endsWith('/Prepare')?{paymentId,payWithCard:'https://pay.payphonetodoesposible.com/Anonymous/Index?paymentId='+paymentId}:{transactionId:body.id,clientTransactionId:body.clientTxId,amount:1150,currency:'USD',statusCode:3,transactionStatus:'Approved'}));};
   // Pickup omits delivery-only keys; the API deliberately rejects them.
   const {zonaEntregaId,...pickupBuyer}=buyer;
   const input={carrito:[{productoId:product.id,cantidad:1}],comprador:{...pickupBuyer,delivery:'pickup'},claveSolicitud:randomUUID()};
   const paymentOrder=(await api.post('/api/pedidos').set('Authorization',userAuth).send(input).expect(201)).body.data;
   const route='/api/pedidos/'+paymentOrder.id+'/pago/payphone';
   const parallel=await Promise.all([api.post(route).set('Authorization',userAuth).send({}),api.post(route).set('Authorization',userAuth).send({})]);
   assert.deepEqual(parallel.map(response=>response.status).sort(),[200,201]);assert.equal(calls.length,1);
   assert.deepEqual([calls[0].body.amount,calls[0].body.amountWithoutTax,calls[0].body.amountWithTax,calls[0].body.tax],[1150,0,1000,150]);
   const pago=await db.pago.findUnique({where:{pedidoId:paymentOrder.id}}),callback='/api/pagos/payphone/respuesta?id=10001&clientTransactionId='+pago.id;
   const returns=await Promise.all([api.get(callback),api.get(callback)]);assert.deepEqual(returns.map(response=>response.status),[303,303]);assert.equal(calls.length,2);
   const approved=await db.pago.findUnique({where:{id:pago.id}});assert.equal(approved.estado,'aprobado');assert.equal(approved.entorno,'production');
   await assert.rejects(()=>db.pago.update({where:{id:pago.id},data:{totalCentavos:1200,baseIvaCentavos:1050}}));
   await assert.rejects(()=>db.pago.update({where:{id:pago.id},data:{providerTransactionId:10002}}));
   const current=await db.pedido.findUnique({where:{id:paymentOrder.id}});assert.equal(current.estado,'pendiente');assert.equal(await db.facturaPedido.count({where:{pedidoId:paymentOrder.id}}),0);
   const cancelled=await api.put('/api/pedidos/'+paymentOrder.id+'/estado').set('Authorization',adminAuth).send({estado:'cancelado',esperadoUpdatedAt:current.updatedAt.toISOString()}).expect(409);assert.equal(cancelled.body.error.code,'PAYMENT_REQUIRES_RECONCILIATION');
  } finally {global.fetch=originalFetch;for(const name of names){if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];}}
 });
 await t.test('CHECK, FK y RLS niegan acceso SQL a anon y authenticated',async()=>{
  await assert.rejects(()=>db.zonaEntrega.update({where:{id:'puerto-quito'},data:{tarifaCentavos:-1}}));
  await assert.rejects(()=>db.zonaEntrega.update({where:{id:'puerto-quito'},data:{ivaCategoria:'cero',fundamentoIva:null}}));
  await assert.rejects(()=>db.zonaEntregaTarifa.create({data:{zonaEntregaId:randomUUID(),version:1,ivaCategoria:'general'}}),e=>e.code==='P2003');
  await assert.rejects(()=>db.pedido.update({where:{id:order.id},data:{envioBaseImponible:null}}));
  await assert.rejects(()=>db.$executeRawUnsafe('UPDATE "Producto" SET "controlado"=2 WHERE "id"=$1',product.id));
  const tables=['ZonaEntrega','ZonaEntregaTarifa','Entrega','Pago'];
  for(const table of tables){
   const rows=await db.$queryRawUnsafe('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass','"'+table+'"');assert.equal(rows[0].relrowsecurity,true);
   for(const role of ['anon','authenticated']){
    const privileges=await db.$queryRawUnsafe('SELECT has_table_privilege($1,$2,\'SELECT,INSERT,UPDATE,DELETE\') AS allowed',role,'"'+table+'"');assert.equal(privileges[0].allowed,false);
    await assert.rejects(()=>db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET LOCAL ROLE "'+role+'"');await tx.$queryRawUnsafe('SELECT * FROM "'+table+'"');}),e=>e.meta?.code==='42501');
    // Temporary grant proves RLS itself still hides rows; rollback restores ACL.
    const rollback=new Error('ROLLBACK_SYNTHETIC_PRIVILEGE');
    await assert.rejects(()=>db.$transaction(async tx=>{
     await tx.$executeRawUnsafe('GRANT SELECT ON "'+table+'" TO "'+role+'"');
     await tx.$executeRawUnsafe('SET LOCAL ROLE "'+role+'"');
     assert.deepEqual(await tx.$queryRawUnsafe('SELECT * FROM "'+table+'"'),[]);
     throw rollback;
    }),error=>error===rollback);
   }
  }
 });
 await t.test('importador real SQLite→PostgreSQL acepta baseline 008 y conserva historial, pagos y milisegundos',async()=>{
  const target=await database('import');migrate('postgresql',target.url);
  const sourceUrl='file:'+path.join(directory,'source.db').replaceAll('\\','/');migrate('sqlite',sourceUrl);
  const source=new (require('@prisma/client').PrismaClient)({datasources:{db:{url:sourceUrl}}});clients.push(source);
  const {migrate:transfer,targetCounts,readSnapshot,MODELS}=require('../../scripts/migrate-cloud.cjs');
  // The preceding API exercise supplies real synthetic relation graphs and decimals.
  const synthetic=await readSnapshot(db);
  await source.$transaction(async tx=>{
   await tx.zonaEntregaTarifa.deleteMany();await tx.zonaEntrega.deleteMany();await tx.configuracionFiscal.deleteMany();
   for(const model of MODELS)if(synthetic[model].length)await tx[model].createMany({data:synthetic[model]});
  });
  const stamp=new Date('2024-02-03T04:05:06.789Z');
  const nextVersion=synthetic.zonaEntrega[0].version+1;
  await source.zonaEntrega.update({where:{id:'puerto-quito'},data:{tarifaCentavos:230,version:nextVersion,createdAt:stamp,updatedAt:stamp}});
  await source.zonaEntregaTarifa.create({data:{zonaEntregaId:'puerto-quito',version:nextVersion,tarifaCentavos:230,ivaCategoria:'general',createdAt:stamp}});
  await source.facturaPedido.create({data:{pedidoId:order.id,ambiente:'1',emisorRuc:sriFixture.emitter.ruc,establecimiento:'001',puntoEmision:'001',fechaEmision:stamp,snapshot:JSON.stringify(snapshot),xmlBorrador:'<factura-sintetica-sin-validez/>'}});
  const baseline=await targetCounts(target.client);assert.equal(baseline.zonaEntrega,1);assert.equal(baseline.zonaEntregaTarifa,1);
  const report=await transfer({source,target:target.client,apply:true});assert.equal(report.destino.zonaEntregaTarifa,synthetic.zonaEntregaTarifa.length+1);
  assert.equal(report.destino.entrega,1);assert.equal(report.destino.facturaPedido,1);
  for(const model of MODELS){
   const normalize=rows=>JSON.parse(JSON.stringify(rows)).sort((a,b)=>a.id.localeCompare(b.id));
   assert.deepEqual(normalize(await target.client[model].findMany()),normalize(await source[model].findMany()),model+' must preserve its exact snapshot');
  }
  await assert.rejects(()=>transfer({source,target:target.client,apply:true}),e=>e.code==='TARGET_NOT_EMPTY');
 });
 t.diagnostic('Synthetic PostgreSQL artifacts retained in '+directory);
});
