'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-catalog-test-'));
const root=path.resolve(__dirname,'../..');
const target=process.env.PHARMACY_CATALOG_TEST_DATABASE_URL;
if(target){
 const url=new URL(target);
 assert.ok(['postgres:','postgresql:'].includes(url.protocol));
 assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
 assert.match(url.pathname,/^\/farmacia_catalog_test_[a-z0-9]+$/);
 assert.equal(url.username,'farmacia_test');assert.equal(url.password,'');
}
const provider=target?'postgresql':'sqlite';
Object.assign(process.env,{NODE_ENV:'test',DATABASE_URL:target || 'file:'+path.join(directory,'catalog.db').replaceAll('\\','/'),JWT_SECRET:randomBytes(48).toString('hex'),CORS_ORIGIN:'http://localhost:3000',UPLOAD_DIR:path.join(directory,'uploads')});
// Migrate a copied schema so Prisma cannot discover a repository .env.
const source=path.join(root,'server/prisma',target?'postgresql':'');
fs.copyFileSync(path.join(source,'schema.prisma'),path.join(directory,'schema.prisma'));
fs.cpSync(path.join(source,'migrations'),path.join(directory,'migrations'),{recursive:true});
execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy','--schema',path.join(directory,'schema.prisma')],{cwd:directory,env:process.env,stdio:'pipe',windowsHide:true});
require('dotenv').config=()=>({parsed:{}});
const db=require('../../server/models/db.cjs');
const api=require('supertest')(require('../../server/app.cjs')());
const ids=items=>items.map(item=>item.id);
const product=(id,extra={})=>({id,nombre:id,precio:10,stock:10,categoria:'cuidado',descripcion:'Catálogo sintético',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase de prueba',createdAt:new Date('2026-01-01T00:00:00Z'),...extra});
before(async()=>{
 await db.producto.createMany({data:[
  product('acido',{nombre:'ÁCIDO cítrico',laboratorio:'Laboratórios LÓPEZ',principioActivo:'Ascórbico',presentacion:'Cápsulas',codigoInterno:'ACIDO-01',codigoBarras:'12345678',descripcion:'Fórmula para bienestar'}),
  product('paracetamol',{nombre:'Paracetamol',laboratorio:'Laboratórios LÓPEZ',presentacion:'Tabletas'}),
  product('paracetamol-extra',{nombre:'Paracetamol extra',presentacion:'Tabletas'}),
  product('cheap',{nombre:'Precio menor',precio:4}),
  product('direct',{nombre:'Precio directo',precio:10,descuentoPorcentaje:70}),
  product('campaign',{nombre:'Precio campaña',precio:20}),
  product('expired',{nombre:'Precio vencido',precio:5,stock:7}),
  product('restricted',{nombre:'Precio receta',precio:12,requiereReceta:true}),
  product('preview',{nombre:'Precio vista previa',precio:6}),
  product('ended',{nombre:'Precio finalizado',precio:7}),
  product('percent',{nombre:'Fórmula 100% pura'}),
  product('underscore',{nombre:'Código A_B'}),
  product('inactive',{nombre:'Paracetamol inactivo',laboratorio:'Solo inactivo',presentacion:'Oculta',activo:false}),
  ...Array.from({length:27},(_,i)=>product('page-'+String(i).padStart(2,'0'),{nombre:'Página '+i,categoria:'bebe'})),
  ...Array.from({length:8},(_,i)=>product('suggest-'+i,{nombre:'Sugerencia '+i}))
 ]});
 await db.promocion.createMany({data:[
  {id:'campaign-active',productoId:'campaign',titulo:'Campaña sintética',descripcion:'Descuento sintético',etiqueta:'Prueba',activa:true,vistaPrevia:false,descuentoPorcentaje:90-5},
  {id:'preview-only',productoId:'preview',titulo:'Vista previa',descripcion:'No aplicar',etiqueta:'Prueba',activa:true,vistaPrevia:true,descuentoPorcentaje:80},
  {id:'ended-promo',productoId:'ended',titulo:'Finalizada',descripcion:'No aplicar',etiqueta:'Prueba',activa:true,vistaPrevia:false,descuentoPorcentaje:80,fin:new Date('2020-01-01')}
 ]});
 await db.lote.create({data:{productoId:'expired',numero:'VENCIDO',stock:5,vencimiento:'2020-01-01',costoUnitario:1}});
});
after(async()=>{await db.$disconnect();});

test(provider+': busca sin acentos ni mayúsculas en nombre, descripción, metadatos y códigos',async()=>{
 for(const q of ['acido','ÁCIDO','formula para bienestar','laboratorios lopez','ascorbico','capsulas','acido-01','12345678','cítrico LÓPEZ']){
  const {body}=await api.get('/api/productos').query({q}).expect(200);
  assert.ok(ids(body.data.items).includes('acido'),q);
 }
});
test(provider+': combina filtros reales y excluye inactivos',async()=>{
 const {body}=await api.get('/api/productos').query({q:'acido',categoria:'cuidado',laboratorio:'laboratorios lopez',presentacion:'capsulas'}).expect(200);
 assert.deepEqual(ids(body.data.items),['acido']);
 assert.equal((await api.get('/api/productos').query({q:'acido',categoria:'bebe'}).expect(200)).body.data.total,0);
 assert.equal((await api.get('/api/productos').query({q:'inactivo'}).expect(200)).body.data.total,0);
});
test(provider+': pagina y conserva el total fuera de rango y los valores API predeterminados',async()=>{
 const first=(await api.get('/api/productos').query({categoria:'bebe',pageSize:24}).expect(200)).body.data;
 assert.equal(first.total,27);assert.equal(first.items.length,24);assert.equal(first.page,1);assert.equal(first.pageSize,24);
 assert.deepEqual(ids((await api.get('/api/productos').query({categoria:'bebe',pageSize:24,page:2}).expect(200)).body.data.items),['page-24','page-25','page-26']);
 const empty=(await api.get('/api/productos').query({categoria:'bebe',pageSize:24,page:4}).expect(200)).body.data;
 assert.equal(empty.total,27);assert.deepEqual(empty.items,[]);
 const defaults=(await api.get('/api/productos').expect(200)).body.data;
 assert.equal(defaults.page,1);assert.equal(defaults.pageSize,50);
});
test(provider+': ordena por precio efectivo antes de paginar y conserva promociones, IVA y stock vendible',async()=>{
 const low=(await api.get('/api/productos').query({q:'precio',sort:'low',pageSize:3}).expect(200)).body.data;
 assert.deepEqual(ids(low.items),['campaign','direct','cheap']);assert.equal(low.total,7);
 assert.equal(Number(low.items[0].precio),3);assert.equal(low.items[0].promocionId,'campaign-active');
 const high=(await api.get('/api/productos').query({q:'precio',sort:'high',pageSize:3}).expect(200)).body.data;
 assert.deepEqual(ids(high.items),['restricted','ended','preview']);assert.equal(high.items[0].descuentoPorcentaje,0);
 const second=(await api.get('/api/productos').query({q:'precio',sort:'low',pageSize:3,page:2}).expect(200)).body.data;
 assert.deepEqual(ids(second.items),['expired','preview','ended']);assert.equal(second.items[0].stock,2);assert.equal(second.items[0].ivaPorcentaje,15);
});
test(provider+': sugerencias exactas limitadas a seis, con los filtros y los precios públicos',async()=>{
 const exact=(await api.get('/api/productos/sugerencias').query({q:'sugerencia'}).expect(200)).body.data;
 assert.equal(exact.aproximadas,false);assert.equal(exact.items.length,6);assert.ok(exact.items.every(p=>p.activo));
 const filtered=(await api.get('/api/productos/sugerencias').query({q:'acido',laboratorio:'laboratorios lopez',presentacion:'capsulas'}).expect(200)).body.data;
 assert.deepEqual(ids(filtered.items),['acido']);assert.equal(filtered.aproximadas,false);
 const priced=(await api.get('/api/productos/sugerencias').query({q:'precio campaña'}).expect(200)).body.data;
 assert.equal(Number(priced.items[0].precio),3);
});
test(provider+': señala una errata conservadora solo cuando no hay coincidencias exactas',async()=>{
 const typo=(await api.get('/api/productos/sugerencias').query({q:'paracetmaol'}).expect(200)).body.data;
 assert.equal(typo.aproximadas,true);assert.deepEqual(ids(typo.items),['paracetamol','paracetamol-extra']);
 const exact=(await api.get('/api/productos/sugerencias').query({q:'paracetamol'}).expect(200)).body.data;
 assert.equal(exact.aproximadas,false);assert.deepEqual(ids(exact.items),['paracetamol','paracetamol-extra']);
 for(const q of ['zzzzzzzz','paracetamol 50','prax','maracetamol']){
  const result=(await api.get('/api/productos/sugerencias').query({q}).expect(200)).body.data;
  assert.equal(result.aproximadas,false,q);assert.deepEqual(result.items,[],q);
 }
});
test(provider+': filtros únicos de productos activos sin inventar metadatos',async()=>{
 const {body}=await api.get('/api/productos/filtros').expect(200);
 assert.deepEqual(body.data,{laboratorios:['Laboratórios LÓPEZ'],presentaciones:['Cápsulas','Tabletas']});
});
test(provider+': trata comodines y SQL como texto literal sin ampliar resultados',async()=>{
 for(const [q,expected] of [['100%',['percent']],['A_B',['underscore']],["' OR 1=1 --",[]],['%', ['percent']],['_',['underscore']]]){
  const result=(await api.get('/api/productos').query({q}).expect(200)).body.data;
  assert.deepEqual(ids(result.items),expected,q);
 }
 assert.equal(await db.producto.count({where:{id:'acido'}}),1);
});
test(provider+': rechaza tipos ambiguos, consultas largas, páginas y órdenes no permitidas',async()=>{
 for(const query of ['q=a&q=b','q[x]=a','q='+ 'a'.repeat(101),'laboratorio=a&laboratorio=b','laboratorio[x]=a','presentacion[x]=a','categoria[]=bebe','sort[]=low','sort=unknown','sort=low&sort=high','page=0','page=1&page=2','pageSize=101','pageSize[x]=1'])await api.get('/api/productos?'+query).expect(422);
 for(const query of ['q=a&q=b','q[x]=a','q=a','q='+ 'a'.repeat(101),'q=paracetamol&laboratorio[]=a'])await api.get('/api/productos/sugerencias?'+query).expect(422);
});
test(provider+': la aproximación usa un presupuesto de candidatos y puede no proponer una coincidencia tardía',async()=>{
 await db.producto.createMany({data:[...Array.from({length:200},(_,i)=>product('budget-'+i,{nombre:'Zimaprueba '+i,categoria:'bienestar'})),product('budget-last',{nombre:'Zincovit',categoria:'bienestar',createdAt:new Date('2026-01-02T00:00:00Z')})]});
 const result=(await api.get('/api/productos/sugerencias').query({q:'zincovti',categoria:'bienestar'}).expect(200)).body.data;
 assert.deepEqual(result,{items:[],aproximadas:false});
 const exact=(await api.get('/api/productos/sugerencias').query({q:'zincovit',categoria:'bienestar'}).expect(200)).body.data;
 assert.deepEqual(ids(exact.items),['budget-last']);assert.equal(exact.aproximadas,false);
});
