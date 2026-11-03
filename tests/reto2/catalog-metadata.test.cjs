const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
test('cada ficha inicial tiene empresa, presentación y foto local de la referencia identificada',()=>{
  const products=JSON.parse(fs.readFileSync(path.join(root,'data/productos.json'),'utf8'));
  const sources=JSON.parse(fs.readFileSync(path.join(root,'data/fuentes-productos.json'),'utf8')).productos;
  assert.equal(products.length,18);assert.equal(new Set(products.map(item=>item.id)).size,18);
  for(const product of products){
    assert.ok(typeof product.laboratorio==='string'&&product.laboratorio.trim().length>=2,product.id+': empresa');
    assert.ok(typeof product.presentacion==='string'&&product.presentacion.trim().length>=2,product.id+': presentación');
    assert.ok(['cuidado','insumo','suplemento'].includes(product.tipoProducto),product.id+': tipo');
    assert.doesNotMatch(product.name+' '+product.description,/referencial|imagen ilustrativa|zzzz|medicamento genérico/i);
    assert.match(product.image,/^assets\/images\/[a-z0-9-]+\.(png|jpg|webp)$/);
    for(const directory of ['', 'frontend'])assert.ok(fs.existsSync(path.join(root,directory,product.image)),product.id+': foto');
    const source=sources.find(item=>item.id===product.id),photo=fs.readFileSync(path.join(root,product.image));assert.ok(source,product.id+': fuente');
    for(const [field,key] of [['nombre','name'],['laboratorio','laboratorio'],['presentacion','presentacion'],['imagen','image']])assert.equal(source[field],product[key],product.id+': '+field);
    assert.equal(source.fotoSha256,require('node:crypto').createHash('sha256').update(photo).digest('hex'),product.id+': hash local');assert.equal(source.fotoBytes,photo.length,product.id+': bytes');
    assert.ok(photo.equals(fs.readFileSync(path.join(root,'frontend',product.image))),product.id+': misma foto en ambas tiendas');
  }
});

test('seed conserva metadatos en una base nueva y respeta cambios posteriores de la farmacia',async()=>{
  const os=require('node:os'),{execFileSync}=require('node:child_process'),{randomBytes}=require('node:crypto');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-catalog-metadata-'));
  const previous={...process.env};let db;
  try{
    const env={...process.env,NODE_ENV:'test',DATABASE_URL:'file:'+path.join(directory,'catalog.db').replaceAll('\\','/'),JWT_SECRET:randomBytes(48).toString('hex'),CORS_ORIGIN:'http://localhost:3000',IMAGE_STORAGE:'local',EMAIL_VERIFICATION_ENABLED:'false',CUSTOMER_REGISTRATION_REQUIRE_EMAIL:'false',ADMIN_EMAIL:'metadata-admin@example.ec',ADMIN_PASSWORD:'MetadataAdmin2026!'};
    fs.copyFileSync(path.join(root,'server/prisma/schema.prisma'),path.join(directory,'schema.prisma'));fs.cpSync(path.join(root,'server/prisma/migrations'),path.join(directory,'migrations'),{recursive:true});
    execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy','--schema',path.join(directory,'schema.prisma')],{cwd:directory,env,stdio:'pipe',windowsHide:true});
    const seed=()=>execFileSync(process.execPath,[path.join(root,'server/prisma/seed.cjs')],{cwd:root,env,stdio:'pipe',windowsHide:true});seed();
    Object.assign(process.env,env);db=require('../../server/models/db.cjs');
    const products=JSON.parse(fs.readFileSync(path.join(root,'data/productos.json'),'utf8'));const created=await db.producto.findMany();
    for(const item of products){const stored=created.find(row=>row.id===item.id);assert.equal(stored.laboratorio,item.laboratorio,item.id);assert.equal(stored.presentacion,item.presentacion,item.id);assert.equal(stored.tipoProducto,item.tipoProducto,item.id);}
    const api=require('supertest')(require('../../server/app.cjs')());const result=await api.get('/api/productos/filtros').expect(200);
    assert.ok(result.body.data.laboratorios.length>=5);assert.ok(result.body.data.presentaciones.length>=10);
    await db.producto.update({where:{id:'solar'},data:{laboratorio:'Empresa editada por la farmacia',presentacion:'Presentación editada por la farmacia',stock:7}});seed();
    const preserved=await db.producto.findUnique({where:{id:'solar'}});assert.equal(preserved.laboratorio,'Empresa editada por la farmacia');assert.equal(preserved.presentacion,'Presentación editada por la farmacia');assert.equal(preserved.stock,7);
  }finally{
    if(db)await db.$disconnect();for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);
    assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'farmacia-catalog-metadata-'));fs.rmSync(directory,{recursive:true,force:true});
  }
});
