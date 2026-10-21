const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {randomUUID}=require('node:crypto');
const jwt=require('jsonwebtoken');
process.env.IMAGE_STORAGE='local';
const {db,request,directory}=require('./fixture.cjs');
const credentials={nombre:'Cliente Seguridad',email:'security-client@example.ec',telefono:'0979275988',cedula:'0102030400',password:'SecurityPrueba2026!'};
const product={nombre:'Producto seguridad',precio:4.25,stock:20,categoria:'cuidado',descripcion:'Producto sintético de seguridad',imagen:'assets/images/producto-vitaminas.jpg',alt:'Imagen sintética'};
const authorization=token=>'Bearer '+token;
let admin,user,adminToken,userToken,registration;
before(async()=>{
  const login=await request.post('/api/auth/login').send({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD}).expect(200);
  admin=login.body.data.usuario;adminToken=login.body.data.token;
  registration=await request.post('/api/auth/register').send(credentials).expect(201);
  user=registration.body.data.usuario;userToken=registration.body.data.token;
});
after(async()=>{
  await db.$disconnect();
  assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'farmacia-reto2-'));
  fs.rmSync(directory,{recursive:true,force:true});
});
function signed(options={},claims={}){
  return jwt.sign({version:0,...claims},process.env.JWT_SECRET,{algorithm:'HS256',subject:user.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'5m',...options});
}
async function captureDiagnostics(flag,work){
  const previous=process.env.PERF_DIAGNOSTICS,original=console.info,messages=[];
  process.env.PERF_DIAGNOSTICS=flag;console.info=value=>messages.push(value);
  try{await work(messages);}finally{console.info=original;if(previous===undefined)delete process.env.PERF_DIAGNOSTICS;else process.env.PERF_DIAGNOSTICS=previous;}
}

for(const flag of ['0','1'])test('auditoría atribuye escrituras admin sin datos privados con diagnóstico '+flag,async()=>{
  await captureDiagnostics(flag,async messages=>{
    const secret='synthetic-audit-private-value';
    const updated=await request.put('/api/productos/solar?private='+secret).set('Authorization',authorization(adminToken))
      .set('Cookie','private='+secret).set('X-Private-Test',secret).send({...product,descripcion:secret}).expect(200);
    const missing=await request.delete('/api/promociones/'+secret).set('Authorization',authorization(adminToken)).expect(404);
    const invalid=await request.put('/api/admin/facturacion/configuracion').set('Authorization',authorization(adminToken)).send({private:secret}).expect(422);
    await request.put('/api/productos/solar').send(product).expect(401);
    await request.put('/api/productos/solar').set('Authorization',authorization(userToken)).send(product).expect(403);
    await request.get('/api/productos?pageSize=1').expect(200);
    const events=messages.map(message=>JSON.parse(message)),audit=events.filter(event=>event.event==='admin_write');
    assert.equal(audit.length,3);
    const expected=[
      [updated,'product.update','/api/productos/:id',200],
      [missing,'promotion.delete','/api/promociones/:id',404],
      [invalid,'billing.configuration.update','/api/admin/facturacion/configuracion',422],
    ];
    for(const [response,action,route,status] of expected){
      const entry=audit.find(event=>event.requestId===response.headers['x-request-id']);
      assert.ok(entry,'La escritura debe conservar su requestId y actor');
      assert.equal(entry.actorId,admin.id);assert.equal(entry.action,action);assert.equal(entry.route,route);assert.equal(entry.status,status);
      assert.deepEqual(Object.keys(entry).sort(),['action','actorId','at','event','level','requestId','route','status']);
    }
    assert.ok(!messages.join('\n').includes(secret));assert.ok(!messages.join('\n').includes(adminToken));
    assert.ok(!messages.join('\n').includes(userToken));assert.ok(!messages.join('\n').includes(user.id));
    assert.ok(events.every(event=>!('headers' in event) && !('body' in event) && !('query' in event)));
    assert.equal(events.some(event=>event.event==='http_finish'),flag==='1');
    assert.equal(updated.headers['server-timing']!==undefined,flag==='1');
  });
});

test('sin diagnóstico se conserva el registro HTTP anterior en producción',async()=>{
  await captureDiagnostics('0',async messages=>{
    const previous=process.env.NODE_ENV;let response;
    try{process.env.NODE_ENV='production';response=await request.get('/api/productos?pageSize=1&private=synthetic-query').expect(200);}
    finally{process.env.NODE_ENV=previous;}
    assert.equal(messages.length,1);const entry=JSON.parse(messages[0]);
    assert.deepEqual(Object.keys(entry).sort(),['level','method','ms','path','requestId','status']);
    assert.equal(entry.path,'/productos');assert.equal(entry.method,'GET');assert.equal(entry.status,200);
    assert.equal(entry.requestId,response.headers['x-request-id']);assert.ok(Number.isFinite(entry.ms));
    assert.ok(!messages[0].includes('synthetic-query'));
  });
});

test('JWT rechaza por separado emisor, audiencia y algoritmo incorrectos',async()=>{
  await request.get('/api/auth/me').set('Authorization',authorization(signed())).expect(200);
  for(const options of [{issuer:'otro-emisor'},{audience:'otra-audiencia'},{algorithm:'HS384'}]){
    const response=await request.get('/api/auth/me').set('Authorization',authorization(signed(options))).expect(401);
    assert.equal(response.body.error.code,'INVALID_TOKEN');
  }
});

test('la sesión usa el rol y estado activo vigentes de la base, no un rol del JWT',async()=>{
  const token=signed({}, {role:'admin'});
  await request.get('/api/admin/resumen').set('Authorization',authorization(token)).expect(403);
  try{
    await db.usuario.update({where:{id:user.id},data:{role:'admin'}});
    await request.get('/api/admin/resumen').set('Authorization',authorization(userToken)).expect(200);
    await db.usuario.update({where:{id:user.id},data:{role:'user',activo:false}});
    await request.get('/api/auth/me').set('Authorization',authorization(userToken)).expect(401);
    await request.post('/api/auth/login').send({email:credentials.email,password:credentials.password}).expect(401);
  }finally{await db.usuario.update({where:{id:user.id},data:{role:'user',activo:true}});}
  await request.get('/api/admin/resumen').set('Authorization',authorization(token)).expect(403);
});

test('autenticación no emite cookies y una cookie sin Bearer no autoriza escrituras',async()=>{
  assert.equal(registration.headers['set-cookie'],undefined);
  const login=await request.post('/api/auth/login').send({email:credentials.email,password:credentials.password}).expect(200);
  assert.equal(login.headers['set-cookie'],undefined);
  const cookie='farmacia-mvc-token='+adminToken;
  await request.put('/api/productos/solar').set('Cookie',cookie).send(product).expect(401);
  await request.post('/api/auth/logout').set('Cookie',cookie).expect(401);
  await request.get('/api/auth/me').set('Authorization',authorization(adminToken)).expect(200);
});

test('idempotencia concurrente no comparte pedidos entre usuarios ni descuenta dos veces',async()=>{
  const other=await request.post('/api/auth/register').send({...credentials,email:'security-other@example.ec'}).expect(201);
  const created=await request.post('/api/productos').set('Authorization',authorization(adminToken)).send({...product,stock:2}).expect(201);
  const id=created.body.data.id,key=randomUUID();
  const body={claveSolicitud:key,carrito:[{productoId:id,cantidad:1}],comprador:{name:credentials.nombre,email:credentials.email,phone:credentials.telefono,documentType:'cedula',document:credentials.cedula,delivery:'pickup',province:'',city:'',address:'',postalCode:''}};
  const responses=await Promise.all([userToken,userToken,other.body.data.token].map(token=>request.post('/api/pedidos').set('Authorization',authorization(token)).send(body)));
  assert.deepEqual(responses.slice(0,2).map(response=>response.status).sort(),[200,201]);assert.equal(responses[2].status,201);
  assert.equal(responses[0].body.data.id,responses[1].body.data.id);assert.notEqual(responses[0].body.data.id,responses[2].body.data.id);
  assert.equal(responses[0].body.data.userId,user.id);assert.equal(responses[2].body.data.userId,other.body.data.usuario.id);
  assert.equal(await db.pedido.count({where:{requestKey:key}}),2);
  assert.equal((await db.producto.findUnique({where:{id}})).stock,0);
});

test('logout revoca dos tokens válidos y permite iniciar una nueva sesión',async()=>{
  const second=signed({jwtid:randomUUID()});assert.notEqual(second,userToken);
  await request.get('/api/auth/me').set('Authorization',authorization(second)).expect(200);
  const logout=await request.post('/api/auth/logout').set('Authorization',authorization(userToken)).expect(204);
  assert.equal(logout.headers['set-cookie'],undefined);
  for(const token of [userToken,second])await request.get('/api/auth/me').set('Authorization',authorization(token)).expect(401);
  const fresh=await request.post('/api/auth/login').send({email:credentials.email,password:credentials.password}).expect(200);
  assert.notEqual(fresh.body.data.token,userToken);assert.equal(fresh.headers['set-cookie'],undefined);
  await request.get('/api/auth/me').set('Authorization',authorization(fresh.body.data.token)).expect(200);
});
