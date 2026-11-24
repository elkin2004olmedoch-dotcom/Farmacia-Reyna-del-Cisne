const {test}=require('node:test');
const assert=require('node:assert/strict');
let backup={};
try{backup=require('../../scripts/snapshot-postgres.cjs');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
const required=name=>{assert.equal(typeof backup[name],'function','Falta implementar '+name);return backup[name];};
const key=Buffer.alloc(32,7);
const env={MIGRATION_BACKUP_KEY:key.toString('base64'),POSTGRES_BACKUP_BUCKET:'farmacia-respaldos',SUPABASE_URL:'https://snapshot-test.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_'+'s'.repeat(32)};
const snapshot=()=>({version:1,provider:'postgresql',createdAt:'2026-11-23T12:00:00.000Z',tables:{Producto:['{"id":"p1","precio":123456789012345678.123456789}'],AdminMfa:['{"usuarioId":"u1","secretCipher":"synthetic-private-value"}'],_prisma_migrations:[]},counts:{Producto:1,AdminMfa:1,_prisma_migrations:0}});
function storage({missing=false,missingStatus=404,missingBody={statusCode:'404',error:'Bucket not found',message:'Bucket not found'},publicBucket=false,corrupt=false,failed=false}={}){
 const calls=[];let bytes,created=!missing;
 return {calls,get bytes(){return bytes;},fetch:async(value,options={})=>{
  const url=new URL(value),method=options.method||'GET';calls.push({path:url.pathname,method,headers:options.headers});
  assert.equal(url.origin,env.SUPABASE_URL);assert.equal(options.redirect,'error');
  assert.equal(options.headers.apikey,env.SUPABASE_SECRET_KEY);assert.equal(options.headers.Authorization,undefined);
  if(failed)return new Response('synthetic-provider-secret',{status:403});
  if(url.pathname==='/storage/v1/bucket/farmacia-respaldos')return new Response(created?JSON.stringify({id:'farmacia-respaldos',public:publicBucket}):typeof missingBody==='string'?missingBody:JSON.stringify(missingBody),{status:created?200:missingStatus});
  if(url.pathname==='/storage/v1/bucket'&&method==='POST'){assert.deepEqual(JSON.parse(options.body),{id:'farmacia-respaldos',name:'farmacia-respaldos',public:false});created=true;return new Response('{}',{status:200});}
  if(method==='POST'){assert.equal(options.headers['x-upsert'],'false');bytes=Buffer.from(options.body);return new Response('{}',{status:200});}
  const downloaded=Buffer.from(bytes);if(corrupt)downloaded[downloaded.length-1]^=1;
  return new Response(downloaded,{status:200});
 }};
}

test('el respaldo sólo se activa con clave canónica32bytes, host oficial y bucket separado',()=>{
 const config=required('configuration');assert.equal(config({}),null);
 assert.equal(config(env).bucket,'farmacia-respaldos');
 for(const changed of [
  {MIGRATION_BACKUP_KEY:Buffer.alloc(31).toString('base64')},{MIGRATION_BACKUP_KEY:key.toString('base64')+'\n'},
  {MIGRATION_BACKUP_KEY:undefined},{SUPABASE_URL:'http://snapshot-test.supabase.co'},
  {SUPABASE_URL:'https://snapshot-test.supabase.co.attacker.invalid'},{SUPABASE_URL:'https://user:secret@snapshot-test.supabase.co'},
  {POSTGRES_BACKUP_BUCKET:'farmaciaproductos'},{POSTGRES_BACKUP_BUCKET:'../private'},{SUPABASE_SECRET_KEY:'sb_publishable_synthetic'},
 ])assert.throws(()=>config({...env,...changed}),error=>error.code==='BACKUP_CONFIG'&&!/secret|snapshot-test/.test(error.message));
});

test('AES256GCM conserva filas textuales y rechaza cambios de bytes o clave',()=>{
 const encrypt=required('encryptSnapshot'),decrypt=required('decryptSnapshot');
 const first=encrypt(snapshot(),key),second=encrypt(snapshot(),key);
 assert(!first.equals(second));assert.equal(first.includes(Buffer.from('synthetic-private-value')),false);
 assert.deepEqual(decrypt(first,key),snapshot());
 assert(decrypt(first,key).tables.Producto[0].includes('123456789012345678.123456789'));
 const changed=Buffer.from(first);changed[changed.length-1]^=1;
 assert.throws(()=>decrypt(changed,key));assert.throws(()=>decrypt(first,Buffer.alloc(32,8)));
});

test('el snapshot falla antes de cifrar si supera64MiB o declara conteos inconsistentes',()=>{
 const encrypt=required('encryptSnapshot');
 const changed=snapshot();changed.counts.Producto=2;assert.throws(()=>encrypt(changed,key));
 const oversized=snapshot();oversized.tables.Producto=['x'.repeat(64*1024*1024)];
 assert.throws(()=>encrypt(oversized,key),error=>error.code==='BACKUP_LIMIT');
});

test('un bucket privado nuevo recibe sólo bytes cifrados y se verifica la descarga completa',async()=>{
 const remote=storage({missing:true});
 const result=await required('storeSnapshot')(snapshot(),required('configuration')(env),{fetch:remote.fetch});
 assert.equal(result.bucket,'farmacia-respaldos');assert.match(result.object,/^019-\d{8}T\d{9}Z-[a-f0-9-]{36}\.bin$/);
 assert.deepEqual(result.counts,{Producto:1,AdminMfa:1,_prisma_migrations:0});
 assert.equal(remote.bytes.includes(Buffer.from('secretCipher')),false);
 assert(remote.calls.some(call=>call.path.startsWith('/storage/v1/object/authenticated/')));
 assert.doesNotMatch(JSON.stringify(result),/synthetic-private|secret|sb_secret|https:/);
});

test('bucket público, error de proveedor o descarga alterada impiden aprobar el respaldo',async()=>{
 for(const scenario of [{publicBucket:true},{failed:true},{corrupt:true}]){
  const remote=storage(scenario);
  await assert.rejects(required('storeSnapshot')(snapshot(),required('configuration')(env),{fetch:remote.fetch}),error=>!error.message.includes('synthetic-provider-secret'));
  if(scenario.publicBucket)assert.equal(remote.calls.filter(call=>call.method==='POST').length,0);
 }
});

test('sólo ausencia estructurada del bucket autoriza crearlo con HTTP400 o404',async()=>{
 for(const missingStatus of [400,404]){
  const remote=storage({missing:true,missingStatus});
  await required('storeSnapshot')(snapshot(),required('configuration')(env),{fetch:remote.fetch});
  assert.equal(remote.calls.filter(call=>call.path==='/storage/v1/bucket'&&call.method==='POST').length,1);
 }
 for(const missingBody of ['not found',{statusCode:'404',error:'Unauthorized',message:'Bucket not found'},{statusCode:'403',error:'Bucket not found',message:'Bucket not found'},'x'.repeat(8193)]){
  const remote=storage({missing:true,missingBody});
  await assert.rejects(required('storeSnapshot')(snapshot(),required('configuration')(env),{fetch:remote.fetch}));
  assert.equal(remote.calls.filter(call=>call.method==='POST').length,0);
 }
});
