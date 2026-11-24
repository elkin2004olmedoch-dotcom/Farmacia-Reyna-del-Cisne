const {test,after}=require('node:test'),assert=require('node:assert/strict');
const fixture=require('./email-api-fixture.cjs').createFixture(),{db,config}=fixture,api=fixture.api(false),OTP=require('otpauth');
let admin,secret,recovery;const headers=()=>({Authorization:'Bearer '+admin.token});const credentials={email:'email-admin@example.ec',password:'SyntheticEmailAdmin2026!'};
after(()=>fixture.close());
test('administrador activa segundo factor con contraseña y código; secretos cifrados y sesión anterior revocada',async()=>{
 admin=(await api.post('/api/auth/login').send(credentials).expect(200)).body.data;
 await api.post('/api/auth/mfa/setup').set(headers()).send({password:'incorrecta'}).expect(401);
 const setup=(await api.post('/api/auth/mfa/setup').set(headers()).send({password:credentials.password}).expect(200)).body.data;secret=setup.secret;
 assert.ok(secret);assert.equal((await db.adminMfa.findUnique({where:{usuarioId:admin.usuario.id}})).secretCipher.includes(secret),false);
 const token=new OTP.TOTP({secret}).generate();const enabled=(await api.post('/api/auth/mfa/enable').set(headers()).send({code:token}).expect(200)).body.data;
 recovery=enabled.recoveryCodes;assert.equal(recovery.length,8);await api.get('/api/auth/me').set(headers()).expect(401);
});
test('login exige segundo factor; desafío no da acceso, recuperación es de un uso',async()=>{
 const challenge=(await api.post('/api/auth/login').send(credentials).expect(200)).body.data;assert.equal(challenge.mfaRequired,true);assert.equal(challenge.token,undefined);
 await api.get('/api/auth/me').set('Authorization','Bearer '+challenge.challenge).expect(401);
 await api.post('/api/auth/mfa/login').send({challenge:challenge.challenge,code:'000000'}).expect(401);
 const logged=(await api.post('/api/auth/mfa/login').send({challenge:challenge.challenge,code:recovery[0]}).expect(200)).body.data;assert.ok(logged.token);admin=logged;
 await api.post('/api/auth/mfa/login').send({challenge:challenge.challenge,code:recovery[0]}).expect(401);
 const rows=await db.adminMfaRecuperacion.findMany({where:{usuarioId:admin.usuario.id}});assert.equal(rows.length,8);assert.equal(rows.filter(row=>row.usedAt!==null).length,1);assert.equal(JSON.stringify(rows).includes(recovery[0]),false);
});
test('desactivar requiere contraseña y segundo factor; no expone secreto en estado ni perfil',async()=>{
 const status=(await api.get('/api/auth/mfa').set(headers()).expect(200)).body.data;assert.deepEqual(status,{enabled:true});
 await api.post('/api/auth/mfa/disable').set(headers()).send({password:credentials.password,code:'000000'}).expect(401);
 await api.post('/api/auth/mfa/disable').set(headers()).send({password:credentials.password,code:recovery[1]}).expect(200);
 assert.equal((await db.adminMfa.findUnique({where:{usuarioId:admin.usuario.id}})).enabled,false);assert.equal(await db.adminMfaRecuperacion.count({where:{usuarioId:admin.usuario.id,usedAt:null}}),0);await api.get('/api/auth/me').set(headers()).expect(401);
});

test('los códigos MFA normalizados se consumen una sola vez bajo concurrencia y se revocan al reconfigurar',async()=>{
 const mfa=require('../../backend/models/admin-mfa.cjs');
 let actor=await db.usuario.findUnique({where:{email:credentials.email}});
 const setup=await mfa.setup(actor,credentials.password,config);
 const enabled=await mfa.enable(actor,new OTP.TOTP({secret:setup.secret}).generate(),config);actor=enabled.user;
 const stored=await db.adminMfaRecuperacion.findMany({where:{usuarioId:actor.id}});
 assert.equal(stored.length,16);assert.equal(stored.filter(row=>row.usedAt===null).length,8);
 for(const row of stored){assert.match(row.hash,/^[a-f0-9]{64}$/);assert.equal(enabled.recoveryCodes.includes(row.hash),false);}
 const challenge=await mfa.challenge(actor,config);
 const attempts=await Promise.allSettled([mfa.login(challenge,enabled.recoveryCodes[0],config),mfa.login(challenge,enabled.recoveryCodes[0],config)]);
 assert.equal(attempts.filter(result=>result.status==='fulfilled').length,1);
 assert.equal(await db.adminMfaRecuperacion.count({where:{usuarioId:actor.id,usedAt:{not:null}}}),9);
 actor=await mfa.disable(actor,credentials.password,enabled.recoveryCodes[1],config);
 assert.equal(await db.adminMfaRecuperacion.count({where:{usuarioId:actor.id,usedAt:null}}),0);
 const secondSetup=await mfa.setup(actor,credentials.password,config);
 const second=await mfa.enable(actor,new OTP.TOTP({secret:secondSetup.secret}).generate(),config);actor=second.user;
 assert.equal(await db.adminMfaRecuperacion.count({where:{usuarioId:actor.id}}),24);
 assert.equal(await db.adminMfaRecuperacion.count({where:{usuarioId:actor.id,usedAt:null}}),8);
 const currentChallenge=await mfa.challenge(actor,config);
 await assert.rejects(mfa.login(currentChallenge,enabled.recoveryCodes[2],config),error=>error.code==='MFA_INVALID');
 assert.equal((await mfa.login(currentChallenge,second.recoveryCodes[0],config)).id,actor.id);
 await db.adminMfa.delete({where:{usuarioId:actor.id}});
});
test('cinco códigos incorrectos bloquean el segundo factor sin entregar sesión',async()=>{
 admin=(await api.post('/api/auth/login').send(credentials).expect(200)).body.data;
 try{
  const setup=(await api.post('/api/auth/mfa/setup').set(headers()).send({password:credentials.password}).expect(200)).body.data;
  await api.post('/api/auth/mfa/enable').set(headers()).send({code:new OTP.TOTP({secret:setup.secret}).generate()}).expect(200);
  const challenge=(await api.post('/api/auth/login').send(credentials).expect(200)).body.data;
  for(let index=0;index<5;index++)await api.post('/api/auth/mfa/login').send({challenge:challenge.challenge,code:'invalido'}).expect(401);
  assert.equal((await db.adminMfa.findUnique({where:{usuarioId:admin.usuario.id}})).failedAttempts,5);
  await api.post('/api/auth/login').send(credentials).expect(429);
 }finally{await db.adminMfa.deleteMany({where:{usuarioId:admin.usuario.id}});await db.usuario.update({where:{id:admin.usuario.id},data:{tokenVersion:{increment:1}}});}
});
