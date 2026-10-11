const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const sharp=require('sharp');
const {Prisma}=require('@prisma/client');
const {MODELS,INITIAL_FISCAL,MigrationError,parseArgs,configFromEnvironment,collectUploads,inspectUploadFiles,migrate,safeError,runCli}=require('../../scripts/migrate-cloud.cjs');
const reference='assets/uploads/12345678-1234-4123-8123-123456789abc.webp';
const anotherReference='assets/uploads/12345678-1234-4123-8123-123456789abd.webp';
const privateHash='$2b$12$contraseña-hash-privado-no-publicable';
const privateEmail='cliente-privado@example.ec';
function fixture(uploaded=false){
  const createdAt=new Date('2024-01-02T03:04:05.123Z');
  const updatedAt=new Date('2024-02-03T04:05:06.789Z');
  return {
    usuario:[{id:'cliente-original',nombre:'Cliente privado',email:privateEmail,telefono:'0979275988',passwordHash:privateHash,role:'user',tokenVersion:7,activo:false,createdAt}],
    producto:[{id:'producto-original',nombre:'Alcohol',precio:new Prisma.Decimal('12.34567'),stock:9,categoria:'Salud',descripcion:'Descripción',imagen:uploaded?reference:'assets/images/producto-alcohol-antiseptico.svg',alt:'Alcohol',activo:true,createdAt,updatedAt}],
    pedido:[{id:'pedido-original',userId:'cliente-original',total:new Prisma.Decimal('24.69134'),estado:'entregado',entrega:'delivery',nombre:'Nombre privado',email:privateEmail,telefono:'0979275988',documento:'••••••0400',provincia:'Pichincha',ciudad:'Quito',direccion:'Domicilio privado',codigoPostal:'170101',requestKey:'solicitud-original',fingerprint:'huella-privada',createdAt,updatedAt}],
    pedidoDetalle:[{id:'detalle-original',pedidoId:'pedido-original',productoId:'producto-original',nombreProducto:'Alcohol anterior',cantidad:2,precioUnitario:new Prisma.Decimal('12.34567'),precioOriginal:new Prisma.Decimal('15.12345'),descuentoPorcentaje:18}],
    promocion:[{id:'promocion-original',titulo:'Promoción',descripcion:'Descripción',etiqueta:'Promo',productoId:'producto-original',activa:true,vistaPrevia:false,descuentoPorcentaje:18,imagen:uploaded?reference:null,alt:null,orden:4,inicio:createdAt,fin:updatedAt,createdAt}],
    pedidoEstado:[{id:'historial-original',pedidoId:'pedido-original',anterior:'pendiente',estado:'entregado',actorId:'cliente-original',createdAt}],
    semilla:[{id:'catalogo-inicial-v1',createdAt}],
    configuracionFiscal:[{...INITIAL_FISCAL,inicioVigencia:new Date(INITIAL_FISCAL.inicioVigencia),createdAt,updatedAt}],
    proveedor:[{id:'proveedor-original',nombre:'Proveedor privado',ruc:'0102030400001',email:privateEmail,telefono:'+593979275988',direccion:'Domicilio privado',activo:true,createdAt,updatedAt}],
    lote:[{id:'lote-original',productoId:'producto-original',numero:'LOTE-01',vencimiento:'2035-12-31',stock:2,costoUnitario:new Prisma.Decimal('2.15'),proveedorId:'proveedor-original',createdAt,updatedAt}],
    pedidoDetalleLote:[{id:'asignacion-original',detalleId:'detalle-original',loteId:'lote-original',cantidad:1}],
    movimientoInventario:[{id:'movimiento-original',productoId:'producto-original',loteId:'lote-original',actorId:'cliente-original',pedidoId:'pedido-original',tipo:'venta',cantidad:1,motivo:'Reserva original del pedido',createdAt}],
    configuracionEmisor:[{id:'principal',ruc:'0102030400001',razonSocial:'Farmacia privada',nombreComercial:'Farmacia',direccionMatriz:'Domicilio privado',direccionEstablecimiento:'Domicilio privado',establecimiento:'001',puntoEmision:'001',ambiente:'1',obligadoContabilidad:false,softwarePropio:true,rucProveedorSoftware:null,certificadoCifrado:'v1.material-cifrado-sintetico-no-publicable',certificadoVenceEn:new Date('2035-12-31T05:00:00Z'),certificadoRuc:'0102030400001',createdAt,updatedAt}],
    secuenciaFactura:[{id:'contador-original',emisorRuc:'0102030400001',ambiente:'1',establecimiento:'001',puntoEmision:'001',ultimo:7}],
    facturaPedido:[{id:'factura-original',pedidoId:'pedido-original',estado:'AUTORIZADA',ambiente:'1',emisorRuc:'0102030400001',establecimiento:'001',puntoEmision:'001',secuencial:7,claveAcceso:'1'.repeat(49),fechaEmision:createdAt,snapshot:JSON.stringify({pedidoId:'pedido-original',comprador:{identificacionComprador:'0102030400'}}),xmlBorrador:'<factura/>',xmlFirmado:'<factura-firmada/>',xmlAutorizado:'<factura-firmada/>',numeroAutorizacion:'1'.repeat(49),fechaAutorizacion:createdAt,mensajes:'[]',ultimoError:null,procesandoHasta:null,intentos:1,createdAt,updatedAt}]
  };
}
function sourceClient(snapshot){
  let transactions=0;const reads=[];
  const tx=Object.fromEntries(MODELS.map(model=>[model,{findMany:async()=>{reads.push(model);return snapshot[model];}}]));
  return {$transaction:async fn=>{transactions++;return fn(tx);},$disconnect:async()=>{},get transactions(){return transactions;},reads};
}
function targetClient({initial={},failOn,beforeTransaction}={}){
  let state=Object.fromEntries(MODELS.map(model=>[model,[...(initial[model] || [])]]));
  let transactions=0;const writes=[];const options=[];
  const target={
    async $transaction(fn,settings){
      transactions++;options.push(settings);beforeTransaction?.(transactions,state);
      const working=Object.fromEntries(MODELS.map(model=>[model,[...state[model]]]));
      const tx=Object.fromEntries(MODELS.map(model=>[model,{
        count:async()=>working[model].length,
        findMany:async()=>[...working[model]],
        deleteMany:async({where})=>{const before=working[model].length;working[model]=working[model].filter(row=>row.id!==where.id);return {count:before-working[model].length};},
        createMany:async({data})=>{
          writes.push(model);if(model===failOn)throw new Error('PG falló con '+privateEmail+' '+privateHash);
          working[model].push(...data);return {count:data.length};
        }
      }]));
      const result=await fn(tx);state=working;return result;
    },
    $disconnect:async()=>{},
    get state(){return state;},get transactions(){return transactions;},writes,options
  };
  return target;
}
const emptyCounts=()=>Object.fromEntries(MODELS.map(model=>[model,0]));
test('el importador cubre todos los modelos Prisma y no omite futuras entidades de farmacia',async()=>{
 const schema=await fs.readFile(path.resolve(__dirname,'../../server/prisma/schema.prisma'),'utf8');
 const names=[...schema.matchAll(/^model (\w+) \{/gm)].map(match=>match[1][0].toLowerCase()+match[1].slice(1));
 assert.deepEqual([...MODELS].sort(),names.sort());assert.equal(MODELS.length,15);
});
test('se sustituye sólo la semilla fiscal estándar en la misma transacción preservando historial del origen',async()=>{
 const snapshot=fixture(),defaultRow={...snapshot.configuracionFiscal[0]},source=sourceClient(snapshot),target=targetClient({initial:{configuracionFiscal:[defaultRow]}});
 snapshot.configuracionFiscal.push({...defaultRow,id:'tarifa-programada',tarifaGeneral:14,inicioVigencia:new Date('2027-01-01T05:00:00Z'),referenciaNormativa:'Norma sintética adicional para verificar traslado',actorId:'cliente-original'});
 const result=await migrate({source,target,apply:true});assert.equal(result.destino.configuracionFiscal,2);assert.deepEqual(target.state.configuracionFiscal,snapshot.configuracionFiscal);
 const printed=JSON.stringify(result);assert.ok(!printed.includes('material-cifrado'));assert.ok(!printed.includes('0102030400'));
});
test('una semilla fiscal modificada o una segunda fila en destino bloquean importación sin sobrescribir',async()=>{
 for(const rows of [[{...fixture().configuracionFiscal[0],tarifaGeneral:14}],[{...fixture().configuracionFiscal[0],actorId:'usuario-del-destino'}],[fixture().configuracionFiscal[0],{...fixture().configuracionFiscal[0],id:'dato-negocio'}]]) {
  const target=targetClient({initial:{configuracionFiscal:rows}});await assert.rejects(migrate({source:sourceClient(fixture()),target,apply:true}),error=>error.code==='TARGET_NOT_EMPTY');assert.deepEqual(target.state.configuracionFiscal,rows);assert.deepEqual(target.writes,[]);
 }
});
test('fallo tardío conserva la semilla fiscal permitida y no deja negocio importado parcialmente',async()=>{
 const initial=fixture().configuracionFiscal[0],target=targetClient({initial:{configuracionFiscal:[initial]},failOn:'facturaPedido'});
 await assert.rejects(migrate({source:sourceClient(fixture()),target,apply:true}),error=>error.code==='DATABASE_TRANSFER');
 assert.deepEqual(target.state.configuracionFiscal,[initial]);for(const model of MODELS.filter(model=>model!=='configuracionFiscal'))assert.deepEqual(target.state[model],[]);
});
test('proveedor, lotes, asignaciones, movimientos y numeración fiscal incompletos impiden transferir',async()=>{
 const changes=[s=>{s.lote[0].proveedorId='ausente';},s=>{s.pedidoDetalleLote[0].detalleId='ausente';},s=>{s.movimientoInventario[0].actorId='ausente';},s=>{s.facturaPedido[0].pedidoId='ausente';},s=>{s.secuenciaFactura[0].ultimo=6;},s=>{s.configuracionFiscal[0].actorId='ausente';}];
 for(const change of changes){const source=fixture(),target=targetClient();change(source);await assert.rejects(migrate({source:sourceClient(source),target,apply:true}),error=>error.code==='SOURCE_RELATIONS');assert.equal(target.transactions,0);}
});
test('la simulación consulta un snapshot único y muestra solo cantidades sin escribir ni subir imágenes',async()=>{
  const snapshot=fixture(true),source=sourceClient(snapshot),target=targetClient();let inspected=0;let cloudCalls=0;
  const result=await migrate({source,target,inspectImages:async()=>{inspected++;throw new Error();},storage:{uploadCloudImage:async()=>{cloudCalls++;}}});
  assert.equal(result.modo,'simulacion');assert.equal(result.imagenes,1);assert.equal(source.transactions,1);assert.deepEqual(source.reads,MODELS);
  assert.equal(target.transactions,1);assert.deepEqual(target.writes,[]);assert.deepEqual(result.destino,emptyCounts());assert.equal(inspected,0);assert.equal(cloudCalls,0);
  const printed=JSON.stringify(result);for(const privateValue of [privateHash,privateEmail,'cliente-original','Domicilio privado','huella-privada'])assert.ok(!printed.includes(privateValue));
});
test('la transferencia conserva IDs, hashes, roles, fechas, decimales, inventario y facturación de las quince entidades',async()=>{
  const snapshot=fixture(),source=sourceClient(snapshot),target=targetClient();
  const result=await migrate({source,target,apply:true});
  assert.equal(result.modo,'aplicar');assert.deepEqual(target.writes,MODELS);assert.equal(target.transactions,2);
  for(const model of MODELS)assert.deepEqual(target.state[model],snapshot[model]);
  assert.equal(target.state.usuario[0].passwordHash,privateHash);assert.equal(target.state.usuario[0].tokenVersion,7);
  assert.strictEqual(target.state.producto[0].precio,snapshot.producto[0].precio);assert.equal(target.state.producto[0].precio.toString(),'12.34567');
  assert.strictEqual(target.state.pedido[0].createdAt,snapshot.pedido[0].createdAt);assert.equal(target.state.pedido[0].updatedAt.toISOString(),'2024-02-03T04:05:06.789Z');
  assert.ok(target.options.every(options=>options.isolationLevel==='Serializable'));
  assert.equal(target.state.configuracionEmisor[0].certificadoCifrado,snapshot.configuracionEmisor[0].certificadoCifrado);
  assert.equal(target.state.facturaPedido[0].snapshot,snapshot.facturaPedido[0].snapshot);
});
test('una sola fila existente en cualquier entidad, incluida Semilla, bloquea la importación sin borrados',async()=>{
  for(const model of MODELS){
    const existing={id:'registro-existente'};const target=targetClient({initial:{[model]:[existing]}});let uploads=0;
    await assert.rejects(migrate({source:sourceClient(fixture(true)),target,apply:true,storage:{isCloudStorage:()=>true,uploadCloudImage:async()=>{uploads++;}}}),error=>error instanceof MigrationError && error.code==='TARGET_NOT_EMPTY');
    assert.equal(target.state[model][0],existing);assert.deepEqual(target.writes,[]);assert.equal(uploads,0);
  }
});
test('un fallo tardío revierte todas las entidades en lugar de conservar una copia parcial',async()=>{
  for(const model of ['pedidoDetalle','semilla']){
    const target=targetClient({failOn:model});
    await assert.rejects(migrate({source:sourceClient(fixture()),target,apply:true}),error=>error.code==='DATABASE_TRANSFER' && !safeError(error).includes(privateHash) && !safeError(error).includes(privateEmail));
    for(const key of MODELS)assert.deepEqual(target.state[key],[]);
  }
});
test('se rechazan referencias incompletas y rutas de imágenes fuera del directorio canónico',async()=>{
  const broken=fixture();broken.pedido[0].userId='ausente';const target=targetClient();
  await assert.rejects(migrate({source:sourceClient(broken),target,apply:true}),error=>error.code==='SOURCE_RELATIONS');assert.equal(target.transactions,0);
  for(const bad of ['assets/uploads/../../server/prisma/farmacia.db','assets/uploads/imagen.webp','https://example.ec/imagen.webp','assets/uploads/12345678-1234-1123-8123-123456789abc.webp']){
    const snapshot=fixture();snapshot.producto[0].imagen=bad;assert.throws(()=>collectUploads(snapshot),error=>error.code==='SOURCE_IMAGES');
  }
});
test('se comprueba cada UUID antes de subir y se rechazan colisiones sin sobrescribir',async()=>{
  const snapshot=fixture(true);snapshot.promocion[0].imagen=anotherReference;
  const calls=[];const target=targetClient();
  const storage={isCloudStorage:()=>true,cloudImageExists:async ref=>{calls.push(['exists',ref]);return ref===anotherReference;},uploadCloudImage:async ref=>{calls.push(['upload',ref]);}};
  await assert.rejects(migrate({source:sourceClient(snapshot),target,apply:true,storage,inspectImages:async refs=>refs.map(reference=>({reference,buffer:Buffer.from('WebP verificado')}))}),error=>error.code==='IMAGE_COLLISION');
  assert.deepEqual(calls,[['exists',reference],['exists',anotherReference]]);assert.deepEqual(target.writes,[]);
});
test('imágenes deduplicadas conservan referencia y bytes antes de insertar la base',async()=>{
  const bytes=Buffer.from('bytes-originales');const target=targetClient();const calls=[];
  const storage={isCloudStorage:()=>true,cloudImageExists:async ref=>{calls.push('exists');return false;},uploadCloudImage:async(ref,buffer)=>{assert.equal(ref,reference);assert.strictEqual(buffer,bytes);assert.deepEqual(target.writes,[]);calls.push('upload');}};
  await migrate({source:sourceClient(fixture(true)),target,apply:true,storage,inspectImages:async refs=>{assert.deepEqual(refs,[reference]);return [{reference,buffer:bytes}];}});
  assert.deepEqual(calls,['exists','upload']);assert.equal(target.state.producto[0].imagen,reference);assert.equal(target.state.promocion[0].imagen,reference);
});
test('un fallo de almacenamiento deja PostgreSQL vacío y oculta detalles privados del proveedor',async()=>{
  const snapshot=fixture(true);snapshot.promocion[0].imagen=anotherReference;const target=targetClient();let uploaded=0;
  const storage={isCloudStorage:()=>true,cloudImageExists:async()=>false,uploadCloudImage:async()=>{if(++uploaded===2)throw new Error('Token secreto '+privateEmail);}};
  await assert.rejects(migrate({source:sourceClient(snapshot),target,apply:true,storage,inspectImages:async refs=>refs.map(reference=>({reference,buffer:Buffer.alloc(1)}))}),error=>error.code==='IMAGE_TRANSFER' && !safeError(error).includes(privateEmail));
  assert.equal(uploaded,2);assert.deepEqual(target.writes,[]);for(const model of MODELS)assert.deepEqual(target.state[model],[]);
});
test('se vuelve a comprobar el destino dentro de la transacción para proteger un seed concurrente',async()=>{
  const target=targetClient({beforeTransaction:(number,state)=>{if(number===2)state.semilla.push({id:'seed-concurrente'});}});
  await assert.rejects(migrate({source:sourceClient(fixture()),target,apply:true}),error=>error.code==='TARGET_NOT_EMPTY');
  assert.deepEqual(target.writes,[]);assert.deepEqual(target.state.semilla,[{id:'seed-concurrente'}]);
});
test('se validan los bytes WebP locales sin modificar archivos y se rechazan metadatos privados',async t=>{
  const frontendRoot=await fs.mkdtemp(path.join(os.tmpdir(),'farmacia-migration-images-'));t.after(()=>fs.rm(frontendRoot,{recursive:true,force:true}));
  const directory=path.join(frontendRoot,'assets/uploads');await fs.mkdir(directory,{recursive:true});const file=path.join(directory,path.basename(reference));
  const bytes=await sharp({create:{width:4,height:3,channels:3,background:'#eedfcc'}}).webp().toBuffer();await fs.writeFile(file,bytes);
  const images=await inspectUploadFiles([reference],{frontendRoot});assert.equal(images[0].reference,reference);assert.deepEqual(images[0].buffer,bytes);assert.deepEqual(await fs.readFile(file),bytes);
  await fs.writeFile(file,await sharp(bytes).withExif({IFD0:{Copyright:privateEmail}}).webp().toBuffer());
  await assert.rejects(inspectUploadFiles([reference],{frontendRoot}),error=>error.code==='SOURCE_IMAGES' && !error.message.includes(privateEmail));
  await fs.writeFile(file,Buffer.from('RIFFxxxxWEBPincorrecto'));await assert.rejects(inspectUploadFiles([reference],{frontendRoot}),error=>error.code==='SOURCE_IMAGES');
});
test('el CLI exige conexiones por entorno y una base SQLite existente; nunca acepta secretos como argumentos',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'farmacia-migration-cli-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const file=path.join(root,'source.db');const url='file:'+file.replaceAll('\\','/');const env={SOURCE_DATABASE_URL:url,TARGET_DATABASE_URL:'postgresql://usuario:secreto@localhost:5432/farmacia'};
  await assert.rejects(configFromEnvironment(env,root),error=>error.code==='SOURCE_FILE');
  await fs.writeFile(file,Buffer.from('SQLite format 3\0'));await assert.rejects(configFromEnvironment({...env,TARGET_DATABASE_URL:'file:./destino.db'},root),error=>error.code==='TARGET_CONFIG');
  assert.throws(()=>parseArgs(['--target',env.TARGET_DATABASE_URL]),error=>error.code==='ARGUMENTS');assert.deepEqual(parseArgs([]),{apply:false,help:false});
  const source=sourceClient(fixture()),target=targetClient();let disconnected=0;source.$disconnect=async()=>{disconnected++;};target.$disconnect=async()=>{disconnected++;};const logs=[];
  const result=await runCli({root,env,log:message=>logs.push(message),createClients:async config=>{assert.equal(config.sourceUrl,url);assert.equal(config.targetUrl,env.TARGET_DATABASE_URL);return {source,target};},argv:[]});
  assert.equal(result.modo,'simulacion');assert.equal(disconnected,2);assert.equal(logs.length,1);for(const privateValue of ['secreto',privateHash,privateEmail,file])assert.ok(!logs.join('').includes(privateValue));
  assert.ok(!safeError(new Error(env.TARGET_DATABASE_URL+' '+privateHash)).includes('secreto'));
});
