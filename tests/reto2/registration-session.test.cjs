'use strict';
const {test,before,after,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID,createHash}=require('node:crypto');
const {createFixture}=require('./email-api-fixture.cjs');
const mail=require('../../server/models/email-delivery.cjs');
const originalSend=mail.sendVerification;
const web={'X-Farmacia-Web':'1',Origin:'http://localhost:3300'};
const cookies=response=>(response.headers['set-cookie']||[]).map(value=>value.split(';')[0]).join('; ');
const pendingCookie=response=>(response.headers['set-cookie']||[]).find(value=>value.startsWith('farmacia-registro='));
let fixture,messages;
before(()=>{fixture=createFixture();});
after(async()=>{mail.sendVerification=originalSend;if(fixture)await fixture.close();});
beforeEach(()=>{messages=[];mail.sendVerification=async message=>{messages.push(message);return {accepted:true};};});
async function register(){
  const api=fixture.api(),values={nombre:'Cliente Pendiente',email:'pendiente-'+randomUUID().slice(0,8)+'@example.ec',telefono:'0990000000',cedula:'0102030400',password:'ClienteCorreo2026!'};
  const response=await api.post('/api/auth/register').set(web).send(values).expect(202);
  assert.ok(pendingCookie(response),'el registro web entrega una cookie privada para continuar en este navegador');
  assert.match(response.body.data.registrationId,/^[A-Za-z0-9_-]{43}$/);
  return {api,values,response,registrationId:response.body.data.registrationId,pending:pendingCookie(response).split(';')[0],token:messages.at(-1).token};
}
const poll=(pending,cookie=pending.pending)=>pending.api.post('/api/auth/registro-pendiente').set(web).set('Cookie',cookie).send({registrationId:pending.registrationId});
async function confirm(pending){return pending.api.post('/api/auth/verify-email').set(web).send({token:pending.token}).expect(200);}

test('registro web conserva sólo el hash del permiso privado hasta confirmar el correo',async()=>{
  const p=await register(),cookie=pendingCookie(p.response),secret=p.pending.split('=')[1];
  assert.match(cookie,/; HttpOnly;/);assert.match(cookie,/; SameSite=Strict/i);assert.match(cookie,/; Path=\//);assert.doesNotMatch(cookie,/Domain=/i);
  assert.equal(p.response.body.data.token,undefined);assert.ok(!JSON.stringify(p.response.body).includes(secret));
  const user=await fixture.db.usuario.findUnique({where:{email:p.values.email}}),row=await fixture.db.registroPendiente.findUnique({where:{usuarioId:user.id}});
  assert.equal(row.secretHash,createHash('sha256').update(secret).digest('hex'));assert.equal(row.email,p.values.email);assert.equal(row.tokenVersion,0);assert.equal(row.sessionId,null);assert.equal(row.consumedAt,null);assert.equal(row.expiresAt-row.createdAt,3600000);
  const waiting=await poll(p).expect(202);assert.equal(waiting.body.data.verified,false);assert.equal(waiting.headers['set-cookie'],undefined);
  await p.api.get('/api/auth/me').set('Cookie',p.pending).expect(401);
});

test('confirmación en otro navegador permite continuar el registro original y reintentar la respuesta sin duplicar sesiones',async()=>{
  const p=await register(),elsewhere=await confirm(p);
  assert.equal(elsewhere.body.data.usuario.email,p.values.email);
  const continued=await poll(p).expect(200);
  assert.equal(continued.body.data.verified,true);assert.equal(continued.body.data.usuario.email,p.values.email);assert.equal(continued.body.data.token,undefined);
  assert.match(cookies(continued),/farmacia-access=/);assert.match(cookies(continued),/farmacia-refresh=/);
  await p.api.get('/api/auth/me').set('Cookie',cookies(continued)).expect(200);
  const userId=continued.body.data.usuario.id,count=await fixture.db.sesionWeb.count({where:{usuarioId:userId}});
  const retried=await poll(p).expect(200);
  const refresh=response=>cookies(response).split('; ').find(value=>value.startsWith('farmacia-refresh='));
  assert.equal(refresh(retried),refresh(continued));assert.equal(await fixture.db.sesionWeb.count({where:{usuarioId:userId}}),count);
  const row=await fixture.db.registroPendiente.findUnique({where:{usuarioId:userId}});assert.ok(row.consumedAt);assert.ok(row.sessionId);
});

test('secreto ausente o inventado y un correo aislado no permiten continuar ninguna cuenta',async()=>{
  const p=await register();await confirm(p);
  await poll(p,'farmacia-registro='+'A'.repeat(43)).expect(204);
  await poll(p,'').expect(204);
  await p.api.post('/api/auth/registro-pendiente').set(web).send({email:p.values.email}).expect(422);
  await p.api.post('/api/auth/registro-pendiente').set('Cookie',p.pending).send({}).expect(403);
  await p.api.post('/api/auth/registro-pendiente').set({...web,Origin:'https://ajeno.example'}).set('Cookie',p.pending).send({}).expect(403);
  await p.api.get('/api/auth/me').set('Cookie',p.pending).expect(401);
});

test('continuar no sustituye una sesión vigente de otra cuenta y una cookie vencida no bloquea el registro',async()=>{
  const p=await register();await confirm(p);
  const other=await p.api.post('/api/auth/login').set(web).send({email:'email-admin@example.ec',password:'SyntheticEmailAdmin2026!'}).expect(200);
  const blocked=await poll(p,p.pending+'; '+cookies(other)).expect(204);
  assert.ok(!(blocked.headers['set-cookie']||[]).some(value=>/^farmacia-(access|refresh)=/.test(value)));
  const current=await p.api.get('/api/auth/me').set('Cookie',cookies(other)).expect(200);assert.equal(current.body.data.usuario,undefined);assert.equal(current.body.data.role,'admin');
  const continued=await poll(p,p.pending+'; farmacia-access=expired.invalid.cookie').expect(200);assert.equal(continued.body.data.usuario.email,p.values.email);
});

test('un cambio de cuenta, rol, época, revocación o vencimiento invalida el permiso de continuación',async()=>{
  for(const scenario of ['expired','email','role','epoch','version','revoked','retry-expired']){
    const p=await register();await confirm(p);const user=await fixture.db.usuario.findUnique({where:{email:p.values.email}});
    if(['revoked','retry-expired'].includes(scenario))await poll(p).expect(200);
    if(scenario==='expired')await fixture.db.registroPendiente.update({where:{usuarioId:user.id},data:{createdAt:new Date(Date.now()-7200000),expiresAt:new Date(Date.now()-3600000)}});
    if(scenario==='email')await fixture.db.usuario.update({where:{id:user.id},data:{email:'cambiado-'+randomUUID().slice(0,8)+'@example.ec'}});
    if(scenario==='role')await fixture.db.usuario.update({where:{id:user.id},data:{role:'admin'}});
    if(scenario==='epoch')await fixture.db.usuario.update({where:{id:user.id},data:{tokenEpoch:randomUUID()}});
    if(scenario==='version')await fixture.db.usuario.update({where:{id:user.id},data:{tokenVersion:{increment:1}}});
    if(scenario==='revoked')await fixture.db.sesionWeb.updateMany({where:{usuarioId:user.id},data:{revokedAt:new Date()}});
    if(scenario==='retry-expired')await fixture.db.registroPendiente.update({where:{usuarioId:user.id},data:{createdAt:new Date(Date.now()-120000),consumedAt:new Date(Date.now()-61000)}});
    const rejected=await poll(p).expect(204);assert.ok(!(rejected.headers['set-cookie']||[]).some(value=>/^farmacia-(access|refresh)=/.test(value)));
  }
});

test('dos comprobaciones concurrentes consumen un permiso una sola vez',async()=>{
  const p=await register();await confirm(p);const user=await fixture.db.usuario.findUnique({where:{email:p.values.email}}),before=await fixture.db.sesionWeb.count({where:{usuarioId:user.id}});
  const results=await Promise.all([poll(p),poll(p)]);assert.ok(results.every(response=>response.status===200));
  assert.equal(await fixture.db.sesionWeb.count({where:{usuarioId:user.id}}),before+1);
  assert.equal(cookies(results[0]).split('; ').find(value=>value.startsWith('farmacia-refresh=')),cookies(results[1]).split('; ').find(value=>value.startsWith('farmacia-refresh=')));
});

test('el permiso de otro registro abierto en el navegador no consume la continuación ajena',async()=>{
  const first=await register(),second=await register();await confirm(first);await confirm(second);
  const before=await fixture.db.sesionWeb.count();
  const mismatch=await poll(first,second.pending).expect(204);assert.equal(mismatch.headers['set-cookie'],undefined);
  assert.equal(await fixture.db.sesionWeb.count(),before);
  const secondUser=await fixture.db.usuario.findUnique({where:{email:second.values.email}}),row=await fixture.db.registroPendiente.findUnique({where:{usuarioId:secondUser.id}});assert.equal(row.consumedAt,null);assert.equal(row.sessionId,null);
  await poll(first).expect(200);await poll(second).expect(200);
});

test('una sesión renovable ajena sigue protegida cuando su cookie de acceso venció',async()=>{
  const p=await register();await confirm(p);
  const other=await p.api.post('/api/auth/login').set(web).send({email:'email-admin@example.ec',password:'SyntheticEmailAdmin2026!'}).expect(200);
  const jwt=require('jsonwebtoken'),access=cookies(other).split('; ').find(value=>value.startsWith('farmacia-access=')).split('=')[1],payload=jwt.decode(access);
  const expired=jwt.sign({version:payload.version,epoch:payload.epoch,webSession:payload.webSession},fixture.config.secret,{algorithm:'HS256',subject:payload.sub,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:-1});
  const refresh=cookies(other).split('; ').find(value=>value.startsWith('farmacia-refresh='));
  const before=await fixture.db.sesionWeb.count();await poll(p,p.pending+'; farmacia-access='+expired+'; '+refresh).expect(204);
  assert.equal(await fixture.db.sesionWeb.count(),before);
  const row=await fixture.db.registroPendiente.findUnique({where:{usuarioId:(await fixture.db.usuario.findUnique({where:{email:p.values.email}})).id}});assert.equal(row.consumedAt,null);
});

test('un fallo al crear el permiso revierte el alta y permite repetir el registro',async()=>{
  const api=fixture.api(),values={nombre:'Cliente Recuperable',email:'recuperable-'+randomUUID().slice(0,8)+'@example.ec',telefono:'0990000000',cedula:'0102030400',password:'ClienteCorreo2026!'};
  const originalCreate=fixture.db.registroPendiente.create,originalTransaction=fixture.db.$transaction;
  const unavailable=async()=>{throw new Error('Synthetic registration storage failure');};
  fixture.db.registroPendiente.create=unavailable;
  fixture.db.$transaction=function(action,options){return originalTransaction.call(this,async tx=>{tx.registroPendiente.create=unavailable;return action(tx);},options);};
  try{await api.post('/api/auth/register').set(web).send(values).expect(500);}
  finally{fixture.db.registroPendiente.create=originalCreate;fixture.db.$transaction=originalTransaction;}
  assert.equal(await fixture.db.usuario.count({where:{email:values.email}}),0,'el fallo del permiso no debe dejar un correo ocupado');assert.equal(messages.length,0);
  const retried=await api.post('/api/auth/register').set(web).send(values).expect(202);assert.ok(pendingCookie(retried));assert.equal(messages.length,1);
});
