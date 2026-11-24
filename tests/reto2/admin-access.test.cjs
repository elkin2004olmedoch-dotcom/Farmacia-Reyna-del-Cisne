const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const bcrypt=require('bcrypt');
const {accessConfiguration,provisionAdmin}=require('../../scripts/provision-admin.cjs');
const {db,request}=require('./fixture.cjs');
after(()=>db.$disconnect());

test('la provisión administrativa exige un nombre válido y un hash privado explícito',()=>{
  assert.equal(accessConfiguration({}),null);
  assert.deepEqual(accessConfiguration({ADMIN_USERNAME:' GESTOR ',ADMIN_EMAIL:'owner@example.ec'}),{username:'gestor',email:'owner@example.ec',passwordHash:null});
  for(const values of [
    {ADMIN_USERNAME:'admin@x.ec',ADMIN_EMAIL:'owner@example.ec'},
    {ADMIN_USERNAME:'gestor',ADMIN_EMAIL:'invalid'},
    {ADMIN_USERNAME:'gestor',ADMIN_EMAIL:'owner@example.ec',ADMIN_LOGIN_PASSWORD_HASH:'plain-password'},
    {ADMIN_EMAIL:'owner@example.ec',ADMIN_LOGIN_PASSWORD_HASH:'plain-password'},
    {ADMIN_USERNAME:'gestor',ADMIN_EMAIL:'owner@example.ec',ADMIN_LOGIN_PASSWORD_HASH:'$2y$12$'+'A'.repeat(53)},
  ])assert.throws(()=>accessConfiguration(values));
});

test('el acceso por usuario y correo conserva JWT, permisos y validación',async()=>{
  const password='ClaveSoloLetras';
  const user=await db.usuario.create({data:{nombre:'Gestor Prueba',email:'gestor-test@example.ec',username:'gestor_test',telefono:'+593991234567',role:'admin',passwordHash:await bcrypt.hash(password,12)}});
  for(const body of [{username:' GESTOR_TEST ',password},{email:'gestor_test',password},{email:'GESTOR-TEST@EXAMPLE.EC',password}]){
    const response=await request.post('/api/auth/login').send(body).expect(200);
    assert.equal(response.body.data.usuario.id,user.id);
    assert.equal(response.body.data.usuario.username,'gestor_test');
    assert(!JSON.stringify(response.body).includes('passwordHash'));
    await request.get('/api/auth/me').set('Authorization','Bearer '+response.body.data.token).expect(200);
  }
  await request.post('/api/auth/login').send({username:'gestor_test',password:'Incorrecta'}).expect(401);
  await request.post('/api/auth/login').send({username:'missing',password}).expect(401);
  for(const body of [{username:'a',password},{username:['gestor_test'],password},{username:'<gestor_test>',password},{email:'gestor_test',username:'gestor_test',password}])await request.post('/api/auth/login').send(body).expect(422);
  await db.usuario.update({where:{id:user.id},data:{activo:false}});
  await request.post('/api/auth/login').send({username:'gestor_test',password}).expect(401);
});

test('la provisión se aplica una vez, revoca sesiones y conserva cambios posteriores',async()=>{
  const email='provision-owner@example.ec';
  const oldHash=await bcrypt.hash('Anterior2026!',12),nextHash=await bcrypt.hash('NuevaClaveSoloLetras',12);
  const owner=await db.usuario.create({data:{nombre:'Propietario Prueba',email,telefono:'+593991234567',role:'admin',passwordHash:oldHash}});
  await db.sesionWeb.create({data:{usuarioId:owner.id,tokenVersion:0,secretHash:'a'.repeat(64),expiresAt:new Date(Date.now()+60000)}});
  const env={ADMIN_USERNAME:'gestor_nuevo',ADMIN_EMAIL:email,ADMIN_LOGIN_PASSWORD_HASH:nextHash};
  const result=await provisionAdmin({env});
  assert.equal(result.applied,true);
  const updated=await db.usuario.findUnique({where:{id:owner.id}});
  assert.equal(updated.username,'gestor_nuevo');assert.equal(updated.passwordHash,nextHash);assert.equal(updated.tokenVersion,1);
  assert.equal(await db.sesionWeb.count({where:{usuarioId:owner.id,revokedAt:null}}),0);
  const changed=await bcrypt.hash('Posterior2026!',12);
  await db.usuario.update({where:{id:owner.id},data:{passwordHash:changed,username:'gestor_editado'}});
  assert.equal((await provisionAdmin({env})).applied,false);
  assert.equal((await db.usuario.findUnique({where:{id:owner.id}})).passwordHash,changed);
  assert.equal(await db.auditoriaAdmin.count({where:{actorId:owner.id,accion:'admin.access.configure'}}),1);
});

test('provisión rechaza colisiones y cuentas sin rol administrativo',async()=>{
  const passwordHash=await bcrypt.hash('Prueba2026!',12);
  const user=await db.usuario.create({data:{nombre:'Cliente Prueba',email:'provision-user@example.ec',telefono:'+593991234567',passwordHash}});
  await assert.rejects(()=>provisionAdmin({env:{ADMIN_USERNAME:'gestor_cliente',ADMIN_EMAIL:user.email}}));
  assert.equal((await db.usuario.findUnique({where:{id:user.id}})).role,'user');
  const owner=await db.usuario.create({data:{nombre:'Propietario Prueba',email:'provision-collision@example.ec',telefono:'+593991234567',role:'admin',passwordHash}});
  await db.usuario.create({data:{nombre:'Otro Gestor',email:'provision-other@example.ec',username:'gestor_ocupado',telefono:'+593991234567',role:'admin',passwordHash}});
  await assert.rejects(()=>provisionAdmin({env:{ADMIN_USERNAME:'gestor_ocupado',ADMIN_EMAIL:owner.email}}));
  assert.equal((await db.usuario.findUnique({where:{id:owner.id}})).username,null);
});
