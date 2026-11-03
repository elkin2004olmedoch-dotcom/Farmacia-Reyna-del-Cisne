const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const product={id:'gel-prueba',nombre:'Gel suave',activo:true,precio:5,stock:20,updatedAt:'2026-11-02T12:00:00Z'};
async function admin(options){const file=path.resolve('frontend/controllers/admin-companion.js');let source=fs.readFileSync(file,'utf8').replace(/^import .*;\r?$/gm,'').replaceAll('import.meta.url',JSON.stringify(pathToFileURL(file).href));source=`import {interpretAdminCommand,ecuadorCommandDay} from '${pathToFileURL(path.resolve('frontend/controllers/admin-command.mjs')).href}';\n${source}`;const module=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));return module.createAdminCommandExecutor({isAdmin:()=>true,deliveryModel:{},confirm:true,...options});}
async function customer(){const {createCustomerCommandExecutor}=await import(pathToFileURL(path.resolve('frontend/controllers/customer-command.mjs')));let items={};const added=[],routes=[];let current={...product};const cart={read:()=>({...items}),add(p,n){items[p.id]=(items[p.id]||0)+n;added.push([p.id,n]);},remove(id){delete items[id];},clear(){items={};}};return {run:createCustomerCommandExecutor({catalog:{all:async()=>[current],find:async()=>current},cart,allowed:p=>!p.controlado,navigate:href=>routes.push(href)}),cart,added,routes,setProduct:p=>{current=p;}};}
test('administración enumera productos, prepara datos y sólo guarda tras confirmar una vez',async()=>{
 const writes=[];const run=await admin({model:{products:async()=>[product],saveProduct:async(...args)=>writes.push(args)}});
 const menu=await run('actualizar algo');assert.equal(menu.actions.length,6);const list=await run('actualizar productos');assert.equal(list.fields[0].options[0].value,product.id);const form=await run(list.submit({product:product.id}));const preview=await run(form.submit({price:'6.25',stock:'18'}));assert.equal(preview.type,'confirmation');assert.match(preview.text,/Gel suave/);assert.equal(writes.length,0);await run('sí confirmo');assert.equal(writes.length,1);assert.equal(writes[0][0].precio,6.25);assert.equal(writes[0][0].esperadoUpdatedAt,product.updatedAt);await run('confirmar');assert.equal(writes.length,1);
});
test('administración cancela y una nueva orden invalida la confirmación anterior',async()=>{
 const writes=[];const run=await admin({model:{products:async()=>[product],saveProduct:async()=>writes.push(1)}});await run('actualiza precio de "Gel suave" a 7');await run('no');await run('confirmar');assert.equal(writes.length,0);await run('actualiza precio de "Gel suave" a 7');await run('ayuda');await run('confirmar');assert.equal(writes.length,0);
});
test('promoción guiada conserva id único y sólo publica con confirmación',async()=>{
 const writes=[];const run=await admin({model:{products:async()=>[product],savePromotion:async values=>writes.push(values)}});const list=await run('poner en promocion'),form=await run(list.submit({product:product.id}));const preview=await run(form.submit({percentage:'20',until:'2030-12-31'}));assert.equal(preview.type,'confirmation');assert.equal(writes.length,0);await run('confirmar');assert.equal(writes[0].productoId,product.id);assert.equal(writes[0].descuentoPorcentaje,20);
});
test('sesión perdida antes de confirmar impide guardar',async()=>{
 let permitted=true;const run=await admin({isAdmin:()=>permitted,model:{products:async()=>[product],saveProduct:()=>assert.fail('Sin permiso')}});await run('actualiza precio de "Gel suave" a 7');permitted=false;await assert.rejects(run('confirmar'),/sesión/);
});
test('pedidos y zonas se seleccionan sin guardar y confirman con la versión del resumen',async()=>{
 const saves=[],order={id:'pedido-1',nombre:'Cliente',estado:'pendiente',updatedAt:'2026-11-02T12:00:00Z'},zone={id:'puerto-quito',nombre:'Puerto Quito',tarifaCentavos:250,version:3};const run=await admin({model:{table:async()=>({items:[order],total:1}),order:async()=>({...order}),changeOrderState:async(...args)=>saves.push(args)},deliveryModel:{adminZones:async()=>[{...zone}],saveZone:async(...args)=>saves.push(args)}});
 const list=await run('actualizar pedidos'),form=await run(list.submit({record:order.id}));await run(form.submit({state:'confirmado'}));order.updatedAt='2026-11-02T13:00:00Z';assert.equal(saves.length,0);await run('confirmar');assert.equal(saves[0][2],'2026-11-02T12:00:00Z');
 const zones=await run('actualizar zonas'),zoneForm=await run(zones.submit({record:zone.id}));await run(zoneForm.submit({fee:'3.50'}));zone.version=4;await run('confirmar');assert.equal(saves[1][0].esperadoVersion,3);assert.equal(saves[1][0].tarifaCentavos,350);
});
test('fallo de refresco posterior no presenta un guardado correcto como fallido',async()=>{
 let writes=0;const run=await admin({model:{products:async()=>[product],saveProduct:async()=>writes++},refresh:async()=>{throw Error('Red');}});await run('actualiza precio de "Gel suave" a 7');assert.match((await run('confirmar')).text,/se guardó/);await run('confirmar');assert.equal(writes,1);
});
test('cliente selecciona cantidad, cancela o confirma sin escribir pedidos ni administrar',async()=>{
 const {run,cart,added}=await customer();const list=await run('buscar productos');const preview=await run(list.submit({product:product.id,quantity:'2'}));assert.equal(preview.actions.length,2);assert.equal(added.length,0);await run('no');await run('confirmar');assert.equal(added.length,0);await run(list.submit({product:product.id,quantity:'2'}));await run('si confirmo');assert.equal(cart.read()[product.id],2);await run('confirmar');assert.equal(added.length,1);assert.equal(await run('actualiza precio a 2'),null);
});
test('cliente exige otra confirmación si cambia el precio y rechaza restricciones sanitarias',async()=>{
 const {run,added,setProduct}=await customer();await run('seleccionar agregar gel-prueba 1');setProduct({...product,precio:7});assert.ok((await run('confirmar')).actions);assert.equal(added.length,0);await run('confirmar');assert.equal(added.length,1);await run('seleccionar agregar gel-prueba 1');setProduct({...product,controlado:true});await assert.rejects(run('confirmar'),/no está disponible/);assert.equal(added.length,1);
});
test('cliente invalida propuestas al cambiar carrito y confirma vaciado y checkout por separado',async()=>{
 const {run,cart,routes}=await customer();await run('seleccionar agregar gel-prueba 1');cart.add(product,1);assert.match((await run('confirmar')).text,/carrito cambió/);await run('vaciar carrito');assert.ok(cart.read()[product.id]);await run('cancelar');assert.ok(cart.read()[product.id]);await run('vaciar carrito');await run('confirmar');assert.deepEqual(cart.read(),{});await run('comprar');assert.equal(routes.length,0);await run('confirmar');assert.deepEqual(routes,['checkout.html']);
});
test('perfil abre la cuenta y descarta propuestas de ambos asistentes sin guardar',async()=>{
 const run=await admin({model:{products:async()=>[product],saveProduct:()=>assert.fail('No debe guardar')}});await run('actualiza precio de "Gel suave" a 7');assert.equal((await run('perfil')).actions[0].href,'cuenta.html');assert.match((await run('confirmar')).text,/No hay cambios/);
 const client=await customer();await client.run('seleccionar agregar gel-prueba 1');assert.equal((await client.run('mi perfil')).actions[0].href,'cuenta.html');await client.run('confirmar');assert.equal(client.added.length,0);
});
