const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {randomUUID}=require('node:crypto');
const sharp=require('sharp');
const supertest=require('supertest');
const envKeys=['IMAGE_STORAGE','SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_STORAGE_BUCKET'];
const originalEnv=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
process.env.IMAGE_STORAGE='local';
const {db,directory}=require('./fixture.cjs');
const createApp=require('../../server/app.cjs');
const objects=new Map();const remoteRequests=[];
const secret='mock-cloud-routes-service-secret';
const modernSecret='sb_secret_synthetic-cloud-routes-key';
const knownReference='assets/uploads/'+randomUUID()+'.webp';
const newReference=()=> 'assets/uploads/'+randomUUID()+'.webp';
let server,origin,request,adminToken,product,photo;
const authorization=()=> 'Bearer '+adminToken;
const productBody=imagen=>({nombre:product.nombre,precio:Number(product.precio),stock:product.stock,categoria:product.categoria,descripcion:product.descripcion,imagen,alt:product.alt});
const promotionBody=(imagen=null)=>({titulo:'Campaña nube prueba',descripcion:'Promoción de integración con imagen opcional',etiqueta:'Promo 10%',productoId:product.id,activa:true,vistaPrevia:true,orden:0,descuentoPorcentaje:10,imagen,alt:imagen?'Fotografía de promoción':null,inicio:null,fin:null});
before(async()=>{
  photo=await sharp({create:{width:25,height:20,channels:3,background:'white'}}).png().toBuffer();
  objects.set(path.basename(knownReference),await sharp(photo).webp().toBuffer());
  server=http.createServer(async(req,res)=>{
    const entry={method:req.method,path:req.url,headers:req.headers};remoteRequests.push(entry);
    const match=/^\/storage\/v1\/object\/(public\/)?farmaciaproductos\/([0-9a-f-]{36}\.webp)$/.exec(req.url);
    if(!match){res.writeHead(404);return res.end();}
    const name=match[2];
    if(req.method==='HEAD' && match[1]){
      const data=objects.get(name);if(!data){res.writeHead(404);return res.end();}
      res.writeHead(200,{'content-type':'image/webp','content-length':data.length});return res.end();
    }
    if(req.method==='POST' && !match[1]){
      if(req.headers.apikey?.startsWith('sb_secret_') && req.headers.authorization){res.writeHead(401);return res.end('Secret keys are not JWTs');}
      const chunks=[];for await(const chunk of req)chunks.push(chunk);entry.body=Buffer.concat(chunks);
      if(objects.has(name)){res.writeHead(400);return res.end('already exists');}
      objects.set(name,entry.body);res.writeHead(200,{'content-type':'application/json'});return res.end('{}');
    }
    res.writeHead(405);res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  delete process.env.SUPABASE_SECRET_KEY;
  Object.assign(process.env,{IMAGE_STORAGE:'supabase',SUPABASE_URL:origin,SUPABASE_SERVICE_ROLE_KEY:secret,SUPABASE_STORAGE_BUCKET:'farmaciaproductos'});
  request=supertest(createApp());
  const login=await request.post('/api/auth/login').send({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD}).expect(200);adminToken=login.body.data.token;
  product=await db.producto.findFirst({where:{activo:true}});
});
after(async()=>{
  for(const key of envKeys){if(originalEnv[key]===undefined)delete process.env[key];else process.env[key]=originalEnv[key];}
  await db.$disconnect();
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'farmacia-reto2-'));
  await fs.rm(directory,{recursive:true,force:true});
});

test('referencia pública canónica redirige al bucket configurado sin claves y CSP permite solo su origen',async()=>{
  const response=await request.get('/'+knownReference).expect(302);
  assert.equal(response.headers.location,origin+'/storage/v1/object/public/farmaciaproductos/'+path.basename(knownReference));
  assert.equal(response.headers['cache-control'],'public, max-age=86400');
  assert.equal(JSON.stringify({headers:response.headers,text:response.text}).includes(secret),false);
  const imgSrc=response.headers['content-security-policy'].split(';').find(directive=>directive.startsWith('img-src '));
  assert.deepEqual(imgSrc.split(' '),['img-src',"'self'",'data:',origin]);
  const document=await request.get('/index.html').expect(200);assert.equal(document.headers['content-security-policy'].split(';').find(directive=>directive.startsWith('img-src ')),imgSrc);
  assert.equal(remoteRequests.length,0);
});

test('ruta pública rechaza nombres no canónicos, traversal y extensiones diferentes',async()=>{
  for(const invalid of ['foto.webp',randomUUID().toUpperCase()+'.webp',randomUUID()+'.png','00000000-0000-0000-0000-000000000000.webp','%2e%2e%2fsecreto.webp','%2e%2e%2f%2e%2e%2fserver%2fprisma%2ffarmacia.db','%00.webp']){
    const response=await request.get('/assets/uploads/'+invalid).expect(404);assert.equal(response.headers.location,undefined);assert.equal(response.body.error.code,'NOT_FOUND');
  }
  assert.equal(remoteRequests.length,0);
});

test('edición de producto rechaza imagen remota ausente sin modificar la base de datos',async()=>{
  const before=await db.producto.findUnique({where:{id:product.id}});
  const response=await request.put('/api/productos/'+product.id).set('Authorization',authorization()).send({...productBody(newReference()),nombre:'No debe guardarse'}).expect(422);
  assert.equal(response.body.error.code,'VALIDATION_ERROR');assert.ok(response.body.error.details.some(detail=>detail.field==='imagen'));
  assert.deepEqual(await db.producto.findUnique({where:{id:product.id}}),before);
  const head=remoteRequests.at(-1);assert.equal(head.method,'HEAD');assert.equal(head.headers.apikey,undefined);assert.equal(head.headers.authorization,undefined);
});

test('edición con imagen remota existente guarda la referencia y la publica para clientes',async()=>{
  const response=await request.put('/api/productos/'+product.id).set('Authorization',authorization()).send(productBody(knownReference)).expect(200);
  assert.equal(response.body.data.imagen,knownReference);assert.equal((await db.producto.findUnique({where:{id:product.id}})).imagen,knownReference);
  const publicProduct=await request.get('/api/productos/'+product.id).expect(200);assert.equal(publicProduct.body.data.imagen,knownReference);
  const redirect=await request.get('/'+publicProduct.body.data.imagen).expect(302);assert.equal(redirect.headers.location,origin+'/storage/v1/object/public/farmaciaproductos/'+path.basename(knownReference));
});

test('imagen opcional null de promociones es válida; imagen remota inexistente se rechaza',async()=>{
  const baseline=remoteRequests.length;const count=await db.promocion.count();
  const created=await request.post('/api/promociones').set('Authorization',authorization()).send(promotionBody()).expect(201);
  assert.equal(created.body.data.imagen,null);assert.equal(created.body.data.alt,null);assert.equal(remoteRequests.length,baseline);
  await request.post('/api/promociones').set('Authorization',authorization()).send(promotionBody(newReference())).expect(422);
  assert.equal(await db.promocion.count(),count+1);
  const present=await request.put('/api/promociones/'+created.body.data.id).set('Authorization',authorization()).send(promotionBody(knownReference)).expect(200);
  assert.equal(present.body.data.imagen,knownReference);
  assert.equal((await db.promocion.findUnique({where:{id:created.body.data.id}})).imagen,knownReference);
});

test('subida administrativa completa recodifica y guarda en nube con claves solo en POST servidor',async()=>{
  const response=await request.post('/api/admin/imagenes').set('Authorization',authorization()).send({archivo:photo.toString('base64'),nombreOriginal:'foto.png'}).expect(201);
  const image=response.body.data;assert.equal(image.ancho,25);assert.equal(image.alto,20);assert.match(image.imagen,/^assets\/uploads\/[0-9a-f-]{36}\.webp$/);
  const remote=remoteRequests.at(-1);assert.equal(remote.method,'POST');assert.equal(remote.headers.authorization,'Bearer '+secret);assert.equal(remote.headers.apikey,secret);assert.equal(remote.headers['x-upsert'],'false');
  const metadata=await sharp(objects.get(path.basename(image.imagen))).metadata();assert.equal(metadata.format,'webp');assert.equal(metadata.exif,undefined);
  assert.equal(JSON.stringify(response.body).includes(secret),false);assert.equal(response.body.data.publicUrl,undefined);
  const updated=await request.put('/api/productos/'+product.id).set('Authorization',authorization()).send(productBody(image.imagen)).expect(200);assert.equal(updated.body.data.imagen,image.imagen);
  const redirect=await request.get('/'+image.imagen).expect(302);assert.equal(redirect.headers.location,origin+'/storage/v1/object/public/farmaciaproductos/'+path.basename(image.imagen));
  assert.equal(remoteRequests.filter(entry=>entry.method==='HEAD').every(entry=>!entry.headers.apikey && !entry.headers.authorization),true);
});

test('subida administrativa usa Secret key sin Bearer y publica producto y promoción sin exponerla',async()=>{
  process.env.SUPABASE_SECRET_KEY=modernSecret;
  try{
    const response=await request.post('/api/admin/imagenes').set('Authorization',authorization()).send({archivo:photo.toString('base64'),nombreOriginal:'foto.png'}).expect(201);
    const remote=remoteRequests.at(-1);assert.equal(remote.method,'POST');assert.equal(remote.headers.apikey,modernSecret);assert.equal(remote.headers.authorization,undefined);
    assert.equal(JSON.stringify(response.body).includes(modernSecret),false);
    const ref=response.body.data.imagen;
    await request.put('/api/productos/'+product.id).set('Authorization',authorization()).send(productBody(ref)).expect(200);
    const promo=await request.post('/api/promociones').set('Authorization',authorization()).send(promotionBody(ref)).expect(201);
    assert.equal(promo.body.data.imagen,ref);assert.equal((await db.promocion.findUnique({where:{id:promo.body.data.id}})).imagen,ref);
    const publicProduct=await request.get('/api/productos/'+product.id).expect(200);assert.equal(publicProduct.body.data.imagen,ref);
    const publicImage=await request.get('/'+ref).expect(302);
    assert.equal(publicImage.headers.location,origin+'/storage/v1/object/public/farmaciaproductos/'+path.basename(ref));
    assert.equal(JSON.stringify({body:publicProduct.body,headers:publicImage.headers,text:publicImage.text}).includes(modernSecret),false);
    assert.equal(remoteRequests.filter(entry=>entry.method==='HEAD').every(entry=>!entry.headers.apikey && !entry.headers.authorization),true);
  }finally{delete process.env.SUPABASE_SECRET_KEY;}
});
