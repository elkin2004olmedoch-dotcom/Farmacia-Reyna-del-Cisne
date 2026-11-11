const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID,randomBytes}=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
test('PostgreSQL aislado conserva relaciones y comprueba PATCH, advertencias, revisión y credenciales pendientes',{skip:!process.env.PHARMACY_TEST_DATABASE_URL,timeout:120000},async t=>{
 const url=new URL(process.env.PHARMACY_TEST_DATABASE_URL),meta=JSON.parse(fs.readFileSync(process.env.PHARMACY_TEST_POSTGRES_META,'utf8'));
 assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,String(meta.port));assert.equal(url.username,'farmacia_test');assert.equal(url.password,'');assert.equal(url.pathname,'/farmacia_test');
 const {PrismaClient}=require('../../node_modules/.prisma-farmacia-postgresql'),control=new PrismaClient({datasources:{db:{url:url.href}}});let db;
 t.after(async()=>{if(db)await db.$disconnect();await control.$disconnect();});
 const database='farmacia_test_productos_'+randomUUID().replaceAll('-','');await control.$executeRawUnsafe('CREATE DATABASE "'+database+'"');url.pathname='/'+database;
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-pg-productos-')),env={};for(const key of ['SystemRoot','PATH','Path','TEMP','TMP','USERPROFILE','LOCALAPPDATA','NODE_OPTIONS'])if(process.env[key])env[key]=process.env[key];
 Object.assign(env,{NODE_ENV:'test',DATABASE_URL:url.href,JWT_SECRET:randomBytes(48).toString('hex'),CORS_ORIGIN:'http://localhost:3000',ADMIN_EMAIL:'pg-productos@example.ec',ADMIN_PASSWORD:'SyntheticPG2026!',UPLOAD_DIR:path.join(directory,'uploads'),IMAGE_STORAGE:'local',EMAIL_VERIFICATION_ENABLED:'false',CUSTOMER_REGISTRATION_REQUIRE_EMAIL:'false'});
 execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy','--schema','server/prisma/postgresql/schema.prisma'],{env,stdio:'pipe',windowsHide:true});execFileSync(process.execPath,['server/prisma/seed.cjs'],{env,stdio:'pipe',windowsHide:true});Object.assign(process.env,env);
 const config=require('../../server/config.cjs')(),request=require('supertest')(require('../../server/app.cjs')(config));db=require('../../server/models/db.cjs');
 const admin=await db.usuario.findFirst({where:{role:'admin'}}),jwt=require('jsonwebtoken'),headers={Authorization:'Bearer '+jwt.sign({version:admin.tokenVersion},config.secret,{subject:admin.id,issuer:'farmacia-reina',audience:'farmacia-web',expiresIn:'5m'})};
 const product=await db.producto.findFirst({where:{tipoProducto:'cuidado',activo:true}}),marker=await db.revisionCatalogo.findUnique({where:{id:'catalogo'}});
 const changed=(await request.patch('/api/productos/'+product.id).set(headers).send({advertencias:'Conservar según el envase.',esperadoUpdatedAt:product.updatedAt.toISOString()}).expect(200)).body.data;
 assert.equal(changed.stock,product.stock);assert.notEqual((await db.revisionCatalogo.findUnique({where:{id:'catalogo'}})).token,marker.token);
 await request.patch('/api/productos/'+product.id).set(headers).send({precio:3,esperadoUpdatedAt:product.updatedAt.toISOString()}).expect(409);
 await assert.rejects(db.$executeRaw`UPDATE "Producto" SET "advertencias"=${'x'.repeat(1001)} WHERE "id"=${product.id}`);
 const supplier=(await request.post('/api/admin/proveedores').set(headers).send({nombre:'Proveedor PostgreSQL',ruc:'0102030400001',email:'proveedor@example.ec',telefono:'0979275988',direccion:'Calle de prueba 123 frente al parque',activo:true}).expect(201)).body.data;
 await request.patch('/api/admin/proveedores/'+supplier.id).set(headers).send({nombre:'Proveedor actualizado',esperadoUpdatedAt:supplier.updatedAt}).expect(200);
 await request.get('/api/admin/proveedores/'+supplier.id).expect(401);
 const promotion=await db.promocion.create({data:{titulo:'Campaña privada',descripcion:'Campaña de revisión',etiqueta:'Cuidado',productoId:product.id,activa:false,inicio:new Date('2026-01-01T00:00:00Z'),fin:new Date('2027-01-01T00:00:00Z')}});
 const promo=(await request.patch('/api/promociones/'+promotion.id).set(headers).send({titulo:'Campaña actualizada',esperadoUpdatedAt:promotion.updatedAt.toISOString()}).expect(200)).body.data;assert.equal(promo.fin,promotion.fin.toISOString());
 await request.get('/api/admin/promociones/'+promotion.id).expect(401);
 const pending=await db.registroPendiente.create({data:{usuarioId:admin.id,email:admin.email,secretHash:'a'.repeat(64),tokenVersion:0,expiresAt:new Date(Date.now()+3600000)}});
 await assert.rejects(db.$executeRaw`UPDATE "RegistroPendiente" SET "secretHash"='invalid' WHERE "usuarioId"=${admin.id}`);assert.ok(pending);
 const tables=await db.$queryRaw`SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('RegistroPendiente','RevisionCatalogo')`;assert.equal(tables.length,2);assert.ok(tables.every(row=>row.relrowsecurity));
 for(const role of ['anon','authenticated']){await db.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO "'+role+'"');await db.$executeRawUnsafe('GRANT SELECT ON "RegistroPendiente","RevisionCatalogo" TO "'+role+'"');await db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET LOCAL ROLE "'+role+'"');assert.equal((await tx.$queryRaw`SELECT * FROM "RegistroPendiente"`).length,0);assert.equal((await tx.$queryRaw`SELECT * FROM "RevisionCatalogo"`).length,0);});}
 t.diagnostic('Solo base sintética '+database);
});
