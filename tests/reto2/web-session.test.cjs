const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {createFixture}=require('./email-api-fixture.cjs');
const fixture=createFixture(),{db}=fixture,api=fixture.api(false);
after(()=>fixture.close());
const web={'X-Farmacia-Web':'1',Origin:'http://localhost:3300'};
const cookie=response=>(response.headers['set-cookie']||[]).map(value=>value.split(';')[0]).join('; ');
test('web: cookies privadas, CSRF, rotación y revocación inmediata sin exponer JWT',async()=>{
 const login=await api.post('/api/auth/login').set(web).send({email:'email-admin@example.ec',password:'SyntheticEmailAdmin2026!'}).expect(200);
 assert.equal(login.body.data.token,undefined);assert.equal(login.body.data.usuario.role,'admin');
 for(const value of login.headers['set-cookie']){assert.match(value,/HttpOnly/i);assert.match(value,/SameSite=Strict/i);}
 const cookies=cookie(login);
 await api.get('/api/auth/me').set('Cookie',cookies).expect(200);
 await api.put('/api/auth/me').set('Cookie',cookies).send({nombre:'Atacante',telefono:'0991234567'}).expect(403);
 await api.put('/api/auth/me').set({...web,Origin:'https://evil.example'}).set('Cookie',cookies).send({nombre:'Atacante',telefono:'0991234567'}).expect(403);
 const renewed=await api.post('/api/auth/web/refresh').set(web).set('Cookie',cookies).send({}).expect(200);
 assert.notEqual(cookie(renewed),cookies);assert.equal(renewed.body.data.token,undefined);
 const retry=await api.post('/api/auth/web/refresh').set(web).set('Cookie',cookies).send({}).expect(200);
 assert.equal(cookie(retry).split('; ')[1],cookie(renewed).split('; ')[1],'reintentar la respuesta perdida devuelve el mismo secreto');
 await api.post('/api/auth/logout').set(web).set('Cookie',cookie(renewed)).send({}).expect(204);
 await api.get('/api/auth/me').set('Cookie',cookies).expect(401);
 await api.post('/api/auth/web/refresh').set(web).set('Cookie',cookie(renewed)).send({}).expect(204);
 const rows=await db.sesionWeb.findMany();assert.ok(rows.length);assert.ok(rows.every(row=>/^[a-f0-9]{64}$/.test(row.secretHash)));assert.ok(rows.every(row=>row.revokedAt));
});
test('web: una nueva época invalida acceso anterior y permite login y renovación nuevos',async()=>{
 const credentials={email:'email-admin@example.ec',password:'SyntheticEmailAdmin2026!'},old=await api.post('/api/auth/login').set(web).send(credentials).expect(200),id=old.body.data.usuario.id;
 await db.usuario.update({where:{id},data:{tokenEpoch:require('node:crypto').randomUUID()}});
 try{
  await api.get('/api/auth/me').set('Cookie',cookie(old)).expect(401);
  const login=await api.post('/api/auth/login').set(web).send(credentials).expect(200);assert.equal(login.body.data.usuario.tokenEpoch,undefined);
  await api.get('/api/auth/me').set('Cookie',cookie(login)).expect(200);
  const renewed=await api.post('/api/auth/web/refresh').set(web).set('Cookie',cookie(login)).send({}).expect(200);
  await api.get('/api/auth/me').set('Cookie',cookie(renewed)).expect(200);
 }finally{await db.usuario.update({where:{id},data:{tokenEpoch:null}});}
});

test('web: canje de sesión anterior y cookies Secure en producción',async()=>{
 const legacy=await api.post('/api/auth/login').send({email:'email-admin@example.ec',password:'SyntheticEmailAdmin2026!'}).expect(200);
 const token=legacy.body.data.token;assert.equal(typeof token,'string');
 await api.post('/api/auth/web/exchange').set('Authorization','Bearer '+token).send({}).expect(403);
 const exchanged=await api.post('/api/auth/web/exchange').set(web).set('Authorization','Bearer '+token).send({}).expect(200);
 assert.equal(exchanged.body.data.token,undefined);await api.get('/api/auth/me').set('Cookie',cookie(exchanged)).expect(200);
 const {names,options}=require('../../server/models/sesiones-web.cjs');
 assert.equal(names({production:true}).access,'__Host-farmacia-access');assert.equal(options({production:true}).secure,true);
 await api.get('/api/auth/me').set('Cookie',cookie(exchanged)).set('Authorization','Bearer invalid').expect(401);
 const secure=require('supertest')(require('../../server/app.cjs')({...fixture.config,production:true,origins:['https://farmacia.example']}));
 const login=await secure.post('/api/auth/login').set({'X-Farmacia-Web':'1',Origin:'https://farmacia.example'}).send({email:'email-admin@example.ec',password:'SyntheticEmailAdmin2026!'}).expect(200);
 for(const value of login.headers['set-cookie']){assert.match(value,/^__Host-farmacia-/);assert.match(value,/; Secure;/);assert.match(value,/; HttpOnly;/);assert.doesNotMatch(value,/Domain=/i);}
 const owner=legacy.body.data.usuario.id;
 await assert.rejects(db.sesionWeb.create({data:{usuarioId:owner,tokenVersion:0,secretHash:'invalid',expiresAt:new Date(Date.now()+60000)}}));
 if(fixture.provider==='postgresql'){
  const rows=await db.$queryRaw`SELECT relname, relrowsecurity FROM pg_class JOIN pg_namespace ON pg_namespace.oid=relnamespace WHERE nspname='public' AND relname IN ('SesionWeb','PasswordReset')`;
  assert.equal(rows.length,2);assert.ok(rows.every(row=>row.relrowsecurity));
  const grants=await db.$queryRaw`SELECT privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name IN ('SesionWeb','PasswordReset') AND grantee='PUBLIC'`;assert.equal(grants.length,0);
 }
});
