'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const supertest=require('supertest');
process.env.IMAGE_STORAGE='local';
const {db,directory,request}=require('./fixture.cjs');
const createApp=require('../../server/app.cjs');
const config=require('../../server/config.cjs');

test('las imágenes públicas locales permiten carga desde un frontend separado',async()=>{
  const previous=process.env.UPLOAD_DIR;
  const frontendRoot=path.join(directory,'public-frontend');
  const uploads=path.join(frontendRoot,'assets','uploads');
  const name='00000000-0000-4000-8000-000000000001.webp';
  fs.mkdirSync(uploads,{recursive:true});
  fs.writeFileSync(path.join(uploads,name),'synthetic-public-image');
  fs.writeFileSync(path.join(frontendRoot,'index.html'),'<!doctype html><title>Public fixture</title>');
  try{
    delete process.env.UPLOAD_DIR;
    const local=supertest(createApp({...config(),frontendRoot}));
    const image=await local.get('/assets/uploads/'+name).expect(200);
    assert.equal(image.headers['cross-origin-resource-policy'],'cross-origin');
    const html=await local.get('/index.html').expect(200);
    assert.equal(html.headers['cross-origin-resource-policy'],'same-origin');
  }finally{if(previous===undefined)delete process.env.UPLOAD_DIR;else process.env.UPLOAD_DIR=previous;}
});

test('HEAD de imagen pública permite seguir la redirección a Supabase entre orígenes',async()=>{
  const keys=['IMAGE_STORAGE','SUPABASE_URL','SUPABASE_STORAGE_BUCKET'];
  const before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try{
    Object.assign(process.env,{IMAGE_STORAGE:'supabase',SUPABASE_URL:'https://synthetic-project.supabase.co',SUPABASE_STORAGE_BUCKET:'public-test'});
    const cloud=supertest(createApp(config()));
    const image=await cloud.head('/assets/uploads/00000000-0000-4000-8000-000000000002.webp').expect(302);
    assert.equal(image.headers['cross-origin-resource-policy'],'cross-origin');
    assert.equal(image.headers.location,'https://synthetic-project.supabase.co/storage/v1/object/public/public-test/00000000-0000-4000-8000-000000000002.webp');
    assert.equal(image.headers['cache-control'],'public, max-age=86400');
  }finally{for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});

test('API y comprobantes privados conservan autenticación, CORP y no-store',async()=>{
  for(const endpoint of ['/api/admin/resumen','/api/facturacion/facturas/synthetic-missing/ride']){
    const response=await request.get(endpoint).expect(401);
    assert.equal(response.headers['cross-origin-resource-policy'],'same-origin');
    assert.equal(response.headers['cache-control'],'no-store');
    assert.equal(response.body.error.code,'AUTH_REQUIRED');
  }
});

after(async()=>{
  await db.$disconnect();
  assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));
  assert.ok(path.basename(directory).startsWith('farmacia-reto2-'));
  fs.rmSync(directory,{recursive:true,force:true});
});
