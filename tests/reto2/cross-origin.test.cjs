'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const jwt=require('jsonwebtoken');
const supertest=require('supertest');
process.env.IMAGE_STORAGE='local';
const {db,directory}=require('./fixture.cjs');
const config=require('../../server/config.cjs');
const createApp=require('../../server/app.cjs');
const origins=['http://localhost:3300','https://farmacia-prueba.pages.dev'];
const settings={...config(),origins,testApiLimit:1000};
const request=supertest(createApp(settings));

test('dos frontends autorizados reciben la API pública sin cookies ni caché compartida',async()=>{
  for(const origin of origins){
    const response=await request.get('/api/productos?pageSize=4').set('Origin',origin).expect(200);
    assert.equal(response.headers['access-control-allow-origin'],origin);
    assert.equal(response.headers['access-control-allow-credentials'],undefined);
    assert.equal(response.headers['cache-control'],'no-store');
    assert.match(response.headers.vary,/\bOrigin\b/);
    assert.ok(response.body.data.items.length>0);
  }
  await request.get('/api/productos?pageSize=4').expect(200);
});

test('preflight autoriza GET Bearer, POST JSON y PUT desde ambos frontends',async()=>{
  const cases=[
    {method:'GET',headers:'authorization',route:'/api/auth/me'},
    {method:'POST',headers:'content-type',route:'/api/auth/login'},
    {method:'PUT',headers:'authorization,content-type',route:'/api/productos/synthetic-id'},
  ];
  for(const origin of origins)for(const value of cases){
    const response=await request.options(value.route).set('Origin',origin)
      .set('Access-Control-Request-Method',value.method)
      .set('Access-Control-Request-Headers',value.headers).expect(204);
    assert.equal(response.headers['access-control-allow-origin'],origin);
    assert.equal(response.headers['access-control-allow-credentials'],undefined);
    assert.equal(response.headers['cache-control'],'no-store');
    assert.ok(response.headers['access-control-allow-methods'].split(',').includes(value.method));
    const allowed=response.headers['access-control-allow-headers'].toLowerCase().split(',');
    for(const header of value.headers.split(','))assert.ok(allowed.includes(header));
    assert.ok(!response.headers['access-control-allow-methods'].includes('*'));
    assert.ok(!response.headers['access-control-allow-headers'].includes('*'));
  }
});

test('orígenes maliciosos y null no obtienen acceso ni preflight',async()=>{
  for(const origin of ['https://evil.example','https://farmacia-prueba.pages.dev.evil.example','null']){
    for(const method of ['get','options']){
      let pending=request[method]('/api/productos').set('Origin',origin);
      if(method==='options')pending=pending.set('Access-Control-Request-Method','GET');
      const response=await pending.expect(403);
      assert.equal(response.headers['access-control-allow-origin'],undefined);
      assert.equal(response.headers['access-control-allow-credentials'],undefined);
      assert.equal(response.headers['cache-control'],'no-store');
      assert.equal(response.body.error.code,'CORS_FORBIDDEN');
    }
  }
});

test('preflight no consume el límite de las peticiones reales',async()=>{
  const limited=supertest(createApp({...settings,testApiLimit:1}));
  for(let index=0;index<3;index++)await limited.options('/api/desconocido')
    .set('Origin',origins[1]).set('Access-Control-Request-Method','GET').expect(204);
  await limited.get('/api/desconocido').set('Origin',origins[1]).expect(404);
  const response=await limited.get('/api/desconocido').set('Origin',origins[1]).expect(429);
  assert.equal(response.headers['access-control-allow-origin'],origins[1]);
  assert.equal(response.headers['cache-control'],'no-store');
});

test('CORS no sustituye JWT, rol admin ni protección de los comprobantes',async()=>{
  const response=await request.get('/api/admin/resumen').set('Origin',origins[1]).expect(401);
  assert.equal(response.headers['cross-origin-resource-policy'],'same-origin');
  assert.equal(response.headers['cache-control'],'no-store');
  const admin=await db.usuario.findUnique({where:{email:process.env.ADMIN_EMAIL}});
  const user=await db.usuario.create({data:{nombre:'Cliente CORS',email:'cross-origin-user@example.ec',telefono:'+593979275988',passwordHash:admin.passwordHash}});
  const userToken=jwt.sign({version:user.tokenVersion},settings.secret,{subject:user.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'1m'});
  await request.get('/api/admin/resumen').set('Origin',origins[1]).set('Authorization','Bearer '+userToken).expect(403);
  const token=jwt.sign({version:admin.tokenVersion},settings.secret,{subject:admin.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'1m'});
  const ride=await request.get('/api/facturacion/facturas/synthetic-missing/ride')
    .set('Origin',origins[1]).set('Authorization','Bearer '+token).expect(404);
  assert.equal(ride.headers['cross-origin-resource-policy'],'same-origin');
  assert.equal(ride.headers['cache-control'],'no-store');
  assert.match(ride.headers['content-security-policy'],/default-src 'none'/);
  assert.match(ride.headers['content-security-policy'],/frame-ancestors 'none'/);
});

test('solo las imágenes públicas subidas permiten carga entre orígenes en almacenamiento local',async()=>{
  const previous=process.env.UPLOAD_DIR;
  const frontendRoot=path.join(directory,'public-frontend');
  const uploads=path.join(frontendRoot,'assets','uploads');
  const name='00000000-0000-4000-8000-000000000001.webp';
  fs.mkdirSync(uploads,{recursive:true});
  fs.writeFileSync(path.join(uploads,name),'synthetic-public-image');
  fs.writeFileSync(path.join(frontendRoot,'index.html'),'<!doctype html><title>Public fixture</title>');
  try{
    delete process.env.UPLOAD_DIR;
    const local=supertest(createApp({...settings,frontendRoot}));
    const image=await local.get('/assets/uploads/'+name).expect(200);
    assert.equal(image.headers['cross-origin-resource-policy'],'cross-origin');
    const html=await local.get('/index.html').expect(200);
    assert.equal(html.headers['cross-origin-resource-policy'],'same-origin');
  }finally{if(previous===undefined)delete process.env.UPLOAD_DIR;else process.env.UPLOAD_DIR=previous;}
});

test('la redirección de imagen pública a Supabase conserva CORP entre orígenes',async()=>{
  const keys=['IMAGE_STORAGE','SUPABASE_URL','SUPABASE_STORAGE_BUCKET'];
  const before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try{
    Object.assign(process.env,{IMAGE_STORAGE:'supabase',SUPABASE_URL:'https://synthetic-project.supabase.co',SUPABASE_STORAGE_BUCKET:'public-test'});
    const cloud=supertest(createApp(settings));
    const response=await cloud.get('/assets/uploads/00000000-0000-4000-8000-000000000002.webp').expect(302);
    assert.equal(response.headers['cross-origin-resource-policy'],'cross-origin');
    assert.equal(response.headers.location,'https://synthetic-project.supabase.co/storage/v1/object/public/public-test/00000000-0000-4000-8000-000000000002.webp');
  }finally{for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});

test('configuración conserva listas explícitas y exige HTTPS en producción',()=>{
  const before={CORS_ORIGIN:process.env.CORS_ORIGIN,NODE_ENV:process.env.NODE_ENV};
  try{
    process.env.CORS_ORIGIN='https://farmacia-prueba.pages.dev, https://farmacia-prueba.onrender.com';
    process.env.NODE_ENV='production';
    assert.deepEqual(config().origins,['https://farmacia-prueba.pages.dev','https://farmacia-prueba.onrender.com']);
    process.env.CORS_ORIGIN='http://localhost:3300';
    assert.throws(config,/HTTPS/);
    process.env.NODE_ENV='test';
    assert.deepEqual(config().origins,['http://localhost:3300']);
  }finally{Object.assign(process.env,before);}
});

for(const [label,origin] of [
  ['credenciales','https://user:synthetic@farmacia.example.ec'],
  ['consulta','https://farmacia.example.ec?query=value'],
  ['fragmento','https://farmacia.example.ec#section'],
  ['ruta','https://farmacia.example.ec/path'],
  ['barra final','https://farmacia.example.ec/'],
  ['comodín global','*'],
  ['comodín de subdominio','https://*.pages.dev'],
  ['origen opaco','null'],
])test('configuración rechaza origen con '+label,()=>{
  const previous=process.env.CORS_ORIGIN;
  try{process.env.CORS_ORIGIN=origin;assert.throws(config,/CORS_ORIGIN/);}
  finally{process.env.CORS_ORIGIN=previous;}
});

after(async()=>{
  await db.$disconnect();
  assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));
  assert.ok(path.basename(directory).startsWith('farmacia-reto2-'));
  fs.rmSync(directory,{recursive:true,force:true});
});
