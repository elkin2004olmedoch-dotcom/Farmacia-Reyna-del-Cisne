const fs=require('node:fs/promises');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
// The order also satisfies every foreign key in the two Prisma schemas.
const MODELS=Object.freeze(['usuario','producto','proveedor','configuracionFiscal','configuracionEmisor','secuenciaFactura','zonaEntrega','zonaEntregaTarifa','pedido','pedidoDetalle','promocion','pedidoEstado','lote','pedidoDetalleLote','movimientoInventario','facturaPedido','entrega','pago','semilla']);
const INITIAL_FISCAL=Object.freeze({id:'iva-general-inicial',tarifaGeneral:15,inicioVigencia:'2024-04-01T05:00:00.000Z',referenciaNormativa:'Ley de Régimen Tributario Interno, art. 65; Decreto Ejecutivo 198; Circular SRI NAC-DGECCGC25-00000006 (vigencia 2026).',actorId:null});
const INITIAL_DEFAULTS=Object.freeze({
  configuracionFiscal:INITIAL_FISCAL,
  zonaEntrega:{id:'puerto-quito',nombre:'Todo Puerto Quito',provincia:'Pichincha',canton:'Puerto Quito',tarifaCentavos:null,ivaCategoria:'general',fundamentoIva:null,activa:true,version:1},
  zonaEntregaTarifa:{id:'puerto-quito-inicial',zonaEntregaId:'puerto-quito',version:1,tarifaCentavos:null,ivaCategoria:'general',fundamentoIva:null,actorId:null}
});
const UPLOAD_PATTERN=/^assets\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/;
const STATIC_IMAGE_PATTERN=/^assets\/images\/[a-z0-9-]+\.(?:jpg|png|webp|svg)$/;
const MAX_BYTES=2*1024*1024;
const TRANSACTION_OPTIONS=Object.freeze({isolationLevel:'Serializable',maxWait:10000,timeout:120000});
class MigrationError extends Error {
  constructor(code,message){super(message);this.name='MigrationError';this.code=code;}
}
const fail=(code,message)=>{throw new MigrationError(code,message);};
function parseArgs(args){
  if(args.some(arg=>!['--apply','--help'].includes(arg)) || new Set(args).size!==args.length || args.length>1)fail('ARGUMENTS','Usa --apply para transferir o --help para consultar el uso. Las conexiones se configuran solamente mediante variables de entorno.');
  return {apply:args.includes('--apply'),help:args.includes('--help')};
}
function sourceFile(url,root=ROOT){
  if(typeof url!=='string' || !url.startsWith('file:'))fail('SOURCE_CONFIG','SOURCE_DATABASE_URL debe apuntar a una base SQLite local existente.');
  let value;
  try{value=decodeURIComponent(url.slice(5).split('?')[0]);}catch{fail('SOURCE_CONFIG','La conexión SQLite local no es válida.');}
  if(!value || value.includes('\0'))fail('SOURCE_CONFIG','La conexión SQLite local no es válida.');
  return path.isAbsolute(value)?path.resolve(value):path.resolve(root,'server/prisma',value);
}
async function configFromEnvironment(env,root=ROOT){
  const file=sourceFile(env.SOURCE_DATABASE_URL || env.DATABASE_URL,root);
  try{
    const stat=await fs.lstat(file);
    if(!stat.isFile() || stat.isSymbolicLink())throw new Error();
    const handle=await fs.open(file,'r');
    try{const header=Buffer.alloc(16);const {bytesRead}=await handle.read(header,0,16,0);if(bytesRead!==16 || header.toString('binary')!=='SQLite format 3\0')throw new Error();}finally{await handle.close();}
  }catch{fail('SOURCE_FILE','No se encontró una base SQLite local válida. No se creará ni modificará el archivo de origen.');}
  let target;
  try{target=new URL(env.TARGET_DATABASE_URL);if(!['postgres:','postgresql:'].includes(target.protocol) || !target.hostname || !target.pathname || target.pathname==='/')throw new Error();}catch{fail('TARGET_CONFIG','Configura TARGET_DATABASE_URL con una conexión PostgreSQL válida.');}
  return {sourceUrl:'file:'+file.replaceAll('\\','/'),targetUrl:env.TARGET_DATABASE_URL};
}
async function readSnapshot(source){
  // All reads share one SQLite snapshot, even if the local application is open.
  return source.$transaction(async tx=>{
    const snapshot={};
    for(const model of MODELS)snapshot[model]=await tx[model].findMany();
    return snapshot;
  },{maxWait:10000,timeout:120000});
}
function assertSnapshotRelations(snapshot){
  const ids={};
  for(const model of MODELS){
    if(!Array.isArray(snapshot[model]))fail('SOURCE_DATA','La base local no contiene todas las entidades esperadas.');
    ids[model]=new Set(snapshot[model].map(row=>row.id));
    if(ids[model].size!==snapshot[model].length || snapshot[model].some(row=>typeof row.id!=='string' || !row.id))fail('SOURCE_DATA','La base local contiene identificadores inválidos.');
  }
  const valid=snapshot.pedido.every(row=>ids.usuario.has(row.userId) && (row.zonaEntregaId==null || ids.zonaEntrega.has(row.zonaEntregaId)))
    && snapshot.zonaEntregaTarifa.every(row=>ids.zonaEntrega.has(row.zonaEntregaId) && (row.actorId==null || ids.usuario.has(row.actorId)))
    && snapshot.entrega.every(row=>ids.pedido.has(row.pedidoId) && (row.repartidorId==null || ids.usuario.has(row.repartidorId)))
    && snapshot.pago.every(row=>ids.pedido.has(row.pedidoId))
    && snapshot.pedidoDetalle.every(row=>ids.pedido.has(row.pedidoId) && ids.producto.has(row.productoId))
    && snapshot.promocion.every(row=>ids.producto.has(row.productoId))
    && snapshot.pedidoEstado.every(row=>ids.pedido.has(row.pedidoId) && ids.usuario.has(row.actorId))
    && snapshot.configuracionFiscal.every(row=>row.actorId==null || ids.usuario.has(row.actorId))
    && snapshot.lote.every(row=>ids.producto.has(row.productoId) && (row.proveedorId==null || ids.proveedor.has(row.proveedorId)))
    && snapshot.pedidoDetalleLote.every(row=>{
      const detail=snapshot.pedidoDetalle.find(detail=>detail.id===row.detalleId),lot=snapshot.lote.find(lot=>lot.id===row.loteId);
      return detail && lot && detail.productoId===lot.productoId;
    })
    && snapshot.movimientoInventario.every(row=>ids.producto.has(row.productoId) && (row.actorId==null || ids.usuario.has(row.actorId)) && (row.pedidoId==null || ids.pedido.has(row.pedidoId)) && (row.loteId==null || snapshot.lote.some(lot=>lot.id===row.loteId && lot.productoId===row.productoId)))
    && snapshot.facturaPedido.every(row=>ids.pedido.has(row.pedidoId) && (row.secuencial==null || snapshot.secuenciaFactura.some(counter=>counter.emisorRuc===row.emisorRuc && counter.ambiente===row.ambiente && counter.establecimiento===row.establecimiento && counter.puntoEmision===row.puntoEmision && counter.ultimo>=row.secuencial)));
  if(!valid)fail('SOURCE_RELATIONS','La base local contiene referencias incompletas. No se transferirán registros.');
}
function collectUploads(snapshot){
  const refs=new Set();
  for(const row of [...snapshot.producto,...snapshot.promocion]){
    const reference=row.imagen;
    if(reference==null && snapshot.promocion.includes(row))continue;
    if(typeof reference!=='string' || !(STATIC_IMAGE_PATTERN.test(reference) || UPLOAD_PATTERN.test(reference)))fail('SOURCE_IMAGES','La base local contiene una referencia de imagen no válida.');
    if(UPLOAD_PATTERN.test(reference))refs.add(reference);
  }
  if(refs.size>5000)fail('SOURCE_IMAGES','La cantidad de imágenes supera el límite de una transferencia.');
  return [...refs].sort();
}
const contained=(root,target)=>{const relative=path.relative(root,target);return relative!=='' && relative!=='..' && !relative.startsWith('..'+path.sep) && !path.isAbsolute(relative);};
async function inspectUploadFiles(references,{frontendRoot=path.join(ROOT,'frontend'),sharp=require('sharp')}={}){
  if(!references.length)return [];
  try{
    const frontend=await fs.realpath(frontendRoot);
    const directory=path.join(frontend,'assets','uploads');
    const directoryStat=await fs.lstat(directory);
    const uploads=await fs.realpath(directory);
    if(!directoryStat.isDirectory() || directoryStat.isSymbolicLink() || !contained(frontend,uploads))throw new Error();
    const images=[];
    for(const reference of references){
      if(!UPLOAD_PATTERN.test(reference))throw new Error();
      const file=path.join(uploads,path.basename(reference));
      const stat=await fs.lstat(file);
      if(!stat.isFile() || stat.isSymbolicLink() || stat.size<12 || stat.size>MAX_BYTES || !contained(uploads,await fs.realpath(file)))throw new Error();
      const buffer=await fs.readFile(file);
      if(buffer.length<12 || buffer.length>MAX_BYTES || buffer.toString('ascii',0,4)!=='RIFF' || buffer.toString('ascii',8,12)!=='WEBP')throw new Error();
      const decoder=sharp(buffer,{limitInputPixels:16000000,failOn:'warning'});
      const metadata=await decoder.metadata();
      if(metadata.format!=='webp' || (metadata.pages || 1)!==1 || !metadata.width || !metadata.height || metadata.width>8192 || metadata.height>8192 || metadata.width*metadata.height>16000000 || metadata.exif || metadata.icc || metadata.xmp || metadata.iptc)throw new Error();
      // Metadata alone can accept a truncated file; force complete decoding.
      await decoder.raw().toBuffer();
      images.push({reference,buffer});
    }
    return images;
  }catch{fail('SOURCE_IMAGES','No se pudieron validar las imágenes locales. Deben ser WebP sin metadatos privados, de hasta 2 MB, dentro de frontend/assets/uploads.');}
}
async function targetCounts(tx){
  const counts={};
  for(const model of MODELS)counts[model]=await tx[model].count();
  return counts;
}
function sameTimestamp(first,second){
  return first!=null && second!=null && Number.isFinite(new Date(first).getTime()) && new Date(first).getTime()===new Date(second).getTime();
}
async function assertEmpty(tx,counts){
  const reject=()=>fail('TARGET_NOT_EMPTY','La base PostgreSQL debe estar vacía, incluida Semilla. Sólo se admiten los defaults técnicos intactos de IVA y Puerto Quito creados por migración; ningún dato propio se sobrescribe.');
  if(MODELS.some(model=>counts[model]!==0 && (!INITIAL_DEFAULTS[model] || counts[model]!==1)) || counts.zonaEntrega!==counts.zonaEntregaTarifa)reject();
  const defaults={};
  for(const [model,expected] of Object.entries(INITIAL_DEFAULTS)){
    if(!counts[model])continue;
    const rows=await tx[model].findMany(),row=rows[0];
    if(rows.length!==1 || !Object.keys(expected).every(key=>key==='inicioVigencia'?sameTimestamp(row[key],expected[key]):row[key]===expected[key]))reject();
    if(model!=='zonaEntregaTarifa' && !sameTimestamp(row.createdAt,row.updatedAt))reject();
    defaults[model]=row;
  }
  // Both delivery defaults are inserted by migration 007 in one PG transaction.
  if(defaults.zonaEntrega && !sameTimestamp(defaults.zonaEntrega.createdAt,defaults.zonaEntregaTarifa.createdAt))reject();
}
async function migrate({source,target,apply=false,frontendRoot,storage,inspectImages=inspectUploadFiles}){
  const snapshot=await readSnapshot(source);
  assertSnapshotRelations(snapshot);
  const references=collectUploads(snapshot);
  const origin=Object.fromEntries(MODELS.map(model=>[model,snapshot[model].length]));
  const destination=await target.$transaction(async tx=>{const counts=await targetCounts(tx);await assertEmpty(tx,counts);return counts;},TRANSACTION_OPTIONS);
  const summary={modo:apply?'aplicar':'simulacion',origen:origin,destino:destination,imagenes:references.length,firmasCifradas:snapshot.configuracionEmisor.filter(row=>row.certificadoCifrado).length};
  if(!apply)return summary;
  const images=await inspectImages(references,{frontendRoot});
  if(images.length && (!storage?.isCloudStorage?.() || typeof storage.cloudImageExists!=='function' || typeof storage.uploadCloudImage!=='function'))fail('CLOUD_IMAGES','Configura el almacenamiento Supabase antes de transferir imágenes. No se ha guardado ningún registro.');
  try{
    // Check every immutable UUID before the first upload. Never overwrite.
    for(const image of images)if(await storage.cloudImageExists(image.reference))fail('IMAGE_COLLISION','Ya existe una imagen con el mismo identificador en el destino. No se sobrescribirá.');
  }catch(error){if(error instanceof MigrationError)throw error;fail('CLOUD_IMAGES','No se pudo comprobar el almacenamiento de imágenes. No se ha guardado ningún registro.');}
  try{for(const image of images)await storage.uploadCloudImage(image.reference,image.buffer);}catch{fail('IMAGE_TRANSFER','La transferencia de imágenes falló. No se ha guardado ningún registro; pueden quedar imágenes sin referencia en el destino.');}
  let importedCounts;
  try{
    importedCounts=await target.$transaction(async tx=>{
      // Recheck inside the write transaction to reject concurrent seeds/imports.
      const counts=await targetCounts(tx);await assertEmpty(tx,counts);
      if(counts.configuracionFiscal===1 && snapshot.configuracionFiscal.length)await tx.configuracionFiscal.deleteMany({where:{id:INITIAL_FISCAL.id}});
      if(counts.zonaEntrega===1 && snapshot.zonaEntrega.length){
        await tx.zonaEntregaTarifa.deleteMany({where:{id:INITIAL_DEFAULTS.zonaEntregaTarifa.id}});
        await tx.zonaEntrega.deleteMany({where:{id:INITIAL_DEFAULTS.zonaEntrega.id}});
      }
      for(const model of MODELS){
        const rows=snapshot[model];
        for(let offset=0;offset<rows.length;offset+=500)await tx[model].createMany({data:rows.slice(offset,offset+500)});
      }
      return targetCounts(tx);
    },TRANSACTION_OPTIONS);
  }catch(error){
    if(error instanceof MigrationError && !images.length)throw error;
    fail('DATABASE_TRANSFER','La transferencia de registros se revirtió completamente. Pueden quedar imágenes sin referencia; no se publicaron datos de usuarios ni pedidos.');
  }
  return {...summary,destino:importedCounts};
}
function safeError(error){return error instanceof MigrationError?error.message:'No se pudo completar la transferencia. Revisa las conexiones y las migraciones sin compartir contraseñas ni datos privados.';}
async function runCli({argv=process.argv.slice(2),env=process.env,root=ROOT,log=console.log,createClients,storage}={}){
  const options=parseArgs(argv);
  if(options.help){log('Simulación: node scripts/migrate-cloud.cjs\nTransferencia: node scripts/migrate-cloud.cjs --apply\nConfigura SOURCE_DATABASE_URL (o DATABASE_URL local), TARGET_DATABASE_URL y las variables de almacenamiento en .env. Ejecuta las migraciones PostgreSQL con SKIP_INITIAL_SEED=true antes de importar.');return;}
  require('dotenv').config({path:path.join(root,'.env'),quiet:true,processEnv:env});
  const config=await configFromEnvironment(env,root);
  const clients=createClients?await createClients(config):(()=>{
    const {PrismaClient:SQLiteClient}=require('@prisma/client');
    const {PrismaClient:PostgresClient}=require(path.join(root,'node_modules/.prisma-farmacia-postgresql'));
    return {source:new SQLiteClient({datasources:{db:{url:config.sourceUrl}},log:[],errorFormat:'minimal'}),target:new PostgresClient({datasources:{db:{url:config.targetUrl}},log:[],errorFormat:'minimal'})};
  })();
  try{
    const result=await migrate({...clients,apply:options.apply,frontendRoot:path.join(root,'frontend'),storage:storage || (options.apply?require('../server/models/cloudimages.cjs'):undefined)});
    // Counts are the only data permitted in terminal output.
    log(JSON.stringify(result,null,2));
    return result;
  }finally{await Promise.allSettled([clients.source.$disconnect(),clients.target.$disconnect()]);}
}
if(require.main===module)runCli().catch(error=>{console.error(safeError(error));process.exitCode=1;});
module.exports={MODELS,INITIAL_FISCAL,MigrationError,parseArgs,sourceFile,configFromEnvironment,readSnapshot,assertSnapshotRelations,collectUploads,inspectUploadFiles,targetCounts,migrate,safeError,runCli};
