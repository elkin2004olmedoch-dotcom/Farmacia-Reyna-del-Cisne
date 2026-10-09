const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {FRONTEND_ROOT,UPLOAD_PATTERN,contained,uploadsDirectory}=require('../middleware/imagevalidation.cjs');
const BACKUP_ROOT=path.resolve(__dirname,'../backups');
const BACKUP_NAME=/^backup-\d{8}T\d{9}Z-[0-9a-f-]{36}$/;
const PRIVATE_NAME=/^\.(?:pending|restore|recovery)-[0-9a-f-]{36}$/;
const digest=buffer=>createHash('sha256').update(buffer).digest('hex');
const corrupted=(message,cause)=>Object.assign(new Error(message),{code:'SQLITE_CORRUPT_SOURCE',cause});
function isCorruption(error){return error.code==='SQLITE_CORRUPT_SOURCE' || ['11','26'].includes(String(error.meta?.code)) || /database disk image is malformed|file is not a database|database corruption/i.test(error.message);}
const clientFor=file=>new PrismaClient({datasources:{db:{url:'file:'+file.replaceAll('\\','/')}}});
async function fileDigest(file){return digest(await fs.readFile(file));}
async function databasePath(client){const rows=await client.$queryRawUnsafe('PRAGMA database_list');const main=rows.find(row=>row.name==='main');if(!main?.file)throw new Error('El respaldo requiere una base SQLite persistida.');return path.resolve(main.file);}
function databaseFile(url=process.env.DATABASE_URL){if(typeof url!=='string' || !url.startsWith('file:'))throw new Error('Configura una base SQLite para respaldar/restaurar.');const value=decodeURIComponent(url.slice(5).split('?')[0]);return path.isAbsolute(value)?path.resolve(value):path.resolve(__dirname,'../prisma',value);}
async function safeRemove(root,directory){
  const absolute=path.resolve(directory);if(!contained(root,absolute) || path.dirname(absolute)!==root || !(BACKUP_NAME.test(path.basename(absolute)) || PRIVATE_NAME.test(path.basename(absolute))))throw new Error('La carpeta no pertenece al área de respaldos.');
  const info=await fs.lstat(absolute).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  if(!info)return;if(info.isSymbolicLink() || !info.isDirectory() || !contained(root,await fs.realpath(absolute)))throw new Error('La carpeta de respaldo no es segura.');
  await fs.rm(absolute,{recursive:true,force:true});
}
async function inspectDatabase(file){
  const handle=await fs.open(file,'r');const signature=Buffer.alloc(16);try{await handle.read(signature,0,16,0);}finally{await handle.close();}
  if(signature.toString('binary')!=='SQLite format 3\0')throw corrupted('El archivo no es una base SQLite válida.');
  const client=clientFor(file);
  try{
    const integrity=await client.$queryRawUnsafe('PRAGMA integrity_check');if(integrity.length!==1 || Object.values(integrity[0])[0]!=='ok')throw corrupted('La base no supera la comprobación de integridad.');
    if((await client.$queryRawUnsafe('PRAGMA foreign_key_check')).length)throw corrupted('La base contiene referencias inválidas.');
    const tables=await client.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table'");
    if(!['Producto','Usuario','Pedido','PedidoDetalle','Promocion'].every(name=>tables.some(table=>table.name===name)))throw new Error('La base no corresponde a la farmacia.');
    const refs=await client.$queryRawUnsafe('SELECT imagen FROM "Producto"');
    const columns=await client.$queryRawUnsafe('PRAGMA table_info("Promocion")');
    if(columns.some(column=>column.name==='imagen'))refs.push(...await client.$queryRawUnsafe('SELECT imagen FROM "Promocion" WHERE imagen IS NOT NULL'));
    const uploads=[...new Set(refs.map(row=>row.imagen).filter(value=>typeof value==='string' && value.startsWith('assets/uploads/')))];
    if(uploads.length>5000 || uploads.some(value=>!UPLOAD_PATTERN.test(value)))throw new Error('La base referencia imágenes subidas no válidas.');
    return {uploads};
  }catch(error){if(isCorruption(error))throw corrupted('La base SQLite está dañada y requiere recuperación.',error);throw error;}finally{await client.$disconnect();}
}
async function preserveCorruptDatabase(targetDatabase,backupRoot){
  await fs.mkdir(backupRoot,{recursive:true,mode:0o700});const root=await fs.realpath(backupRoot);const pending=path.join(root,'.recovery-'+randomUUID());await fs.mkdir(pending,{mode:0o700});
  try{
    const files=[];
    for(const suffix of ['','-wal','-shm']){
      const source=targetDatabase+suffix;const info=await fs.lstat(source).catch(error=>{if(error.code==='ENOENT' && suffix)return null;throw error;});
      if(!info)continue;if(!info.isFile() || info.isSymbolicLink())throw new Error('No se puede conservar el archivo SQLite actual de forma segura.');
      const name='farmacia.db'+suffix;const destination=path.join(pending,name);await fs.copyFile(source,destination,require('node:fs').constants.COPYFILE_EXCL);
      const sha256=await fileDigest(destination);if((await fs.stat(destination)).size!==info.size || sha256!==await fileDigest(source))throw new Error('El archivo actual cambió durante su copia. No se restaura.');
      files.push({ruta:name,bytes:info.size,sha256});
    }
    if(!files.some(file=>file.ruta==='farmacia.db'))throw new Error('No se pudo conservar la base dañada.');
    const now=new Date();const manifest={version:1,motor:'sqlite-unreadable',tipo:'recuperacion-forense',creadoEn:now.toISOString(),restaurable:false,archivos:files};
    await fs.writeFile(path.join(pending,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});const directory=path.join(root,'recovery-'+now.toISOString().replace(/[-:.]/g,'')+'-'+randomUUID());await fs.rename(pending,directory);return {directory,manifest};
  }catch(error){await safeRemove(root,pending);throw error;}
}
async function prune(root,keep=7,protectedDirectories=[]){
  const items=[];for(const entry of await fs.readdir(root,{withFileTypes:true})){if(!entry.isDirectory() || !BACKUP_NAME.test(entry.name))continue;const directory=path.join(root,entry.name);try{const manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));if(manifest.version===1)items.push(directory);}catch(_){}}
  const protectedPaths=new Set(protectedDirectories.map(directory=>path.resolve(directory)));
  items.sort((a,b)=>path.basename(b).localeCompare(path.basename(a)));for(const directory of items.slice(keep))if(!protectedPaths.has(directory))await safeRemove(root,directory);
}
async function createBackup({client,backupRoot=BACKUP_ROOT,frontendRoot=FRONTEND_ROOT,uploadRoot=uploadsDirectory(frontendRoot),keep=7,now=new Date(),protectedDirectories=[]}={}){
  client=client || require('./db.cjs');await fs.mkdir(backupRoot,{recursive:true,mode:0o700});const root=await fs.realpath(backupRoot);
  const pending=path.join(root,'.pending-'+randomUUID());await fs.mkdir(pending,{mode:0o700});
  try{
    const snapshot=path.join(pending,'farmacia.db');
    // SQLite copies a consistent snapshot, including committed WAL changes.
    await client.$executeRawUnsafe('VACUUM INTO ?',snapshot);
    const {uploads}=await inspectDatabase(snapshot);const files=[{ruta:'farmacia.db',sha256:await fileDigest(snapshot),bytes:(await fs.stat(snapshot)).size}];
    for(const relative of uploads){
      const sourceRoot=await fs.realpath(uploadRoot);const source=await fs.realpath(path.join(sourceRoot,path.basename(relative)));
      if(!contained(sourceRoot,source) || !(await fs.stat(source)).isFile())throw new Error('Una imagen del respaldo no es válida.');
      const destination=path.join(pending,'uploads',path.basename(relative));await fs.mkdir(path.dirname(destination),{recursive:true,mode:0o700});await fs.copyFile(source,destination);
      files.push({ruta:'uploads/'+path.basename(relative),referencia:relative,sha256:await fileDigest(destination),bytes:(await fs.stat(destination)).size});
    }
    const manifest={version:1,motor:'sqlite',creadoEn:now.toISOString(),archivos:files};await fs.writeFile(path.join(pending,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});
    const name='backup-'+now.toISOString().replace(/[-:.]/g,'')+'-'+randomUUID();const directory=path.join(root,name);await fs.rename(pending,directory);await prune(root,keep,protectedDirectories);return {directory,manifest};
  }catch(error){await safeRemove(root,pending);throw error;}
}
async function validateBackup(directory){
  const root=await fs.realpath(directory);const manifestPath=path.join(root,'manifest.json');if((await fs.stat(manifestPath)).size>2*1024*1024)throw new Error('El manifiesto es demasiado grande.');
  const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
  if(manifest.version!==1 || manifest.motor!=='sqlite' || !Array.isArray(manifest.archivos) || manifest.archivos.length>5001)throw new Error('El manifiesto de respaldo no es válido.');
  const known=new Set();
  for(const file of manifest.archivos){
    const image=typeof file.referencia==='string' && UPLOAD_PATTERN.test(file.referencia) && file.ruta==='uploads/'+path.basename(file.referencia);
    if((file.ruta!=='farmacia.db' && !image) || known.has(file.ruta) || !/^[0-9a-f]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes<1)throw new Error('El manifiesto contiene una ruta o tamaño no válido.');
    known.add(file.ruta);const source=await fs.realpath(path.join(root,file.ruta));
    if(!contained(root,source) || !(await fs.stat(source)).isFile() || (await fs.stat(source)).size!==file.bytes || await fileDigest(source)!==file.sha256)throw new Error('La verificación SHA-256 del respaldo falló.');
  }
  if(!known.has('farmacia.db'))throw new Error('El respaldo no incluye su base de datos.');
  const {uploads}=await inspectDatabase(path.join(root,'farmacia.db'));
  if(uploads.some(reference=>!manifest.archivos.some(file=>file.referencia===reference)))throw new Error('El respaldo no incluye todas las imágenes referenciadas.');
  return {root,manifest};
}
async function assertOffline(targetDatabase,backupRoot){
  const entries=await fs.readdir(backupRoot).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
  for(const entry of entries){if(!/^\.running-\d+\.json$/.test(entry))continue;const record=JSON.parse(await fs.readFile(path.join(backupRoot,entry),'utf8'));
    if(path.resolve(record.database)!==targetDatabase)continue;
    try{process.kill(record.pid,0);}catch(error){if(error.code==='ESRCH')continue;}
    throw new Error('Detén el servidor antes de restaurar la base de datos.');
  }
}
async function restoreBackup({from,targetDatabase=databaseFile(),backupRoot=BACKUP_ROOT,frontendRoot=FRONTEND_ROOT,uploadRoot=uploadsDirectory(frontendRoot),replace=false,offline=false}={}){
  if(!offline)throw new Error('La restauración requiere --offline y el servidor detenido.');
  targetDatabase=path.resolve(targetDatabase);await assertOffline(targetDatabase,path.resolve(backupRoot));const checked=await validateBackup(from);
  const targetInfo=await fs.lstat(targetDatabase).catch(error=>{if(error.code==='ENOENT')return null;throw error;});if(targetInfo && (!targetInfo.isFile() || targetInfo.isSymbolicLink()))throw new Error('La base destino debe ser un archivo regular.');const exists=!!targetInfo;
  if(exists && !replace)throw new Error('La base ya existe. Usa --replace para respaldarla y restaurar.');
  let before=null,previousBackupType=null;
  if(exists){
    try{
      await inspectDatabase(targetDatabase);const client=clientFor(targetDatabase);try{before=await createBackup({client,backupRoot,frontendRoot,uploadRoot,protectedDirectories:[checked.root]});previousBackupType='sqlite-consistente';}finally{await client.$disconnect();}
    }catch(error){if(!isCorruption(error))throw error;before=await preserveCorruptDatabase(targetDatabase,backupRoot);previousBackupType='forense';}
  }
  await fs.mkdir(path.dirname(targetDatabase),{recursive:true});await fs.mkdir(uploadRoot,{recursive:true});
  const destinationRoot=await fs.realpath(uploadRoot);const staged=targetDatabase+'.restore-'+randomUUID();await fs.copyFile(path.join(checked.root,'farmacia.db'),staged);
  const previous=[];
  try{
    // Uploaded paths are immutable UUIDs; publish their verified bytes before the DB.
    for(const file of checked.manifest.archivos.filter(item=>item.referencia)){
      const destination=path.join(destinationRoot,path.basename(file.referencia));
      const current=await fs.lstat(destination).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
      if(current?.isSymbolicLink() || current && !current.isFile())throw new Error('Una ruta de imagen no es segura.');
      if(current && await fileDigest(destination)!==file.sha256)throw new Error('Una imagen existente difiere del respaldo. No se sobrescribe su UUID.');
      if(!current)await fs.copyFile(path.join(checked.root,file.ruta),destination,require('node:fs').constants.COPYFILE_EXCL);
    }
    for(const suffix of ['','-wal','-shm']){const original=targetDatabase+suffix;try{await fs.access(original);}catch(error){if(error.code==='ENOENT')continue;throw error;}const moved=original+'.previous-'+randomUUID();await fs.rename(original,moved);previous.push({original,moved});}
    await fs.rename(staged,targetDatabase);for(const file of previous)await fs.unlink(file.moved).catch(()=>{});
    if(before)await prune(await fs.realpath(backupRoot)).catch(()=>{});
    return {database:targetDatabase,previousBackup:before?.directory || null,previousBackupType,restoredFrom:checked.root};
  }catch(error){await fs.unlink(staged).catch(()=>{});for(const file of previous.reverse())await fs.rename(file.moved,file.original);throw error;}
}
async function startAutomaticBackups(options={}){
  if(process.env.NODE_ENV==='test')return {stop:async()=>{},run:()=>createBackup(options)};
  const client=options.client || require('./db.cjs');const root=path.resolve(options.backupRoot || BACKUP_ROOT);await fs.mkdir(root,{recursive:true,mode:0o700});
  const lock=path.join(root,`.running-${process.pid}.json`);await fs.writeFile(lock,JSON.stringify({pid:process.pid,database:await databasePath(client)}),{mode:0o600});
  let inFlight=null;const run=()=>{if(inFlight)return inFlight;inFlight=createBackup({...options,client}).then(result=>{console.info('Respaldo automático completado.');return result;}).catch(error=>{console.error('No se pudo completar el respaldo automático. Revisa el espacio y los permisos del servidor.');return null;}).finally(()=>{inFlight=null;});return inFlight;};
  void run();const timer=setInterval(()=>void run(),86400000);timer.unref();
  return {run,stop:async()=>{clearInterval(timer);await inFlight;await fs.unlink(lock).catch(error=>{if(error.code!=='ENOENT')throw error;});}};
}
module.exports={createBackup,validateBackup,restoreBackup,startAutomaticBackups,databaseFile,inspectDatabase,BACKUP_ROOT,prune};
