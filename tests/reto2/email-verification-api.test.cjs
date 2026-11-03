'use strict';
const {test,before,after,beforeEach,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID,createHash}=require('node:crypto');
const jwt=require('jsonwebtoken');
const mail=require('../../server/models/email-delivery.cjs');
const {createFixture,postgresTestUrl}=require('./email-api-fixture.cjs');
const originalSend=mail.sendVerification,originalFetch=globalThis.fetch;
let fixture,messages;
const registration=()=>({nombre:'Cliente Verificación',email:'correo-'+randomUUID().slice(0,8)+'@example.ec',telefono:'0990000000',cedula:'0102030400',password:'CorreoCliente2026!'});
const digest=token=>createHash('sha256').update(token).digest('hex');
const publicOnly=body=>{
  const data=body.data?.verified===true?{...body.data,token:undefined}:body.data;const json=JSON.stringify({...body,data});assert.doesNotMatch(json,/"(?:token|tokenHash|passwordHash|password|apiKey|secret|RESEND_API_KEY)"|re_synthetic_email_api_not_real/);
  assert.equal((messages || []).filter(message=>typeof message.token==='string' && json.includes(message.token)).length,0,'La API no debe devolver tokens de correo, tampoco dentro de mensajes.');
};
const sign=user=>jwt.sign({version:user.tokenVersion},fixture.config.secret,{algorithm:'HS256',subject:user.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'5m'});
async function register(api){const values=registration(),response=await api.post('/api/auth/register').send(values).expect(202);assert.equal(response.body.data.deliveryStatus,'sent');return {values,response,user:await fixture.db.usuario.findUnique({where:{email:values.email}}),token:messages.at(-1).token};}
const verify=(api,token)=>api.post('/api/auth/verify-email').send({token});
async function ageClaim(user){await fixture.db.emailVerification.update({where:{usuarioId:user.id},data:{createdAt:new Date(Date.now()-61000)}});}

before(()=>{fixture=createFixture();});
after(async()=>{mail.sendVerification=originalSend;globalThis.fetch=originalFetch;if(fixture)await fixture.close();});
beforeEach(()=>{
  messages=[];mail.sendVerification=async message=>{messages.push(message);return {accepted:true};};
  globalThis.fetch=()=>{throw new Error('Las pruebas de correo no permiten peticiones externas.');};
});
afterEach(()=>{mail.sendVerification=originalSend;globalThis.fetch=originalFetch;});

test('fixture PostgreSQL rechaza destinos ajenos al cluster loopback autorizado',()=>{
  assert.equal(new URL(postgresTestUrl('postgresql://postgres@127.0.0.1:55421/farmacia_email_test?schema=public&connection_limit=2')).port,'55421');
  for(const url of ['postgresql://postgres@database.example.ec:55421/farmacia_email_test','postgresql://postgres@127.0.0.1:54621/farmacia_email_test','postgresql://postgres@127.0.0.1:5432/farmacia_email_test','postgresql://postgres@127.0.0.1:55421/produccion','postgresql://postgres@127.0.0.1:55421/farmacia_email_test?host=database.example.ec','postgresql://postgres@127.0.0.1:55421/farmacia_email_test?schema=private'])assert.throws(()=>postgresTestUrl(url));
});

test('origen remoto no autorizado no registra cuentas ni emite correos',async()=>{
  const api=fixture.api(),values=registration();
  const denied=await api.post('/api/auth/register').set('Origin','https://origen-no-autorizado.example.ec').send(values).expect(403);assert.equal(denied.body.error.code,'CORS_FORBIDDEN');publicOnly(denied.body);assert.equal(messages.length,0);assert.equal(await fixture.db.usuario.count({where:{email:values.email}}),0);
  const allowed=await api.post('/api/auth/register').set('Origin','http://localhost:3300').send(values).expect(202);assert.equal(allowed.headers['access-control-allow-origin'],'http://localhost:3300');assert.equal(messages.length,1);publicOnly(allowed.body);
});

test('registro pendiente no crea sesión ni expone token/hash; login y JWT válido siguen bloqueados',async()=>{
  const api=fixture.api(),values=registration();
  const response=await api.post('/api/auth/register').set('Host','untrusted-host.example.ec').send(values).expect(202);
  publicOnly(response.body);assert.deepEqual(Object.keys(response.body.data).sort(),['deliveryStatus','message','requiresEmailVerification']);assert.equal(response.body.data.requiresEmailVerification,true);assert.equal(response.body.data.deliveryStatus,'sent');assert.equal(messages.length,1);
  const user=await fixture.db.usuario.findUnique({where:{email:values.email}}),row=await fixture.db.emailVerification.findUnique({where:{usuarioId:user.id}});assert.equal(user.emailVerificationRequired,true);assert.equal(user.emailVerifiedAt,null);assert.match(row.tokenHash,/^[0-9a-f]{64}$/);assert.equal(row.tokenHash,digest(messages[0].token));assert.ok(row.expiresAt>row.createdAt);assert.equal(row.expiresAt-row.createdAt,3600000);
  const link=new URL(mail.confirmationUrl(messages[0].config.publicOrigin,messages[0].token));assert.equal(link.origin,'http://localhost:3300');assert.equal(link.pathname,'/confirmar-correo');assert.equal(link.search,'');assert.match(link.hash,/^#token=[A-Za-z0-9_-]{43}$/);
  const correct=await api.post('/api/auth/login').send({email:values.email,password:values.password}).expect(403);assert.equal(correct.body.error.code,'EMAIL_NOT_VERIFIED');publicOnly(correct.body);
  const wrong=await api.post('/api/auth/login').send({email:values.email,password:'ClaveEquivocada2026!'}).expect(401);assert.equal(wrong.body.error.code,'INVALID_CREDENTIALS');
  const authorization='Bearer '+sign(user);for(const [method,url,body] of [['get','/api/auth/me'],['get','/api/pedidos/mis-pedidos'],['post','/api/pedidos',{}]]){let request=api[method](url).set('Authorization',authorization);if(body)request=request.send(body);const guarded=await request.expect(403);assert.equal(guarded.body.error.code,'EMAIL_NOT_VERIFIED');publicOnly(guarded.body);}
});

test('confirmación se consume una vez y entrega una sesión de cliente con la versión nueva',async()=>{
  const api=fixture.api(),pending=await register(api),old=sign(pending.user);
  const confirmed=await verify(api,pending.token).expect(200);assert.equal(confirmed.body.data.verified,true);publicOnly(confirmed.body);assert.deepEqual(Object.keys(confirmed.body.data).sort(),['message','token','usuario','verified']);assert.equal(confirmed.body.data.usuario.id,pending.user.id);assert.equal(confirmed.body.data.usuario.role,'user');assert.equal(confirmed.headers['cache-control'],'no-store');await api.get('/api/auth/me').set('Authorization','Bearer '+confirmed.body.data.token).expect(200);
  const current=await fixture.db.usuario.findUnique({where:{id:pending.user.id}});assert.ok(current.emailVerifiedAt);assert.equal(current.tokenVersion,pending.user.tokenVersion+1);assert.equal(await fixture.db.emailVerification.count({where:{usuarioId:current.id}}),0);
  const replay=await verify(api,pending.token).expect(422);assert.equal(replay.body.error.code,'EMAIL_VERIFICATION_INVALID');publicOnly(replay.body);
  await api.get('/api/auth/me').set('Authorization','Bearer '+old).expect(401);
  const login=await api.post('/api/auth/login').send({email:pending.values.email,password:pending.values.password}).expect(200);assert.equal(typeof login.body.data.token,'string');assert.ok(login.body.data.usuario.emailVerifiedAt);await api.get('/api/auth/me').set('Authorization','Bearer '+login.body.data.token).expect(200);
});

test('token expirado y correo cambiado no confirman y dejan la cuenta pendiente',async()=>{
  for(const scenario of ['expired','email-changed']){
    const api=fixture.api(),pending=await register(api);
    if(scenario==='expired')await fixture.db.emailVerification.update({where:{usuarioId:pending.user.id},data:{createdAt:new Date(Date.now()-7200000),expiresAt:new Date(Date.now()-3600000)}});
    else await fixture.db.usuario.update({where:{id:pending.user.id},data:{email:'cambiado-'+randomUUID().slice(0,8)+'@example.ec'}});
    const response=await verify(api,pending.token).expect(422);assert.equal(response.body.error.code,'EMAIL_VERIFICATION_INVALID');publicOnly(response.body);
    const user=await fixture.db.usuario.findUnique({where:{id:pending.user.id}});assert.equal(user.emailVerifiedAt,null);assert.equal(user.tokenVersion,pending.user.tokenVersion);assert.equal(await fixture.db.emailVerification.count({where:{usuarioId:user.id}}),0);
  }
});

test('confirmar correo de personal no entrega una sesión administrativa',async()=>{
  const api=fixture.api(),pending=await register(api);
  await fixture.db.usuario.update({where:{id:pending.user.id},data:{role:'admin'}});
  const confirmed=await verify(api,pending.token).expect(200);
  assert.equal(confirmed.body.data.verified,true);assert.equal(confirmed.body.data.token,undefined);assert.equal(confirmed.body.data.usuario,undefined);publicOnly(confirmed.body);
});

test('reenviar respeta cooldown, rota el hash y rechaza el enlace anterior',async()=>{
  const api=fixture.api(),pending=await register(api);
  await api.post('/api/auth/resend-verification').send({email:pending.values.email}).expect(202);assert.equal(messages.length,1);
  await ageClaim(pending.user);await api.post('/api/auth/resend-verification').send({email:pending.values.email}).expect(202);assert.equal(messages.length,2);
  assert.notEqual(digest(messages[0].token),digest(messages[1].token));await verify(api,pending.token).expect(422);await verify(api,messages[1].token).expect(200);
});

test('dos consumos concurrentes reales producen un éxito y un enlace ya usado',async()=>{
  const api=fixture.api(),pending=await register(api);
  const responses=await Promise.all([verify(api,pending.token),verify(api,pending.token)]);assert.deepEqual(responses.map(response=>response.status).sort(),[200,422]);responses.forEach(response=>publicOnly(response.body));
  const user=await fixture.db.usuario.findUnique({where:{id:pending.user.id}});assert.ok(user.emailVerifiedAt);assert.equal(user.tokenVersion,pending.user.tokenVersion+1);assert.equal(await fixture.db.emailVerification.count({where:{usuarioId:user.id}}),0);
});

test('reenvíos concurrentes sólo emiten un nuevo mensaje y una fila válida',async()=>{
  const api=fixture.api(),pending=await register(api);await ageClaim(pending.user);
  const responses=await Promise.all([api.post('/api/auth/resend-verification').send({email:pending.values.email}),api.post('/api/auth/resend-verification').send({email:pending.values.email})]);assert.ok(responses.every(response=>response.status===202));assert.deepEqual(responses[0].body.data,responses[1].body.data);assert.equal(messages.length,2);assert.equal(await fixture.db.emailVerification.count({where:{usuarioId:pending.user.id}}),1);
  const row=await fixture.db.emailVerification.findUnique({where:{usuarioId:pending.user.id}});assert.equal(row.tokenHash,digest(messages[1].token));
});

test('resend es genérico para desconocido, confirmado, inactivo y cooldown; presupuesto IP de cinco por hora',async()=>{
  const api=fixture.api(),pending=await register(api),verified=await register(api),inactive=await register(api);await verify(api,verified.token).expect(200);await fixture.db.usuario.update({where:{id:inactive.user.id},data:{activo:false}});
  const baseline=messages.length,responses=[];
  for(const email of [pending.values.email,'desconocido-'+randomUUID().slice(0,8)+'@example.ec',verified.values.email,inactive.values.email,pending.values.email])responses.push(await api.post('/api/auth/resend-verification').send({email}).expect(202));
  for(const response of responses){assert.deepEqual(response.body.data,responses[0].body.data);publicOnly(response.body);}assert.equal(messages.length,baseline);
  const limited=await api.post('/api/auth/resend-verification').send({email:pending.values.email}).expect(429);assert.equal(limited.body.error.code,'EMAIL_RATE_LIMIT');publicOnly(limited.body);
  await api.get('/api/productos').expect(200);await api.post('/api/auth/login').send({email:pending.values.email,password:'ClaveEquivocada2026!'}).expect(401);
});

test('fallo de correo deja la cuenta pendiente sin afirmar envío y permite solicitar otro enlace',async()=>{
  const api=fixture.api(),values=registration();mail.sendVerification=async()=>{throw new Error('synthetic provider failure');};
  const response=await api.post('/api/auth/register').send(values).expect(202);assert.equal(response.body.data.requiresEmailVerification,true);assert.equal(response.body.data.deliveryStatus,'unavailable');assert.doesNotMatch(response.body.data.message,/Revisa tu correo/);publicOnly(response.body);
  const user=await fixture.db.usuario.findUnique({where:{email:values.email}});assert.equal(user.emailVerifiedAt,null);assert.equal(user.emailVerificationRequired,true);assert.equal(await fixture.db.emailVerification.count({where:{usuarioId:user.id}}),0);
  mail.sendVerification=async message=>{messages.push(message);return {accepted:true};};await api.post('/api/auth/resend-verification').send({email:values.email}).expect(202);assert.equal(messages.length,1);await verify(api,messages[0].token).expect(200);
});

test('envíos desactivados conservan legado201 y no permiten saltarse una cuenta pendiente',async()=>{
  const enabled=fixture.api(),pending=await register(enabled),off=fixture.api(false),legacy=registration();
  const created=await off.post('/api/auth/register').send(legacy).expect(201);assert.equal(typeof created.body.data.token,'string');assert.equal(created.body.data.usuario.emailVerifiedAt,null);assert.equal(created.body.data.usuario.emailVerificationRequired,false);assert.equal(messages.length,1);
  await enabled.get('/api/auth/me').set('Authorization','Bearer '+created.body.data.token).expect(200);
  const blocked=await off.post('/api/auth/login').send({email:pending.values.email,password:pending.values.password}).expect(403);assert.equal(blocked.body.error.code,'EMAIL_NOT_VERIFIED');await off.get('/api/auth/me').set('Authorization','Bearer '+sign(pending.user)).expect(403);
  const unavailable=await off.post('/api/auth/resend-verification').send({email:pending.values.email}).expect(503);assert.equal(unavailable.body.error.code,'EMAIL_UNAVAILABLE');publicOnly(unavailable.body);
  await verify(off,pending.token).expect(200);await off.post('/api/auth/login').send({email:pending.values.email,password:pending.values.password}).expect(200);
});

test('origen HTTPS y configuración privada no se exponen por la API',async()=>{
  const origin='https://tienda.example.ec',synthetic={NODE_ENV:'production',EMAIL_VERIFICATION_ENABLED:'true',EMAIL_PUBLIC_ORIGIN:origin,EMAIL_FROM:'confirmar@example.ec',RESEND_API_KEY:'re_synthetic_email_api_not_real'};
  assert.equal(mail.configuration(synthetic,{production:true,origins:[origin]}).publicOrigin,origin);
  assert.throws(()=>mail.configuration({...synthetic,EMAIL_PUBLIC_ORIGIN:'http://tienda.example.ec'},{production:true,origins:[origin]}));
  const api=fixture.api();publicOnly((await api.get('/api/salud').expect(200)).body);publicOnly((await api.get('/api/config').expect(404)).body);
});
