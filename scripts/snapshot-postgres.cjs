const {randomBytes,randomUUID,createCipheriv,createDecipheriv,createHash}=require('node:crypto');

const MIGRATION='202611230019_relational_normalization';
const MAX_BYTES=64*1024*1024;
const MAGIC=Buffer.from('FRCPG019\0');
const fail=code=>{throw Object.assign(new Error('No se pudo verificar el respaldo PostgreSQL previo a la migración.'),{code});};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

function configuration(env){
  if(!env.MIGRATION_BACKUP_KEY&&!env.POSTGRES_BACKUP_BUCKET)return null;
  try{
    const value=env.MIGRATION_BACKUP_KEY;
    if(typeof value!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(value))throw new Error();
    const cipherKey=Buffer.from(value,'base64');
    if(cipherKey.length!==32||cipherKey.toString('base64')!==value)throw new Error();
    const url=new URL(env.SUPABASE_URL);
    if(url.protocol!=='https:'||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.supabase\.co$/.test(url.hostname)||url.port||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error();
    const bucket=env.POSTGRES_BACKUP_BUCKET||'farmacia-respaldos';
    if(!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(bucket)||bucket===(env.SUPABASE_STORAGE_BUCKET||'farmaciaproductos'))throw new Error();
    const key=env.SUPABASE_SECRET_KEY;
    if(typeof key!=='string'||!/^sb_secret_[A-Za-z0-9_-]{20,8192}$/.test(key))throw new Error();
    return {origin:url.origin,bucket,key,cipherKey};
  }catch{fail('BACKUP_CONFIG');}
}

function validateSnapshot(snapshot){
  if(snapshot?.version!==1||snapshot.provider!=='postgresql'||!snapshot.tables||!snapshot.counts)fail('BACKUP_INTEGRITY');
  const names=Object.keys(snapshot.tables);
  if(!names.length||names.length!==Object.keys(snapshot.counts).length)fail('BACKUP_INTEGRITY');
  for(const name of names){
    const rows=snapshot.tables[name];
    if(!/^(?:[A-Z][A-Za-z0-9]*|_prisma_migrations)$/.test(name)||!Array.isArray(rows)||!Number.isSafeInteger(snapshot.counts[name])||snapshot.counts[name]!==rows.length||rows.some(row=>typeof row!=='string'))fail('BACKUP_INTEGRITY');
  }
}

function encryptSnapshot(snapshot,key){
  const plain=Buffer.from(JSON.stringify(snapshot));
  if(plain.length>MAX_BYTES)fail('BACKUP_LIMIT');
  validateSnapshot(snapshot);
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(MAGIC);
  const encrypted=Buffer.concat([cipher.update(plain),cipher.final()]);
  return Buffer.concat([MAGIC,iv,cipher.getAuthTag(),encrypted]);
}

function decryptSnapshot(bytes,key){
  try{
    if(!Buffer.isBuffer(bytes)||bytes.length>MAX_BYTES+MAGIC.length+28||bytes.length<MAGIC.length+28||!bytes.subarray(0,MAGIC.length).equals(MAGIC))fail('BACKUP_INTEGRITY');
    const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(MAGIC.length,MAGIC.length+12));
    decipher.setAAD(MAGIC);decipher.setAuthTag(bytes.subarray(MAGIC.length+12,MAGIC.length+28));
    const plain=Buffer.concat([decipher.update(bytes.subarray(MAGIC.length+28)),decipher.final()]);
    const snapshot=JSON.parse(plain.toString('utf8'));validateSnapshot(snapshot);return snapshot;
  }catch{fail('BACKUP_INTEGRITY');}
}

async function readSnapshot(client){
  const {Prisma}=require('../node_modules/.prisma-farmacia-postgresql');
  const allowed=new Set([...Prisma.dmmf.datamodel.models.map(model=>model.dbName||model.name),'_prisma_migrations']);
  return client.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const tables=await tx.$queryRawUnsafe("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename");
    if(!tables.some(table=>table.tablename==='_prisma_migrations')||tables.some(table=>!allowed.has(table.tablename)))fail('BACKUP_SCHEMA');
    const applied=await tx.$queryRawUnsafe('SELECT EXISTS(SELECT 1 FROM public."_prisma_migrations" WHERE migration_name=$1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL) AS applied',MIGRATION);
    if(applied[0]?.applied===true)return null;
    const snapshot={version:1,provider:'postgresql',createdAt:new Date().toISOString(),tables:{},counts:{}};
    let bytes=0;
    for(const {tablename:name} of tables){
      if(!/^(?:[A-Z][A-Za-z0-9]*|_prisma_migrations)$/.test(name))fail('BACKUP_SCHEMA');
      const totals=await tx.$queryRawUnsafe('SELECT count(*)::text AS count,coalesce(sum(octet_length(row_to_json(t)::text)),0)::text AS bytes FROM public."'+name+'" t');
      const count=Number(totals[0].count),size=Number(totals[0].bytes);
      if(!Number.isSafeInteger(count)||!Number.isSafeInteger(size)||size>MAX_BYTES-bytes)fail('BACKUP_LIMIT');
      const rows=await tx.$queryRawUnsafe('SELECT row_to_json(t)::text AS row FROM public."'+name+'" t');
      if(rows.length!==count)fail('BACKUP_INTEGRITY');
      snapshot.tables[name]=rows.map(value=>value.row);snapshot.counts[name]=count;bytes+=size;
    }
    validateSnapshot(snapshot);return snapshot;
  },{isolationLevel:'RepeatableRead',maxWait:10000,timeout:120000});
}

async function boundedBody(response,limit){
  if(!response.body||Number(response.headers.get('content-length'))>limit)fail('BACKUP_LIMIT');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)fail('BACKUP_LIMIT');chunks.push(Buffer.from(value));}
    return Buffer.concat(chunks,size);
  }finally{await reader.cancel();reader.releaseLock();}
}

async function storeSnapshot(snapshot,config,{fetch:send=globalThis.fetch}={}){
  try{
    const encrypted=encryptSnapshot(snapshot,config.cipherKey);
    const object='019-'+new Date().toISOString().replace(/[-:.]/g,'')+'-'+randomUUID()+'.bin';
    const request=(pathname,options={})=>send(config.origin+'/storage/v1'+pathname,{...options,headers:{apikey:config.key,...options.headers},credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)});
    const bucketPath='/bucket/'+config.bucket;
    let bucket=await request(bucketPath);
    if(bucket.status===400||bucket.status===404){
      const absence=JSON.parse((await boundedBody(bucket,8192)).toString('utf8'));
      if(String(absence.statusCode)!=='404'||absence.error!=='Bucket not found'||absence.message!=='Bucket not found')fail('BACKUP_STORAGE');
      const created=await request('/bucket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:config.bucket,name:config.bucket,public:false})});
      await created.body?.cancel();if(!created.ok)fail('BACKUP_STORAGE');
      bucket=await request(bucketPath);
    }
    if(!bucket.ok){await bucket.body?.cancel();fail('BACKUP_STORAGE');}
    const metadata=JSON.parse((await boundedBody(bucket,8192)).toString('utf8'));
    if(metadata.id!==config.bucket||metadata.public!==false)fail('BACKUP_PRIVATE_REQUIRED');
    const uploaded=await request('/object/'+config.bucket+'/'+object,{method:'POST',headers:{'Content-Type':'application/octet-stream','x-upsert':'false'},body:encrypted});
    await uploaded.body?.cancel();if(!uploaded.ok)fail('BACKUP_STORAGE');
    const response=await request('/object/authenticated/'+config.bucket+'/'+object);
    if(!response.ok){await response.body?.cancel();fail('BACKUP_STORAGE');}
    const downloaded=await boundedBody(response,MAX_BYTES+MAGIC.length+28);
    if(hash(downloaded)!==hash(encrypted))fail('BACKUP_INTEGRITY');
    const restored=decryptSnapshot(downloaded,config.cipherKey);
    if(JSON.stringify(restored.counts)!==JSON.stringify(snapshot.counts)||JSON.stringify(restored.tables)!==JSON.stringify(snapshot.tables))fail('BACKUP_INTEGRITY');
    return {bucket:config.bucket,object,counts:snapshot.counts};
  }catch(error){if(/^BACKUP_[A-Z_]+$/.test(error?.code||''))throw error;fail('BACKUP_STORAGE');}
}

async function snapshotPostgres({client,env=process.env,fetch:send=globalThis.fetch}={}){
  const config=configuration(env);
  if(!config)return {skipped:true,reason:'not-configured'};
  let owned=false;
  try{
    const url=new URL(env.DATABASE_URL);
    if(!['postgres:','postgresql:'].includes(url.protocol))fail('BACKUP_CONFIG');
    if(!client){const {PrismaClient}=require('../node_modules/.prisma-farmacia-postgresql');client=new PrismaClient({datasources:{db:{url:env.DATABASE_URL}}});owned=true;}
    const snapshot=await readSnapshot(client);
    if(!snapshot)return {skipped:true,reason:'already-applied'};
    return await storeSnapshot(snapshot,config,{fetch:send});
  }catch(error){if(/^BACKUP_[A-Z_]+$/.test(error?.code||''))throw error;fail('BACKUP_DATABASE');}
  finally{if(owned)await client.$disconnect();}
}

if(require.main===module)snapshotPostgres().then(result=>console.info(JSON.stringify(result))).catch(()=>{console.error('No se pudo verificar el respaldo PostgreSQL previo a la migración.');process.exitCode=1;});
module.exports={configuration,readSnapshot,encryptSnapshot,decryptSnapshot,storeSnapshot,snapshotPostgres};
