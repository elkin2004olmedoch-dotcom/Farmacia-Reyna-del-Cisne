const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {db}=require('./fixture.cjs');
const {syncCatalog}=require('../../scripts/sync-catalog.cjs');

const item=id=>({id,nombre:'Referencia de consulta '+id,precio:0,stock:0,categoria:'cuidado',descripcion:'Referencia de catálogo para comprobar la sincronización.',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase del producto',laboratorio:'Empresa del producto',presentacion:'Envase individual',tipoProducto:'cuidado',soloConsulta:true});
const reclassify={id:'solar',nombre:'Protector solar Eucerin Photoaging Control FPS 50, 50 ml',categoriaAnterior:'cuidado',categoria:'proteccion-solar'};

test('la sincronización incorpora consultas y reclasifica conservando precio, stock y ediciones posteriores',async()=>{
  const previousVersion=new Date(Date.now()+10000);
  await db.producto.update({where:{id:'solar'},data:{precio:13.33,stock:7,updatedAt:previousVersion}});
  const catalog={version:'catalogo-secciones-v101',productos:[item('catalogo-sync-a'),item('catalogo-sync-b')],reclasificaciones:[reclassify]};
  const result=await syncCatalog({db,catalog});
  assert.deepEqual(result,{version:catalog.version,created:2,reclassified:1,skipped:false});
  const stored=await db.producto.findUnique({where:{id:'solar'}});
  assert.equal(stored.categoria,'proteccion-solar');assert.equal(Number(stored.precio),13.33);assert.equal(stored.stock,7);
  assert.ok(stored.updatedAt>previousVersion,'La versión debe avanzar incluso con un reloj anterior al registro.');
  const added=await db.producto.findUnique({where:{id:'catalogo-sync-a'}});
  assert.equal(added.soloConsulta,true);assert.equal(Number(added.precio),0);assert.equal(added.stock,0);
  await db.producto.update({where:{id:'catalogo-sync-a'},data:{nombre:'Referencia editada',soloConsulta:false,precio:5,stock:3}});
  await db.producto.update({where:{id:'solar'},data:{categoria:'cuidado'}});
  const repeat=await syncCatalog({db,catalog});
  assert.deepEqual(repeat,{version:catalog.version,created:0,reclassified:0,skipped:true});
  const edited=await db.producto.findUnique({where:{id:'catalogo-sync-a'}});
  assert.equal(edited.nombre,'Referencia editada');assert.equal(edited.soloConsulta,false);assert.equal(Number(edited.precio),5);assert.equal(edited.stock,3);
  assert.equal((await db.producto.findUnique({where:{id:'solar'}})).categoria,'cuidado');
});

test('un fallo posterior a la reclasificación revierte filas nuevas y marcador',async()=>{
  await db.producto.update({where:{id:'bebe'},data:{codigoInterno:'SYNC-OCUPADO'}});
  const catalog={version:'catalogo-secciones-v102',productos:[item('catalogo-rollback-a'),{...item('catalogo-rollback-b'),codigoInterno:'SYNC-OCUPADO'}],reclasificaciones:[reclassify]};
  await assert.rejects(syncCatalog({db,catalog}));
  assert.equal(await db.producto.count({where:{id:{in:catalog.productos.map(product=>product.id)}}}),0);
  assert.equal(await db.semilla.count({where:{id:catalog.version}}),0);
  assert.equal((await db.producto.findUnique({where:{id:'solar'}})).categoria,'cuidado');
});

test('dos procesos lógicos incorporan una versión una sola vez y respetan registros preexistentes',async()=>{
  await db.producto.create({data:{...item('catalogo-preservado'),nombre:'Ficha previa de la farmacia',precio:8,stock:2,soloConsulta:false}});
  const catalog={version:'catalogo-secciones-v103',productos:[item('catalogo-preservado'),item('catalogo-concurrente')],reclasificaciones:[]};
  const results=await Promise.all([syncCatalog({db,catalog}),syncCatalog({db,catalog})]);
  assert.equal(results.reduce((sum,result)=>sum+result.created,0),1);
  assert.equal(await db.semilla.count({where:{id:catalog.version}}),1);
  const existing=await db.producto.findUnique({where:{id:'catalogo-preservado'}});
  assert.equal(existing.nombre,'Ficha previa de la farmacia');assert.equal(existing.stock,2);assert.equal(Number(existing.precio),8);assert.equal(existing.soloConsulta,false);
});

test('el ingreso exige referencias consultables, fotos locales y categorías conocidas antes de escribir',async()=>{
  for(const patch of [{soloConsulta:false},{precio:10},{stock:2},{categoria:'categoria-inexistente'},{imagen:'https://imagen-no-verificada.invalid/foto.png'}]){
    const catalog={version:'catalogo-secciones-v104',productos:[{...item('catalogo-invalido'),...patch}],reclasificaciones:[]};
    await assert.rejects(syncCatalog({db,catalog}));
  }
  assert.equal(await db.producto.count({where:{id:'catalogo-invalido'}}),0);
  assert.equal(await db.semilla.count({where:{id:'catalogo-secciones-v104'}}),0);
});

test('una base pendiente de importar conserva sus datos y espera el catálogo inicial',async()=>{
  await db.semilla.delete({where:{id:'catalogo-inicial-v1'}});
  const before=await db.producto.count();
  const catalog={version:'catalogo-secciones-v105',productos:[item('catalogo-espera-importacion')],reclasificaciones:[]};
  const result=await syncCatalog({db,catalog});
  assert.equal(result.skipped,true);assert.equal(result.reason,'initial-catalog-missing');
  assert.equal(await db.producto.count(),before);assert.equal(await db.semilla.count({where:{id:catalog.version}}),0);
});

test('el comando informa que espera una importación cuando falta el catálogo inicial',()=>{
  const {execFileSync}=require('node:child_process');
  const path=require('node:path');
  const output=execFileSync(process.execPath,[path.resolve(__dirname,'../../scripts/sync-catalog.cjs')],{env:process.env,stdio:['ignore','pipe','pipe'],windowsHide:true}).toString();
  assert.match(output,/espera la importación/);assert.doesNotMatch(output,/ya está incorporado/);
});

after(()=>db.$disconnect());
