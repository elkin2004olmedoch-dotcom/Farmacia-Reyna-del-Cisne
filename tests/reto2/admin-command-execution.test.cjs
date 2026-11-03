const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
async function executor(){
  // Browser dependencies are injected; run the actual executor without a DOM.
  let source=fs.readFileSync(path.join(__dirname,'../../frontend/controllers/admin-companion.js'),'utf8');
  source=source.replace(/^import .*;\r?$/gm,'');
  source=source.replaceAll('import.meta.url',JSON.stringify(pathToFileURL(path.resolve(__dirname,'../../frontend/controllers/admin-companion.js')).href));
  const parser=pathToFileURL(path.resolve(__dirname,'../../frontend/controllers/admin-command.mjs')).href;
  source=`import {interpretAdminCommand,ecuadorCommandDay} from '${parser}';\n${source}`;
  const create=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).createAdminCommandExecutor;
  return options=>create({deliveryModel:{},...options});
}
test('navegación y formularios incompletos no consultan el catálogo ni guardan',async()=>{
  const create=await executor();const actions=[];
  const run=create({isAdmin:()=>true,model:{products:()=>assert.fail('unexpected catalog')},navigate:async section=>actions.push(section),openEditor:async(section,values)=>actions.push({section,values})});
  await run('abre proveedores');await run('crea proveedor: nombre="Distribuidor"');
  assert.deepEqual(actions,['proveedores',{section:'proveedores',values:{nombre:'Distribuidor'}}]);
});
test('ordena guardado de alta completa y preserva versión y flags al modificar',async()=>{
  const create=await executor(),saved=[];let refreshes=0;
  const product={id:'curitas',nombre:'Curitas clásicas',activo:true,precio:1,stock:5,categoria:'cuidado',descripcion:'Una caja',imagen:'assets/images/a.webp',alt:'Caja',controlado:true,biologico:false,cadenaFrio:true,updatedAt:'2026-10-01T00:00:00Z'};
  const model={products:async()=>[product],saveProduct:async(...args)=>saved.push(args)};
  const run=create({isAdmin:()=>true,model,refresh:async()=>refreshes++});
  await run('modifica producto "Curitas clásicas": precio=2');
  assert.equal(saved[0][0].esperadoUpdatedAt,product.updatedAt);assert.equal(saved[0][0].controlado,true);assert.equal(saved[0][0].cadenaFrio,true);assert.equal(saved[0][1],'curitas');
  await run('crea producto: nombre="Gel"; precio=2; stock=5; categoria=cuidado; tipoProducto=cuidado; descripcion="Gel manos"; imagen="assets/images/gel.webp"; alt="Frasco gel"; ivaCategoria=general');
  assert.equal(saved.length,2);assert.equal(saved[1][1],undefined);assert.equal(refreshes,2);
});
test('conserva versión fresca al cambiar pedido y fecha local de promoción',async()=>{
  const create=await executor();const calls=[];
  const run=create({isAdmin:()=>true,model:{products:async()=>[{id:'curitas',nombre:'Curitas clásicas'}],order:async()=>({id:'pedido-1',updatedAt:'2026-10-28T13:00:00Z'}),changeOrderState:async(...args)=>calls.push(args),savePromotion:async()=>{}}});
  await run('cambia pedido "pedido-1" a preparado');assert.deepEqual(calls,[['pedido-1','preparado','2026-10-28T13:00:00Z']]);
  assert.match((await run('publica promoción 20% para "Curitas clásicas" hasta 2026-12-31')).text,/hasta 2026-12-31/);
});
test('doble ejecución y sesión perdida no producen un segundo guardado',async()=>{
  const create=await executor();let release,isAdmin=true,saves=0;
  const run=create({isAdmin:()=>isAdmin,model:{products:()=>new Promise(resolve=>{release=()=>resolve([{id:'curitas',nombre:'Curitas clásicas',activo:true}]);}),saveProduct:async()=>saves++}});
  const pending=run('actualiza precio de "Curitas clásicas" a 2');
  await assert.rejects(run('actualiza precio de "Curitas clásicas" a 2'),/Espera/);
  isAdmin=false;release();await assert.rejects(pending,/sesión/);assert.equal(saves,0);
});
test('zona y entrega recuperan versiones actuales antes de mutar',async()=>{
  const create=await executor();const calls=[];
  const run=create({isAdmin:()=>true,model:{},deliveryModel:{adminZones:async()=>[{id:'zona-1',nombre:'Centro',provincia:'Loja',canton:'Loja',tarifaCentavos:0,ivaCategoria:'general',activa:true,version:4}],saveZone:async(...args)=>calls.push(args),list:async()=>({items:[{id:'entrega-1',pedidoId:'pedido-1',version:7}],total:1}),assign:async values=>calls.push(values),changeState:async(...args)=>calls.push(args)}});
  await run('modifica zona "zona-1": tarifaCentavos=250');
  assert.equal(calls[0][0].esperadoVersion,4);assert.equal(calls[0][1],'zona-1');
  await run('asigna pedido "pedido-1" a repartidor "repartidor-2"');assert.equal(calls[1].esperadoVersion,7);
  await run('cambia entrega "entrega-1" a en_destino');assert.deepEqual(calls[2],['entrega-1','en_destino',7]);
});
