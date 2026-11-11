const fs=require('node:fs');
const path=require('node:path');
const {Prisma}=require('../server/models/prisma-client.cjs');
const {find:findSection}=require('../frontend/models/catalog-sections.js');
const {validImagePath}=require('../server/middleware/imagevalidation.cjs');

function readCatalog(){return JSON.parse(fs.readFileSync(path.join(__dirname,'../data/catalogo-ampliado.json'),'utf8'));}

function validateCatalog(catalog){
  if(!catalog||!/^catalogo-secciones-v\d+$/.test(catalog.version)||!Array.isArray(catalog.productos)||!catalog.productos.length||!Array.isArray(catalog.reclasificaciones))throw new Error('La actualización del catálogo no es válida.');
  const ids=new Set();
  for(const product of catalog.productos){
    if(!/^catalogo-[a-z0-9-]{1,65}$/.test(product.id)||ids.has(product.id)||product.soloConsulta!==true||product.precio!==0||product.stock!==0||!findSection(product.categoria)||!validImagePath(product.imagen))throw new Error('Revisa las referencias de consulta y sus fotografías locales.');
    ids.add(product.id);
  }
  for(const change of catalog.reclasificaciones){
    if(typeof change.id!=='string'||typeof change.nombre!=='string'||!findSection(change.categoriaAnterior)||!findSection(change.categoria))throw new Error('Revisa las clasificaciones del catálogo.');
  }
}

async function syncCatalog({db,catalog=readCatalog()}={}){
  validateCatalog(catalog);
  db=db||require('../server/models/db.cjs');
  for(let attempt=0;attempt<3;attempt++){
    try{
      return await db.$transaction(async tx=>{
        // SKIP_INITIAL_SEED also supports an empty database awaiting a private import.
        if(!await tx.semilla.findUnique({where:{id:'catalogo-inicial-v1'}}))return {version:catalog.version,created:0,reclassified:0,skipped:true,reason:'initial-catalog-missing'};
        if(await tx.semilla.findUnique({where:{id:catalog.version}}))return {version:catalog.version,created:0,reclassified:0,skipped:true};
        const existing=await tx.producto.findMany({where:{id:{in:[...catalog.productos.map(product=>product.id),...catalog.reclasificaciones.map(change=>change.id)]}},select:{id:true,nombre:true,categoria:true,activo:true,updatedAt:true}});
        const byId=new Map(existing.map(product=>[product.id,product]));
        let reclassified=0;
        for(const change of catalog.reclasificaciones){
          const current=byId.get(change.id);
          if(!current||!current.activo||current.nombre!==change.nombre||current.categoria!==change.categoriaAnterior)continue;
          const updatedAt=new Date(Math.max(Date.now(),current.updatedAt.getTime()+1));
          const result=await tx.producto.updateMany({where:{id:change.id,nombre:change.nombre,categoria:change.categoriaAnterior,activo:true,updatedAt:current.updatedAt},data:{categoria:change.categoria,updatedAt}});
          if(result.count!==1)throw Object.assign(new Error('La clasificación cambió durante la actualización.'),{code:'P2034'});
          reclassified+=result.count;
        }
        const additions=catalog.productos.filter(product=>!byId.has(product.id));
        if(additions.length)await tx.producto.createMany({data:additions});
        await tx.semilla.create({data:{id:catalog.version}});
        return {version:catalog.version,created:additions.length,reclassified,skipped:false};
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:10000,timeout:30000});
    }catch(error){
      if(!['P2002','P2034','P2028','P1008'].includes(error.code)||attempt===2)throw error;
    }
  }
}

if(require.main===module){
  const db=require('../server/models/db.cjs');
  syncCatalog({db}).then(result=>{
    if(result.reason==='initial-catalog-missing')console.info('La incorporación del catálogo espera la importación de los datos iniciales.');
    else if(result.skipped)console.info('El catálogo ampliado ya está incorporado.');
    else console.info(`Catálogo actualizado con ${result.created} nuevas referencias para consulta.`);
  }).catch(()=>{console.error('No se pudo incorporar el catálogo ampliado. Revisa los datos y la conexión privada.');process.exitCode=1;}).finally(()=>db.$disconnect());
}

module.exports={syncCatalog};
