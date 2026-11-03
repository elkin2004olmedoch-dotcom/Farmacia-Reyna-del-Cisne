'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {randomBytes,randomUUID,createHash}=require('node:crypto');
const bcrypt=require('bcrypt'),jwt=require('jsonwebtoken'),supertest=require('supertest');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-mobile-test-'));
const root=path.resolve(__dirname,'../..');
const postgres=process.env.PHARMACY_MOBILE_TEST_DATABASE_URL;
let db,api,settings,control,driver,other,admin,buyer;
const password='SyntheticMobile2026!';
const secret=()=>randomBytes(32).toString('base64url');
const hash=value=>createHash('sha256').update(value).digest('hex');
const auth=session=>'Bearer '+session.token;
const webAuth=user=>'Bearer '+jwt.sign({version:user.tokenVersion},settings.secret,{algorithm:'HS256',subject:user.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'5m'});
const login=async(user=driver)=>(await api.post('/api/auth/mobile/login').send({email:user.email,password}).expect(200)).body.data;
const renew=(session,nextSecret)=>api.post('/api/auth/mobile/renew').send({refreshToken:session.refreshToken,nextSecret});
const sessionId=session=>session.refreshToken.split('.')[0];
const route=e=>'/api/entregas/'+e.id;
const sample=e=>({latitud:.2,longitud:-79.1,precision:6,registradaAt:new Date().toISOString(),esperadoGpsVersion:e.gpsVersion});
async function delivery(user=driver,estado='en_camino'){
 const pedido=await db.pedido.create({data:{userId:buyer.id,total:0,estado:'preparado',entrega:'delivery',nombre:'Cliente sintético',email:buyer.email,telefono:'+593979275988',documento:'••••••0400',provincia:'Pichincha',ciudad:'Puerto Quito',direccion:'Avenida de prueba 123',requestKey:randomUUID(),fingerprint:'synthetic'}});
 return db.entrega.create({data:{pedidoId:pedido.id,repartidorId:user.id,estado}});
}
async function claim(e,s){return (await api.post(route(e)+'/seguimiento-movil').set('Authorization',auth(s)).send({}).expect(200)).body.data;}
async function cleared(id){const e=await db.entrega.findUnique({where:{id}});for(const key of ['sesionSeguimientoId','latitud','longitud','precision','registradaAt','recibidaAt'])assert.equal(e[key],null,key);}
before(async()=>{
 const env={SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,TEMP:os.tmpdir(),TMP:os.tmpdir(),NODE_ENV:'test',JWT_SECRET:randomBytes(48).toString('hex'),CORS_ORIGIN:'http://localhost:3000',UPLOAD_DIR:path.join(directory,'uploads')};
 let databaseUrl='file:'+path.join(directory,'test.db').replaceAll('\\','/');
 if(postgres){
  const url=new URL(postgres);
  assert.ok(['postgres:','postgresql:'].includes(url.protocol));assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
  assert.equal(url.username,'farmacia_test');assert.equal(url.password,'');assert.match(url.pathname,/^\/farmacia_test(?:_[a-z0-9]+)?$/);
  const {PrismaClient}=require('../../node_modules/.prisma-farmacia-postgresql');control=new PrismaClient({datasources:{db:{url:postgres}}});
  const name='farmacia_test_mobile'+randomUUID().replaceAll('-','');await control.$executeRawUnsafe('CREATE DATABASE "'+name+'"');
  url.pathname='/'+name;databaseUrl=url.href;
 }
 const schemaSource=path.join(root,'server/prisma',postgres?'postgresql':'');
 fs.copyFileSync(path.join(schemaSource,'schema.prisma'),path.join(directory,'schema.prisma'));
 fs.cpSync(path.join(schemaSource,'migrations'),path.join(directory,'migrations'),{recursive:true});
 execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy','--schema',path.join(directory,'schema.prisma')],{cwd:directory,env:{...env,DATABASE_URL:databaseUrl},stdio:'pipe',windowsHide:true});
 Object.assign(process.env,env,{DATABASE_URL:databaseUrl});require('dotenv').config=()=>({parsed:{}});
 settings={...require('../../server/config.cjs')(),testAuthLimit:200,testApiLimit:1000};
 db=require('../../server/models/db.cjs');api=supertest(require('../../server/app.cjs')(settings));
 const passwordHash=await bcrypt.hash(password,4);
 const user=(role,label)=>db.usuario.create({data:{nombre:label,email:label+'@example.ec',telefono:'+593979275988',passwordHash,role}});
 driver=await user('repartidor','mobile-driver');other=await user('repartidor','mobile-other');admin=await user('admin','mobile-admin');buyer=await user('user','mobile-buyer');
});
after(async()=>{await db?.$disconnect();await control?.$disconnect();});

test('login móvil restringe credenciales/rol, emite 15 minutos y guarda solo hashes',async()=>{
 for(const user of [buyer,admin])await api.post('/api/auth/mobile/login').send({email:user.email,password}).expect(401);
 await api.post('/api/auth/mobile/login').send({email:driver.email,password:'incorrect'}).expect(401);
 await api.post('/api/auth/mobile/login').send({email:driver.email,password,role:'admin'}).expect(422);
 const s=await login(),payload=jwt.verify(s.token,settings.secret,{algorithms:['HS256'],issuer:'farmacia-reina',audience:'farmacia-web'});
 assert.equal(payload.exp-payload.iat,900);assert.equal(payload.mobileSession,sessionId(s));assert.equal(payload.sub,driver.id);
 assert.equal(s.usuario.role,'repartidor');assert.equal(s.usuario.passwordHash,undefined);assert.equal(s.usuario.tokenVersion,undefined);
 assert.match(s.refreshToken,/^[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$/);assert.equal(Date.parse(s.expiresAt),payload.exp*1000);
 const row=await db.sesionMovil.findUnique({where:{id:sessionId(s)}});
 assert.equal(row.secretHash,hash(s.refreshToken.split('.')[1]));assert.equal(row.previousSecretHash,null);assert.equal(row.expiresAt.toISOString(),s.refreshExpiresAt);
 assert.ok(Math.abs(Date.parse(s.refreshExpiresAt)-Date.now()-30*86400000)<5000);assert.ok(!JSON.stringify(row).includes(s.refreshToken.split('.')[1]));
});
test('móvil: una nueva época invalida JWT anteriores y permite login y renovación nuevos',async()=>{
 const old=await login(),epoch=randomUUID();await db.usuario.update({where:{id:driver.id},data:{tokenEpoch:epoch}});
 try{
  await api.get('/api/auth/me').set('Authorization',auth(old)).expect(401);
  const fresh=await login();assert.equal(jwt.decode(fresh.token).epoch,epoch);assert.equal(fresh.usuario.tokenEpoch,undefined);
  await api.get('/api/auth/me').set('Authorization',auth(fresh)).expect(200);
  const next=(await renew(fresh,secret()).expect(200)).body.data;
  await api.get('/api/auth/me').set('Authorization',auth(next)).expect(200);
 }finally{await db.usuario.update({where:{id:driver.id},data:{tokenEpoch:null}});}
});

test('renovación rota y repetir el par perdido es idempotente sin ampliar expiración',async()=>{
 const original=await login(),next=secret();
 const first=(await renew(original,next).expect(200)).body.data;
 const retry=(await renew(original,next).expect(200)).body.data;
 assert.equal(first.refreshToken,sessionId(original)+'.'+next);assert.equal(retry.refreshToken,first.refreshToken);assert.equal(retry.refreshExpiresAt,original.refreshExpiresAt);
 const row=await db.sesionMovil.findUnique({where:{id:sessionId(original)}});assert.equal(row.previousSecretHash,hash(original.refreshToken.split('.')[1]));assert.equal(row.secretHash,hash(next));
 const rotated=(await renew(first,secret()).expect(200)).body.data;assert.equal(rotated.refreshExpiresAt,original.refreshExpiresAt);
});
test('reuso del anterior con otro siguiente revoca sesión y retira su ubicación',async()=>{
 const s=await login(),e=await delivery(),claimed=await claim(e,s);
 await api.put(route(e)+'/ubicacion').set('Authorization',auth(s)).send(sample(claimed)).expect(200);
 const current=(await renew(s,secret()).expect(200)).body.data;
 await renew(s,secret()).expect(401);await api.get('/api/entregas').set('Authorization',auth(current)).expect(401);await cleared(e.id);
});
test('parámetros refresh malformados, secreto incorrecto y autorrotación no permiten sesión',async()=>{
 const s=await login();
 for(const patch of [{refreshToken:'bad'},{nextSecret:'short'},{nextSecret:42},{extra:true}])await api.post('/api/auth/mobile/renew').send({refreshToken:s.refreshToken,nextSecret:secret(),...patch}).expect(422);
 await renew(s,s.refreshToken.split('.')[1]).expect(422);
 await api.post('/api/auth/mobile/renew').send({refreshToken:sessionId(s)+'.'+secret(),nextSecret:secret()}).expect(401);
 await api.get('/api/entregas').set('Authorization',auth(s)).expect(200);
});
test('renovaciones concurrentes del mismo par tienen éxito; pares distintos revocan',async()=>{
 const s=await login(),next=secret();
 const same=await Promise.all([renew(s,next),renew(s,next)]);assert.deepEqual(same.map(r=>r.status),[200,200]);assert.equal(same[0].body.data.refreshToken,same[1].body.data.refreshToken);
 const current=same[0].body.data;
 const competing=await Promise.all([renew(current,secret()),renew(current,secret())]);assert.deepEqual(competing.map(r=>r.status).sort(),[200,401]);
 await api.get('/api/entregas').set('Authorization',auth(current)).expect(401);
});
test('GET privado de una entrega aplica admin/propietario y no filtra sesión',async()=>{
 const e=await delivery();
 for(const user of [driver,admin]){const dto=(await api.get(route(e)).set('Authorization',webAuth(user)).expect(200)).body.data;assert.equal(dto.id,e.id);assert.equal(dto.origenSeguimiento,null);assert.equal(dto.sesionSeguimientoId,undefined);}
 await api.get(route(e)).set('Authorization',webAuth(other)).expect(404);await api.get(route(e)).set('Authorization',webAuth(buyer)).expect(403);await api.get(route(e)).expect(401);
});
test('propiedad móvil protege de emisores web/otra sesión y retiro es condicional',async()=>{
 const s=await login(),second=await login(),e=await delivery();
 await api.post(route(e)+'/seguimiento-movil').set('Authorization',webAuth(driver)).send({}).expect(403);
 await api.put(route(e)+'/ubicacion').set('Authorization',auth(s)).send(sample(e)).expect(409);
 const own=await claim(e,s);assert.equal(own.origenSeguimiento,'app');assert.equal((await claim(e,s)).gpsVersion,own.gpsVersion);
 await api.post(route(e)+'/seguimiento-movil').set('Authorization',auth(second)).send({}).expect(409);
 await api.put(route(e)+'/ubicacion').set('Authorization',auth(s)).send(sample(own)).expect(200);
 await api.put(route(e)+'/ubicacion').set('Authorization',webAuth(driver)).send(sample(own)).expect(409);
 await api.delete(route(e)+'/ubicacion').set('Authorization',webAuth(driver)).expect(409);
 await api.delete(route(e)+'/seguimiento-movil').set('Authorization',auth(second)).expect(409);
 assert.equal((await db.entrega.findUnique({where:{id:e.id}})).latitud,.2);
 const tracking=(await api.get('/api/pedidos/'+e.pedidoId+'/seguimiento').set('Authorization',webAuth(buyer)).expect(200)).body.data;
 assert.equal(tracking.entrega.sesionSeguimientoId,undefined);assert.equal(tracking.entrega.mobileSession,undefined);
 const released=(await api.delete(route(e)+'/seguimiento-movil').set('Authorization',auth(s)).expect(200)).body.data;await cleared(e.id);
 assert.equal((await api.delete(route(e)+'/seguimiento-movil').set('Authorization',auth(s)).expect(200)).body.data.gpsVersion,released.gpsVersion);
 const newOwner=await claim(e,second);await api.put(route(e)+'/ubicacion').set('Authorization',auth(second)).send(sample(newOwner)).expect(200);
 await api.delete(route(e)+'/seguimiento-movil').set('Authorization',auth(s)).expect(409);
 assert.equal((await db.entrega.findUnique({where:{id:e.id}})).sesionSeguimientoId,sessionId(second));
});
test('una sesión mantiene una entrega; reclamos concurrentes no crean dos emisores',async()=>{
 const s=await login(),a=await delivery(),b=await delivery();
 const results=await Promise.all([api.post(route(a)+'/seguimiento-movil').set('Authorization',auth(s)).send({}),api.post(route(b)+'/seguimiento-movil').set('Authorization',auth(s)).send({})]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(await db.entrega.count({where:{sesionSeguimientoId:sessionId(s)}}),1);
 const second=await login(),e=await delivery();
 const claims=await Promise.all([api.post(route(e)+'/seguimiento-movil').set('Authorization',auth(s)).send({}),api.post(route(e)+'/seguimiento-movil').set('Authorization',auth(second)).send({})]);
 assert.deepEqual(claims.map(r=>r.status).sort(),[200,409]);
});
test('solo propio y estados activos admiten reclamo; la web conserva GPS sin propietario',async()=>{
 const s=await login(),foreign=await delivery(other),assigned=await delivery(driver,'asignada'),e=await delivery();
 await api.post(route(foreign)+'/seguimiento-movil').set('Authorization',auth(s)).send({}).expect(404);
 await api.post(route(assigned)+'/seguimiento-movil').set('Authorization',auth(s)).send({}).expect(409);
 await api.post(route(e)+'/seguimiento-movil').set('Authorization',auth(s)).send({extra:true}).expect(422);
 await api.put(route(e)+'/ubicacion').set('Authorization',webAuth(driver)).send(sample(e)).expect(200);
 assert.equal((await api.get(route(e)).set('Authorization',webAuth(driver)).expect(200)).body.data.origenSeguimiento,'web');
 await api.delete(route(e)+'/ubicacion').set('Authorization',webAuth(driver)).expect(200);await cleared(e.id);
});
test('limpiar muestras caducadas conserva la propiedad móvil para recuperar la red',async()=>{
 const s=await login(),e=await delivery(),own=await claim(e,s);
 await api.put(route(e)+'/ubicacion').set('Authorization',auth(s)).send(sample(own)).expect(200);
 await require('../../server/models/entregas.cjs').purgeExpiredLocations(new Date(Date.now()+16*60000));
 const stored=await db.entrega.findUnique({where:{id:e.id}});assert.equal(stored.sesionSeguimientoId,sessionId(s));assert.equal(stored.latitud,null);
 const current=(await api.get(route(e)).set('Authorization',auth(s)).expect(200)).body.data;assert.equal(current.origenSeguimiento,'app');
 await api.put(route(e)+'/ubicacion').set('Authorization',auth(s)).send(sample(current)).expect(200);
});
test('logout móvil revoca inmediatamente solo su sesión y libera posición',async()=>{
 const s=await login(),second=await login(),e=await delivery(),own=await claim(e,s);
 await api.put(route(e)+'/ubicacion').set('Authorization',auth(s)).send(sample(own)).expect(200);
 await api.post('/api/auth/mobile/logout').set('Authorization',webAuth(driver)).send({}).expect(403);
 await api.post('/api/auth/mobile/logout').set('Authorization',auth(s)).send({}).expect(204);
 await api.get('/api/entregas').set('Authorization',auth(s)).expect(401);await renew(s,secret()).expect(401);await cleared(e.id);
 await api.get('/api/entregas').set('Authorization',auth(second)).expect(200);await api.get('/api/entregas').set('Authorization',webAuth(driver)).expect(200);
});
test('cierre y cancelación retiran propiedad/posición dentro del cambio de estado',async()=>{
 for(const estado of ['entregada','cancelada']){
  const s=await login(),e=await delivery(driver,'en_destino'),own=await claim(e,s);
  await api.put(route(e)+'/ubicacion').set('Authorization',auth(s)).send(sample(own)).expect(200);
  const changed=(await api.put(route(e)+'/estado').set('Authorization',estado==='cancelada'?webAuth(admin):auth(s)).send({estado,esperadoVersion:e.version}).expect(200)).body.data;
  assert.equal(changed.origenSeguimiento,null);await cleared(e.id);
  await api.put(route(e)+'/ubicacion').set('Authorization',auth(s)).send(sample(changed)).expect(409);
 }
});
test('inactividad, rol, tokenVersion y expiración absoluta cortan acceso/renovación y posición',async()=>{
 for(const patch of [{activo:false},{role:'user'},{tokenVersion:{increment:1}}]){
  const s=await login(other),e=await delivery(other),own=await claim(e,s);
  await api.put(route(e)+'/ubicacion').set('Authorization',auth(s)).send(sample(own)).expect(200);
  await db.usuario.update({where:{id:other.id},data:patch});
  await api.get('/api/entregas').set('Authorization',auth(s)).expect(401);await renew(s,secret()).expect(401);await cleared(e.id);
  other=await db.usuario.update({where:{id:other.id},data:{activo:true,role:'repartidor'}});
 }
 const s=await login(other),e=await delivery(other),own=await claim(e,s);await api.put(route(e)+'/ubicacion').set('Authorization',auth(s)).send(sample(own)).expect(200);
 await db.sesionMovil.update({where:{id:sessionId(s)},data:{expiresAt:new Date(Date.now()-1)}});
 await renew(s,secret()).expect(401);await api.get('/api/entregas').set('Authorization',auth(s)).expect(401);await cleared(e.id);
});
test('logout web conserva su revocación global y retira propiedad móvil',async()=>{
 const s=await login(other),e=await delivery(other),own=await claim(e,s);await api.put(route(e)+'/ubicacion').set('Authorization',auth(s)).send(sample(own)).expect(200);
 await api.post('/api/auth/logout').set('Authorization',webAuth(other)).expect(204);
 await api.get('/api/entregas').set('Authorization',auth(s)).expect(401);await renew(s,secret()).expect(401);await cleared(e.id);
 other=await db.usuario.findUnique({where:{id:other.id}});
});
test('desactivar repartidor revoca sesiones sin cambiar regla de entrega en curso',async()=>{
 const target=await db.usuario.create({data:{nombre:'Desactivar',email:'mobile-disable@example.ec',telefono:'+593979275988',passwordHash:await bcrypt.hash(password,4),role:'repartidor'}});
 const s=await login(target),e=await delivery(target,'asignada');
 await api.put('/api/admin/repartidores/'+target.id).set('Authorization',webAuth(admin)).send({activo:false}).expect(200);
 await api.get('/api/entregas').set('Authorization',auth(s)).expect(401);await renew(s,secret()).expect(401);await cleared(e.id);
 assert.equal((await db.entrega.findUnique({where:{id:e.id}})).repartidorId,null);
});
test('CORS y límites de autenticación también protegen las nuevas rutas',async()=>{
 await api.post('/api/auth/mobile/login').set('Origin','capacitor://localhost').send({email:driver.email,password}).expect(403);
 const limited=supertest(require('../../server/app.cjs')({...settings,testAuthLimit:2}));
 for(let i=0;i<2;i++)await limited.post('/api/auth/mobile/login').send({email:driver.email,password:'invalid'}).expect(401);
 await limited.post('/api/auth/mobile/login').send({email:driver.email,password}).expect(429);
 const s=await login();await limited.post('/api/auth/mobile/renew').send({refreshToken:s.refreshToken,nextSecret:secret()}).expect(429);
});
