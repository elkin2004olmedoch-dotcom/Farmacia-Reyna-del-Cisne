const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID,randomBytes,createHash}=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');

test('PostgreSQL aislado migra019 sin perder lotes o códigos y protege consumo MFA y relaciones SQL',{skip:!process.env.PHARMACY_TEST_DATABASE_URL,timeout:120000},async t=>{
 const url=new URL(process.env.PHARMACY_TEST_DATABASE_URL);
 const meta=JSON.parse(fs.readFileSync(process.env.PHARMACY_TEST_POSTGRES_META,'utf8'));
 assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,String(meta.port));assert.equal(url.username,'farmacia_test');assert.equal(url.password,'');assert.equal(url.pathname,'/farmacia_test');
 const {PrismaClient}=require('../../node_modules/.prisma-farmacia-postgresql');
 const control=new PrismaClient({datasources:{db:{url:url.href}}});
 const database='farmacia_test_normalizacion_'+randomUUID().replaceAll('-','');
 await control.$executeRawUnsafe('CREATE DATABASE "'+database+'"');url.pathname='/'+database;
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-pg-normalizacion-'));
 const source=path.resolve(__dirname,'../../backend/prisma/postgresql');
 const schema=path.join(directory,'schema.prisma');
 const name='202611230019_relational_normalization';
 fs.copyFileSync(path.join(source,'schema.prisma'),schema);
 fs.cpSync(path.join(source,'migrations'),path.join(directory,'migrations'),{recursive:true,filter:file=>!file.includes(name)});
 const env={};for(const key of ['SystemRoot','PATH','Path','TEMP','TMP','USERPROFILE','LOCALAPPDATA','NODE_OPTIONS'])if(process.env[key])env[key]=process.env[key];
 Object.assign(env,{NODE_ENV:'test',DATABASE_URL:url.href,JWT_SECRET:randomBytes(48).toString('hex'),CORS_ORIGIN:'http://localhost:3000',IMAGE_STORAGE:'local',EMAIL_VERIFICATION_ENABLED:'false',CUSTOMER_REGISTRATION_REQUIRE_EMAIL:'false'});
 const migrate=()=>execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy','--schema',schema],{env,stdio:'pipe',windowsHide:true});
 migrate();const db=new PrismaClient({datasources:{db:{url:url.href}}});
 t.after(async()=>{await db.$disconnect();await control.$disconnect();});
 const user=await db.usuario.create({data:{nombre:'Administrador SQL',email:'normal-pg@example.ec',telefono:'+593991234567',passwordHash:'synthetic',role:'admin'}});
 const product=await db.producto.create({data:{nombre:'Producto SQL',precio:5,stock:10,categoria:'cuidado',descripcion:'Producto sintético',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase'}});
 const lot=await db.lote.create({data:{productoId:product.id,numero:'NORMAL-PG',vencimiento:'2090-01-01',stock:2,costoUnitario:1}});
 await db.$executeRaw`INSERT INTO "MovimientoInventario" ("id","productoId","loteId","tipo","cantidad","motivo") VALUES ('normal-pg-movement',${product.id},${lot.id},'entrada',2,'Ingreso de lote histórico')`;
 const codes=['a'.repeat(20),'b'.repeat(20)],hashes=codes.map(code=>createHash('sha256').update(code).digest('hex'));
 await db.$executeRaw`INSERT INTO "AdminMfa" ("usuarioId","secretCipher","enabled","recoveryHashes") VALUES (${user.id},'synthetic-cipher',true,${JSON.stringify(hashes)})`;
 const {snapshotPostgres,decryptSnapshot}=require('../../scripts/snapshot-postgres.cjs');
 const cipherKey=randomBytes(32),backupEnv={DATABASE_URL:url.href,MIGRATION_BACKUP_KEY:cipherKey.toString('base64'),POSTGRES_BACKUP_BUCKET:'farmacia-respaldos',SUPABASE_URL:'https://snapshot-fixture.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_'+'s'.repeat(32)};
 let ciphertext,networkCalls=0,concurrentWrite=false;
 const storage=async(value,options={})=>{
  networkCalls++;assert.equal(options.headers.Authorization,undefined);assert.equal(options.headers.apikey,backupEnv.SUPABASE_SECRET_KEY);
  const pathname=new URL(value).pathname;
  if(pathname.startsWith('/storage/v1/bucket/'))return new Response(JSON.stringify({id:'farmacia-respaldos',public:false}));
  if(options.method==='POST'){ciphertext=Buffer.from(options.body);assert.equal(ciphertext.includes(Buffer.from('synthetic-cipher')),false);return new Response('{}');}
  return new Response(ciphertext);
 };
 const consistentClient={$transaction:(callback,options)=>db.$transaction(async tx=>{
  assert.equal((await tx.$queryRawUnsafe('SHOW transaction_isolation'))[0].transaction_isolation,'repeatable read');
  return callback({$executeRawUnsafe:(...args)=>tx.$executeRawUnsafe(...args),$queryRawUnsafe:async(...args)=>{
   const rows=await tx.$queryRawUnsafe(...args);
   if(args[0].includes('pg_catalog.pg_tables')&&!concurrentWrite){
    assert.equal((await tx.$queryRawUnsafe('SHOW transaction_read_only'))[0].transaction_read_only,'on');
    await db.producto.update({where:{id:product.id},data:{precio:6}});concurrentWrite=true;
   }
   return rows;
  }});
 },options)};
 const saved=await snapshotPostgres({client:consistentClient,env:backupEnv,fetch:storage});
 const restored=decryptSnapshot(ciphertext,cipherKey);
 assert.equal(concurrentWrite,true);assert.equal(saved.counts.Producto,1);
 assert.equal(Number(JSON.parse(restored.tables.Producto[0]).precio),5);assert.equal(Number((await db.producto.findUnique({where:{id:product.id}})).precio),6);
 assert.equal(JSON.parse(restored.tables.MovimientoInventario[0]).loteId,lot.id);
 assert.deepEqual(JSON.parse(JSON.parse(restored.tables.AdminMfa[0]).recoveryHashes),hashes);
 assert.equal(restored.tables.MovimientoLote,undefined);assert.equal(restored.tables.AdminMfaRecuperacion,undefined);
 assert.equal(restored.tables._prisma_migrations.length,saved.counts._prisma_migrations);
 for(const [table,rows] of Object.entries(restored.tables))assert.equal(rows.length,saved.counts[table]);
 fs.cpSync(path.join(source,'migrations',name),path.join(directory,'migrations',name),{recursive:true});
 await db.$executeRaw`UPDATE "AdminMfa" SET "recoveryHashes"='["invalid-hash"]' WHERE "usuarioId"=${user.id}`;
 assert.throws(migrate);
 assert.equal((await db.$queryRaw`SELECT "loteId" FROM "MovimientoInventario" WHERE "id"='normal-pg-movement'`)[0].loteId,lot.id);
 assert.equal((await db.$queryRaw`SELECT "recoveryHashes" FROM "AdminMfa" WHERE "usuarioId"=${user.id}`)[0].recoveryHashes,'["invalid-hash"]');
 await db.$executeRaw`UPDATE "AdminMfa" SET "recoveryHashes"=${JSON.stringify(hashes)} WHERE "usuarioId"=${user.id}`;
 execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','resolve','--rolled-back',name,'--schema',schema],{env,stdio:'pipe',windowsHide:true});
 migrate();
 const savedNetworkCalls=networkCalls;
 assert.deepEqual(await snapshotPostgres({client:db,env:backupEnv,fetch:storage}),{skipped:true,reason:'already-applied'});
 assert.equal(networkCalls,savedNetworkCalls);
 assert.equal((await db.movimientoLote.findUnique({where:{movimientoId:'normal-pg-movement'}})).loteId,lot.id);
 assert.deepEqual((await db.adminMfaRecuperacion.findMany({where:{usuarioId:user.id},orderBy:{hash:'asc'}})).map(row=>row.hash),[...hashes].sort());
 const other=await db.producto.create({data:{nombre:'Otro producto SQL',precio:5,stock:10,categoria:'cuidado',descripcion:'Producto sintético',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase'}});
 await assert.rejects(db.lote.update({where:{id:lot.id},data:{productoId:other.id}}));
 await assert.rejects(db.movimientoInventario.update({where:{id:'normal-pg-movement'},data:{productoId:other.id}}));
 await assert.rejects(db.movimientoInventario.update({where:{id:'normal-pg-movement'},data:{cantidad:0}}));
 const rls=await db.$queryRaw`SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('MovimientoLote','AdminMfaRecuperacion')`;
 assert.equal(rls.length,2);assert(rls.every(row=>row.relrowsecurity));
 Object.assign(process.env,env);
 const config=require('../../backend/config.cjs')();
 const appDb=require('../../backend/models/db.cjs');t.after(()=>appDb.$disconnect());
 const mfa=require('../../backend/models/admin-mfa.cjs'),challenge=await mfa.challenge(user,config);
 const attempts=await Promise.allSettled([mfa.login(challenge,codes[0],config),mfa.login(challenge,codes[0],config)]);
 assert.equal(attempts.filter(result=>result.status==='fulfilled').length,1);
 assert.equal(await db.adminMfaRecuperacion.count({where:{usuarioId:user.id,usedAt:{not:null}}}),1);
 for(const role of ['anon','authenticated']){
  await db.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO "'+role+'"');
  await db.$executeRawUnsafe('GRANT SELECT ON "MovimientoLote","AdminMfaRecuperacion" TO "'+role+'"');
  await db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET LOCAL ROLE "'+role+'"');assert.deepEqual(await tx.$queryRaw`SELECT * FROM "AdminMfaRecuperacion"`,[]);assert.deepEqual(await tx.$queryRaw`SELECT * FROM "MovimientoLote"`,[]);});
 }
 t.diagnostic('Base sintética retenida: '+database);
});
