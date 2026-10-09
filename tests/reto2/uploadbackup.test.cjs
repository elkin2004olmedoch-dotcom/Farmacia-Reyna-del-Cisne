const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {randomUUID}=require('node:crypto');
const sharp=require('sharp');
const bcrypt=require('bcrypt');
const jwt=require('jsonwebtoken');
const {PrismaClient}=require('@prisma/client');
const {db,request,directory}=require('./fixture.cjs');
const {validImagePath,MAX_BYTES}=require('../../server/middleware/imagevalidation.cjs');
const {createBackup,validateBackup,restoreBackup,startAutomaticBackups}=require('../../server/models/backups.cjs');
let adminToken,userToken,image,uploaded;
const backups=path.join(directory,'backups');
before(async()=>{
  const response=await request.post('/api/auth/login').send({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD}).expect(200);adminToken=response.body.data.token;
  const user=await db.usuario.create({data:{email:'images-client@example.ec',nombre:'Cliente Imágenes',telefono:'+593979275988',passwordHash:await bcrypt.hash('UsuarioImagen2026!',4)}});
  userToken=jwt.sign({role:'user',version:user.tokenVersion},process.env.JWT_SECRET,{algorithm:'HS256',expiresIn:'30m',subject:user.id,issuer:'farmacia-reina',audience:'farmacia-web'});
  image=await sharp({create:{width:30,height:20,channels:3,background:'#b51c36'}}).withExif({IFD0:{Copyright:'Metadato privado'}}).png().toBuffer();
});
const auth=token=>'Bearer '+token;
test('subir imagen requiere administrador antes de analizar el cuerpo grande',async()=>{
  await request.post('/api/admin/imagenes').send({archivo:'x'.repeat(50000),nombreOriginal:'imagen.png'}).expect(401);
  await request.post('/api/admin/imagenes').set('Authorization',auth(userToken)).send({archivo:image.toString('base64'),nombreOriginal:'imagen.png'}).expect(403);
});
test('JPEG, PNG y WebP se decodifican y recodifican sin metadatos con URL local segura',async()=>{
  for(const format of ['png','jpeg','webp']){
    const buffer=format==='png'?image:await sharp(image).toFormat(format).toBuffer();
    const response=await request.post('/api/admin/imagenes').set('Authorization',auth(adminToken)).send({archivo:buffer.toString('base64'),nombreOriginal:'foto.'+format}).expect(201);
    const data=response.body.data;assert.match(data.imagen,/^assets\/uploads\/[0-9a-f-]{36}\.webp$/);assert.equal(data.ancho,30);assert.equal(data.alto,20);assert.equal(validImagePath(data.imagen),true);
    const downloaded=await request.get('/'+data.imagen).expect(200);assert.match(downloaded.headers['content-type'],/^image\/webp/);
    const metadata=await sharp(await fs.readFile(path.join(process.env.UPLOAD_DIR,path.basename(data.imagen)))).metadata();assert.equal(metadata.format,'webp');assert.equal(metadata.exif,undefined);assert.equal(metadata.icc,undefined);
    uploaded=data.imagen;
  }
  assert.equal(validImagePath('assets/uploads/../../server/prisma/farmacia.db'),false);assert.equal(validImagePath('https://example.ec/foto.webp'),false);assert.equal(validImagePath('assets/uploads/'+randomUUID()+'.webp'),false);
});
test('subida rechaza SVG, rutas, base64 inválido, formato falso y dimensiones excesivas',async()=>{
  const cases=[{archivo:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64'),nombreOriginal:'foto.png'},{archivo:image.toString('base64'),nombreOriginal:'../foto.png'},{archivo:'%%INVALID%%',nombreOriginal:'foto.png'},{archivo:image.toString('base64'),nombreOriginal:'foto.jpg'}];
  for(const body of cases){const response=await request.post('/api/admin/imagenes').set('Authorization',auth(adminToken)).send(body).expect(422);assert.equal(response.body.error.code,'IMAGE_INVALID');}
  const wide=await sharp({create:{width:8193,height:1,channels:3,background:'red'}}).png().toBuffer();await request.post('/api/admin/imagenes').set('Authorization',auth(adminToken)).send({archivo:wide.toString('base64'),nombreOriginal:'ancho.png'}).expect(422);
});
test('límites de bytes binarios y JSON grande son exclusivos de la subida',async()=>{
  await request.post('/api/admin/imagenes').set('Authorization',auth(adminToken)).send({archivo:Buffer.alloc(MAX_BYTES+1).toString('base64'),nombreOriginal:'grande.png'}).expect(422);
  await request.post('/api/admin/imagenes').set('Authorization',auth(adminToken)).send({archivo:'x'.repeat(3*1024*1024),nombreOriginal:'grande.png'}).expect(413);
  await request.post('/api/productos').set('Authorization',auth(adminToken)).send({nombre:'x'.repeat(40000)}).expect(413);
});
test('VACUUM INTO crea respaldo íntegro con imágenes referenciadas y restaura sin tocar BD fuente',async()=>{
  const product=await db.producto.findFirst();await db.producto.update({where:{id:product.id},data:{imagen:uploaded}});
  const key=randomUUID();const orderResponse=await request.post('/api/pedidos').set('Authorization',auth(userToken)).send({claveSolicitud:key,carrito:[{productoId:product.id,cantidad:1}],comprador:{name:'Cliente Imagen',email:'images-client@example.ec',phone:'0979275988',documentType:'cedula',document:'0102030400',delivery:'pickup',province:'',city:'',address:'',postalCode:''}}).expect(201);const order=orderResponse.body.data;
  const sourceUser=await db.usuario.findUnique({where:{email:'images-client@example.ec'}});
  const result=await createBackup({client:db,backupRoot:backups});const checked=await validateBackup(result.directory);
  assert.equal(checked.manifest.archivos.length,2);assert.equal(checked.manifest.archivos[1].referencia,uploaded);
  const target=path.join(directory,'restored.db');const uploadRoot=path.join(directory,'restored-uploads');
  await assert.rejects(restoreBackup({from:result.directory,targetDatabase:target,backupRoot:backups,uploadRoot}),/offline/);
  await restoreBackup({from:result.directory,targetDatabase:target,backupRoot:backups,uploadRoot,offline:true});
  const restored=new PrismaClient({datasources:{db:{url:'file:'+target.replaceAll('\\','/')}}});
  try{assert.equal(await restored.producto.count(),await db.producto.count());assert.equal((await restored.producto.findUnique({where:{id:product.id}})).imagen,uploaded);const recoveredUser=await restored.usuario.findUnique({where:{id:sourceUser.id}});assert.equal(recoveredUser.passwordHash,sourceUser.passwordHash);assert.equal(recoveredUser.tokenVersion,sourceUser.tokenVersion);const recoveredOrder=await restored.pedido.findUnique({where:{id:order.id},include:{detalles:true,historial:true}});assert.equal(recoveredOrder.requestKey,key);assert.equal(recoveredOrder.detalles.length,1);assert.equal(recoveredOrder.historial.length,1);assert.equal(recoveredOrder.detalles[0].productoId,product.id);await restored.producto.update({where:{id:product.id},data:{stock:2}});}finally{await restored.$disconnect();}
  await assert.rejects(restoreBackup({from:result.directory,targetDatabase:target,backupRoot:backups,uploadRoot,offline:true}),/--replace/);
  const replaced=await restoreBackup({from:result.directory,targetDatabase:target,backupRoot:backups,uploadRoot,replace:true,offline:true});assert.ok(replaced.previousBackup);await validateBackup(replaced.previousBackup);
  assert.equal((await db.producto.findUnique({where:{id:product.id}})).stock,product.stock-1);
});
test('respaldo alterado, rutas ajenas y servidor activo impiden restauración',async()=>{
  const result=await createBackup({client:db,backupRoot:backups});const corrupted=path.join(directory,'corrupted');await fs.cp(result.directory,corrupted,{recursive:true});await fs.appendFile(path.join(corrupted,'farmacia.db'),'corrupto');await assert.rejects(validateBackup(corrupted),/SHA-256/);
  const outside=path.join(directory,'outside');await fs.cp(result.directory,outside,{recursive:true});const manifest=JSON.parse(await fs.readFile(path.join(outside,'manifest.json'),'utf8'));manifest.archivos[0].ruta='../test.db';await fs.writeFile(path.join(outside,'manifest.json'),JSON.stringify(manifest));await assert.rejects(validateBackup(outside),/ruta/);
  const target=path.join(directory,'test.db');const lock=path.join(backups,`.running-${process.pid}.json`);await fs.writeFile(lock,JSON.stringify({pid:process.pid,database:target}));try{await assert.rejects(restoreBackup({from:result.directory,targetDatabase:target,backupRoot:backups,replace:true,offline:true}),/Detén el servidor/);}finally{await fs.unlink(lock);}
});
test('retención conserva siete copias completas y no borra respaldo en preparación; automático desactivado en test',async()=>{
  const root=path.join(directory,'retention');await fs.mkdir(root);const pending=path.join(root,'.pending-'+randomUUID());await fs.mkdir(pending);
  for(let day=1;day<=8;day++)await createBackup({client:db,backupRoot:root,now:new Date(Date.UTC(2026,0,day))});
  const names=await fs.readdir(root);assert.equal(names.filter(name=>name.startsWith('backup-')).length,7);assert.ok(names.includes(path.basename(pending)));assert.ok(!names.some(name=>name.startsWith('backup-20260101')));
  const automaticRoot=path.join(directory,'automatic');const manager=await startAutomaticBackups({client:db,backupRoot:automaticRoot});await manager.stop();await assert.rejects(fs.access(automaticRoot),{code:'ENOENT'});
});
test('restaurar la copia más antigua conserva su origen durante el respaldo previo y aplica retención después',async()=>{
  const root=path.join(directory,'retention');const names=(await fs.readdir(root)).filter(name=>name.startsWith('backup-')).sort();const oldest=path.join(root,names[0]);const target=path.join(directory,'oldest-restored.db');
  await restoreBackup({from:oldest,targetDatabase:target,backupRoot:root,offline:true});
  const result=await restoreBackup({from:oldest,targetDatabase:target,backupRoot:root,offline:true,replace:true});assert.ok(result.previousBackup);
  const restored=new PrismaClient({datasources:{db:{url:'file:'+target.replaceAll('\\','/')}}});try{assert.equal(await restored.pedido.count(),await db.pedido.count());assert.equal(await restored.pedidoEstado.count(),await db.pedidoEstado.count());}finally{await restored.$disconnect();}
  assert.equal((await fs.readdir(root)).filter(name=>name.startsWith('backup-')).length,7);
});
test('destino SQLite corrupto se conserva con WAL/SHM y hashes antes de restaurar; copia fallida no reemplaza',async()=>{
  const source=await createBackup({client:db,backupRoot:backups});const target=path.join(directory,'corrupt-destination.db');const broken=Buffer.from('SQLite corrupto\0contenido original para recuperación');const wal=Buffer.from('WAL dañado preservado');const shm=Buffer.from('SHM dañado preservado');await fs.writeFile(target,broken);await fs.writeFile(target+'-wal',wal);await fs.writeFile(target+'-shm',shm);
  const result=await restoreBackup({from:source.directory,targetDatabase:target,backupRoot:backups,offline:true,replace:true});assert.equal(result.previousBackupType,'forense');assert.match(path.basename(result.previousBackup),/^recovery-/);
  const manifest=JSON.parse(await fs.readFile(path.join(result.previousBackup,'manifest.json'),'utf8'));assert.equal(manifest.restaurable,false);assert.equal(manifest.archivos.length,3);
  for(const [suffix,bytes] of [['',broken],['-wal',wal],['-shm',shm]]){assert.deepEqual(await fs.readFile(path.join(result.previousBackup,'farmacia.db'+suffix)),bytes);assert.equal(manifest.archivos.find(file=>file.ruta==='farmacia.db'+suffix).sha256,require('node:crypto').createHash('sha256').update(bytes).digest('hex'));}
  await assert.rejects(validateBackup(result.previousBackup),/manifiesto/);
  const restored=new PrismaClient({datasources:{db:{url:'file:'+target.replaceAll('\\','/')}}});try{assert.equal(await restored.usuario.count(),await db.usuario.count());const stock=await restored.producto.findMany({select:{id:true,stock:true},orderBy:{id:'asc'}});assert.deepEqual(stock,await db.producto.findMany({select:{id:true,stock:true},orderBy:{id:'asc'}}));assert.equal(await restored.pedido.count(),await db.pedido.count());}finally{await restored.$disconnect();}
  const rejected=path.join(directory,'copy-failure.db');await fs.writeFile(rejected,broken);await fs.mkdir(rejected+'-wal');await assert.rejects(restoreBackup({from:source.directory,targetDatabase:rejected,backupRoot:backups,offline:true,replace:true}),/conservar/);assert.deepEqual(await fs.readFile(rejected),broken);
  assert.ok((await fs.readdir(backups)).includes(path.basename(result.previousBackup)));
});
after(async()=>{await db.$disconnect();const absolute=path.resolve(directory);assert.ok(absolute.startsWith(path.resolve(os.tmpdir())+path.sep+'farmacia-reto2-'));await fs.rm(absolute,{recursive:true,force:true});});
