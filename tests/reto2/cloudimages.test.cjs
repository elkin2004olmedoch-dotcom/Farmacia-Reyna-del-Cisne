const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const sharp=require('sharp');
const {isCloudStorage,getPublicImageUrl,uploadCloudImage,cloudImageExists}=require('../../server/models/cloudimages.cjs');
const {validImagePath,validImagePathAsync,MAX_BYTES}=require('../../server/middleware/imagevalidation.cjs');
const saveImage=require('../../server/models/imagenes.cjs');
const keys=['NODE_ENV','IMAGE_STORAGE','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_STORAGE_BUCKET','UPLOAD_DIR'];
const originalEnv=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
const objects=new Map();
const requests=[];
const secret='mock-service-role-secret';
let server,origin,temporary,mode='normal';
const reference=()=> 'assets/uploads/'+randomUUID()+'.webp';
function configured(){Object.assign(process.env,{NODE_ENV:'test',IMAGE_STORAGE:'supabase',SUPABASE_URL:origin,SUPABASE_SERVICE_ROLE_KEY:secret,SUPABASE_STORAGE_BUCKET:'farmaciaproductos'});mode='normal';}
function safeStorageError(error){assert.equal(error.status,503);assert.equal(error.code,'IMAGE_STORAGE_UNAVAILABLE');assert.equal(error.message.includes(secret),false);assert.equal(error.message.includes(origin),false);return true;}
before(async()=>{
  temporary=await fs.mkdtemp(path.join(os.tmpdir(),'farmacia-cloud-images-'));
  server=http.createServer(async(req,res)=>{
    const request={method:req.method,url:req.url,headers:req.headers};requests.push(request);
    if(mode==='timeout')return;
    if(mode==='redirect'){res.writeHead(302,{Location:origin+'/unexpected'});return res.end();}
    if(mode==='provider-error'){res.writeHead(500,{'content-type':'application/json'});return res.end(JSON.stringify({error:secret+' '+origin}));}
    if(req.method==='POST'){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);request.body=Buffer.concat(chunks);
      if(objects.has(req.url)){res.writeHead(400);return res.end('Asset Already Exists');}
      objects.set(req.url,request.body);res.writeHead(200,{'content-type':'application/json'});return res.end('{}');
    }
    if(req.method==='HEAD'){
      const buffer=objects.get(req.url.replace('/object/public/','/object/'));
      if(!buffer){res.writeHead(404);return res.end();}
      res.writeHead(200,{'content-type':'image/webp','content-length':buffer.length});return res.end();
    }
    res.writeHead(404);res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  configured();
});
after(async()=>{
  for(const key of keys){if(originalEnv[key]===undefined)delete process.env[key];else process.env[key]=originalEnv[key];}
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  await fs.rm(temporary,{recursive:true,force:true});
});

test('URL pública acepta exclusivamente referencias UUID v4 canónicas; no expone claves',()=>{
  configured();const ref=reference();const url=getPublicImageUrl(ref);
  assert.equal(url,origin+'/storage/v1/object/public/farmaciaproductos/'+path.basename(ref));
  assert.equal(url.includes(secret),false);
  for(const ref of ['https://example.ec/foto.webp','assets/uploads/../../secreto.webp','assets/uploads/'+randomUUID().toUpperCase()+'.webp','assets/uploads/'+randomUUID()+'.webp?secret=x','assets/images/producto.svg','assets/uploads/00000000-0000-0000-0000-000000000000.webp',null])assert.equal(getPublicImageUrl(ref),null);
  process.env.IMAGE_STORAGE='local';assert.equal(isCloudStorage(),false);assert.equal(getPublicImageUrl(ref),null);
});

test('configuración rechaza destinos ajenos, credenciales URL, rutas y buckets no seguros antes de enviar',async()=>{
  configured();const baseline=requests.length;
  for(const url of ['https://example.ec','https://project.supabase.co.evil.test','http://project.supabase.co','https://user:password@project.supabase.co','https://project.supabase.co/ruta','https://project.supabase.co/?token=secret','https://project.supabase.co/#secret','https://project.supabase.co:8443']){
    process.env.SUPABASE_URL=url;assert.equal(getPublicImageUrl(reference()),null);await assert.rejects(uploadCloudImage(reference(),Buffer.from('webp')),safeStorageError);
  }
  process.env.SUPABASE_URL=origin;process.env.NODE_ENV='production';await assert.rejects(uploadCloudImage(reference(),Buffer.from('webp')),safeStorageError);
  process.env.SUPABASE_URL='https://project.supabase.co';assert.match(getPublicImageUrl(reference()),/^https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\//);
  configured();process.env.SUPABASE_STORAGE_BUCKET='../other';await assert.rejects(uploadCloudImage(reference(),Buffer.from('webp')),safeStorageError);
  configured();process.env.SUPABASE_SERVICE_ROLE_KEY='\r\nmalicious';await assert.rejects(uploadCloudImage(reference(),Buffer.from('webp')),safeStorageError);
  assert.equal(requests.length,baseline);
});

test('subida usa POST autenticado, WebP, UUID nuevo y prohíbe sobrescribir',async()=>{
  configured();const ref=reference();const bytes=Buffer.from('processed-webp');
  assert.equal(await uploadCloudImage(ref,bytes),ref);
  const request=requests.at(-1);assert.equal(request.method,'POST');assert.equal(request.url,'/storage/v1/object/farmaciaproductos/'+path.basename(ref));
  assert.equal(request.headers.apikey,secret);assert.equal(request.headers.authorization,'Bearer '+secret);assert.equal(request.headers['x-upsert'],'false');assert.equal(request.headers['content-type'],'image/webp');assert.deepEqual(request.body,bytes);
  await assert.rejects(uploadCloudImage(ref,Buffer.from('replacement')),safeStorageError);assert.deepEqual(objects.get(request.url),bytes);
  assert.equal(await cloudImageExists(ref),true);assert.equal(requests.at(-1).method,'HEAD');assert.equal(requests.at(-1).headers.authorization,undefined);assert.equal(requests.at(-1).headers.apikey,undefined);
  assert.equal(await cloudImageExists(reference()),false);
});

test('límite de 2 MB y referencias malformadas se rechazan sin llamadas remotas',async()=>{
  configured();const ref=reference();const baseline=requests.length;
  for(const buffer of [Buffer.alloc(0),Buffer.alloc(MAX_BYTES+1),null])await assert.rejects(uploadCloudImage(ref,buffer),error=>error.code==='IMAGE_INVALID' && error.status===422);
  await assert.rejects(uploadCloudImage('assets/uploads/../../privado.webp',Buffer.from('data')),error=>error.code==='IMAGE_INVALID');
  assert.equal(await cloudImageExists('https://example.ec/foto.webp'),false);assert.equal(requests.length,baseline);
  await uploadCloudImage(ref,Buffer.alloc(MAX_BYTES));assert.equal(requests.at(-1).body.length,MAX_BYTES);
});

test('errores remotos y redirecciones no filtran respuestas ni siguen destinos',async()=>{
  configured();mode='provider-error';await assert.rejects(uploadCloudImage(reference(),Buffer.from('webp')),safeStorageError);await assert.rejects(cloudImageExists(reference()),safeStorageError);
  mode='redirect';const baseline=requests.length;await assert.rejects(uploadCloudImage(reference(),Buffer.from('webp')),safeStorageError);await assert.rejects(cloudImageExists(reference()),safeStorageError);
  assert.equal(requests.length,baseline+2);assert.equal(requests.some(request=>request.url==='/unexpected'),false);
});

test('validación asíncrona comprueba existencia remota y preserva archivos del catálogo local',async()=>{
  configured();const ref=reference();await uploadCloudImage(ref,Buffer.from('webp'));
  assert.equal(validImagePath(ref),false);assert.equal(await validImagePathAsync(ref),true);assert.equal(await validImagePathAsync(reference()),false);
  await fs.mkdir(path.join(temporary,'assets','images'),{recursive:true});await fs.writeFile(path.join(temporary,'assets','images','catalogo.svg'),'<svg/>');
  const baseline=requests.length;assert.equal(await validImagePathAsync('assets/images/catalogo.svg',temporary),true);assert.equal(await validImagePathAsync('assets/images/ausente.svg',temporary),false);assert.equal(await validImagePathAsync('assets/uploads/../catalogo.svg',temporary),false);assert.equal(requests.length,baseline);
});

test('Sharp elimina metadatos antes de subir, conserva referencia y no escribe al disco en modo nube',async()=>{
  configured();process.env.UPLOAD_DIR=path.join(temporary,'should-not-exist');
  const input=await sharp({create:{width:30,height:20,channels:3,background:'#b51c36'}}).withExif({IFD0:{Copyright:'Privado'}}).png().toBuffer();
  const result=await saveImage({buffer:input,nombreOriginal:'foto.png'},{frontendRoot:path.join(temporary,'nonexistent-root')});
  assert.match(result.imagen,/^assets\/uploads\/[0-9a-f-]{36}\.webp$/);assert.equal(result.ancho,30);assert.equal(result.alto,20);
  const metadata=await sharp(requests.at(-1).body).metadata();assert.equal(metadata.format,'webp');assert.equal(metadata.exif,undefined);assert.equal(metadata.icc,undefined);
  await assert.rejects(fs.stat(process.env.UPLOAD_DIR),error=>error.code==='ENOENT');
  await assert.rejects(saveImage({buffer:input,nombreOriginal:'foto.jpg'}),error=>error.code==='IMAGE_INVALID');
});

test('modo local sigue guardando y validando la imagen sin configurar Supabase',async()=>{
  configured();process.env.IMAGE_STORAGE='local';delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.UPLOAD_DIR=path.join(temporary,'local-uploads');
  const input=await sharp({create:{width:10,height:12,channels:3,background:'white'}}).png().toBuffer();
  const baseline=requests.length;const result=await saveImage({buffer:input,nombreOriginal:'foto.png'});
  assert.equal(result.ancho,10);assert.equal(result.alto,12);assert.equal(validImagePath(result.imagen),true);assert.equal(await validImagePathAsync(result.imagen),true);assert.equal(requests.length,baseline);
});

test('servicio remoto que no responde termina a los 8 segundos con error seguro',async()=>{
  configured();mode='timeout';const started=Date.now();await assert.rejects(uploadCloudImage(reference(),Buffer.from('webp')),safeStorageError);
  const elapsed=Date.now()-started;assert.ok(elapsed>=7500 && elapsed<12000,'timeout esperado de 8 segundos');mode='normal';
});
