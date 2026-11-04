const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {DOMImplementation}=require('@xmldom/xmldom');
const product={id:'gel-prueba',nombre:'Gel <img src=x onerror=alert(1)>',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase de gel',presentacion:'Frasco de 100 ml',precio:5.25,stock:20,activo:true};
const user={id:'usuario-propio',role:'user'};
const orderId='d110aa77-1234-4234-8234-123456789abc';
async function moduleAt(relative,{strip=false}={}){
  const file=path.resolve(relative);let source=fs.readFileSync(file,'utf8');
  if(strip)source=source.replace(/^import .*;\r?$/gm,'');
  else source=source.replace(/(from\s+|import\s+)(['"])(\.[^'"]+)\2/g,(_,prefix,quote,specifier)=>{const dependency=path.resolve(path.dirname(file),specifier);return prefix+quote+(specifier==='../config.js'?'data:text/javascript;base64,'+Buffer.from(fs.readFileSync(dependency,'utf8')).toString('base64'):pathToFileURL(dependency).href)+quote;});
  return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
async function customer(options={}){
  const {createCustomerCommandExecutor}=await import(pathToFileURL(path.resolve('frontend/controllers/customer-command.mjs')));
  let items={},current={...product};const pages=[];
  const cart={read:()=>({...items}),add(p,n){items[p.id]=(items[p.id]||0)+n;},remove(id){delete items[id];},clear(){items={};}};
  const catalog={page:async params=>{pages.push(params);return {items:[current],total:1,page:1,pageSize:8};},all:()=>assert.fail('Una búsqueda no debe descargar el catálogo completo'),find:async()=>current};
  const run=createCustomerCommandExecutor({catalog,cart,allowed:p=>!p.controlado,...options});
  return {run,cart,pages,setProduct:next=>{current=next;}};
}
async function admin(options){
  const file=path.resolve('frontend/controllers/admin-companion.js');let source=fs.readFileSync(file,'utf8').replace(/^import .*;\r?$/gm,'');
  source=`import {interpretAdminCommand,ecuadorCommandDay} from '${pathToFileURL(path.resolve('frontend/controllers/admin-command.mjs')).href}';\n${source}`;
  const {createAdminCommandExecutor}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  return createAdminCommandExecutor({isAdmin:()=>true,confirm:true,deliveryModel:{},...options});
}
test('búsqueda paginada devuelve foto, presentación y precio de tarjetas y conserva selección confirmada',async()=>{
  const {run,cart,pages}=await customer();const found=await run('buscar gel');
  assert.equal(pages[0].q,'gel');assert.equal(pages[0].pageSize,8);
  assert.equal(found.visualSummary.kind,'products');assert.equal(found.visualSummary.items[0].imagen,product.imagen);
  const preview=await run(found.submit({product:product.id,quantity:'2'}));
  assert.equal(preview.visualSummary.items[0].cantidad,2);assert.deepEqual(cart.read(),{});
  await run('cancelar');await run('confirmar');assert.deepEqual(cart.read(),{});
  await run(found.submit({product:product.id,quantity:'2'}));const saved=await run('confirmar');
  assert.equal(saved.visualSummary.items[0].nombre,product.nombre);assert.equal(cart.read()[product.id],2);
});
test('carrito consulta precio vigente, subtotal sin envío y restricciones; precio cambiado exige otra confirmación',async()=>{
  const {run,cart,setProduct}=await customer();cart.add(product,2);setProduct({...product,precio:6,stock:1,controlado:true});
  const summary=await run('resumen del carrito');assert.equal(summary.visualSummary.kind,'cart');assert.equal(summary.visualSummary.subtotalCentavos,1200);
  assert.equal(summary.visualSummary.items[0].restricted,true);assert.equal(summary.visualSummary.items[0].stock,1);
  assert.match(summary.text,/envío.*checkout/i);
  setProduct({...product});await run('seleccionar agregar gel-prueba 1');setProduct({...product,precio:7});
  const changed=await run('confirmar');assert.match(changed.text,/precio cambió/);assert.equal(changed.visualSummary.items[0].precio,7);assert.equal(cart.read()[product.id],2);
  await run('confirmar');assert.equal(cart.read()[product.id],3);
});
test('carrito no inventa subtotal cuando un precio falta ni permite cantidad cero',async()=>{
  const {run,cart,setProduct}=await customer();cart.add(product,1);setProduct({...product,precio:null});
  const summary=await run('mi carrito');assert.equal(summary.visualSummary.subtotalCentavos,null);
  await assert.rejects(run('seleccionar agregar gel-prueba 0'),/cantidad|disponible/i);
});
test('producto con stock ausente o precio no numérico no prepara una compra',async()=>{
  const {run,setProduct}=await customer();
  for(const invalid of [{stock:undefined},{stock:-1},{stock:1.5},{precio:true},{precio:'   '}]){
    setProduct({...product,...invalid});await assert.rejects(run('seleccionar agregar gel-prueba 1'),/disponible/i);
  }
});
test('resumen pendiente mantiene bloqueo hasta terminar la lectura y evita una confirmación simultánea',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});
  const {run,cart}=await customer({catalog:{find:async()=>{await gate;return product;}}});cart.add(product,1);
  const reading=run('mi carrito');assert.match((await run('vaciar carrito')).text,/Espera/);release();await reading;
  assert.equal((await run('confirmar')).actions,undefined);assert.equal(cart.read()[product.id],1);
});
test('pedidos consulta sólo API propia y proyecta estado/productos sin datos privados',async()=>{
  const {run,setProduct}=await customer({session:()=>user,orders:{mine:async page=>{assert.equal(page,1);return {items:[{id:orderId,userId:user.id,estado:'preparado',total:10.5,email:'privado@example.ec',telefono:'0999999999',codigoEntrega:'654321',detalles:[{productoId:product.id,nombreProducto:'Gel comprado',cantidad:2,precioUnitario:5.25}]}]};}}});setProduct({...product,precio:9});
  const result=await run('último pedido');assert.equal(result.visualSummary.kind,'orders');const order=result.visualSummary.items[0];
  assert.equal(order.id,orderId);assert.equal(order.estado,'preparado');assert.equal(order.productos[0].imagen,product.imagen);assert.equal(order.productos[0].nombre,'Gel comprado');assert.equal(order.productos[0].precio,5.25);
  assert.doesNotMatch(JSON.stringify(result.visualSummary),/privado@example|0999999999|654321|codigoEntrega|telefono|email/);
});
test('invitado, sesión cambiada o caducada y pedido ajeno no reciben tarjetas privadas',async()=>{
  let signed=user;const own={id:orderId,userId:'otro',estado:'pendiente',detalles:[]};
  const guest=await customer({orders:{mine:()=>assert.fail('No consultar sin sesión')}});assert.equal((await guest.run('mis pedidos')).actions[0].href,'cuenta.html');
  const foreign=await customer({session:()=>user,orders:{mine:async()=>({items:[own]})}});assert.equal((await foreign.run('mis pedidos')).visualSummary?.items.length||0,0);
  const changed=await customer({session:()=>signed,orders:{mine:async()=>{signed=null;return {items:[{...own,userId:user.id}]};}}});assert.equal((await changed.run('mis pedidos')).actions[0].href,'cuenta.html');
  const expired=await customer({session:()=>user,orders:{mine:async()=>{throw Object.assign(Error('Caducó'),{status:401});}}});assert.equal((await expired.run('mis pedidos')).actions[0].href,'cuenta.html');
});
function documentFixture(){
  const doc=new DOMImplementation().createDocument(null,'root',null),create=doc.createElement.bind(doc);
  function enhance(node){node.append=(...children)=>{for(const child of children)node.appendChild(child);};return node;}
  enhance(doc.documentElement);
  doc.createElement=name=>{const node=enhance(create(name)),events=new EventTarget();node.addEventListener=events.addEventListener.bind(events);node.dispatchEvent=events.dispatchEvent.bind(events);return node;};
  return doc;
}
test('tarjetas usan DOM, foto real lazy con dimensiones y fallback, y escapan nombres extensos sin HTML',async()=>{
  const {appendCompanionCards}=await moduleAt('frontend/controllers/companion-cards.js');const doc=documentFixture(),target=doc.documentElement;
  appendCompanionCards(target,{kind:'products',items:[{...product,nombre:product.nombre+' largo'.repeat(120)}]},doc);
  const image=target.getElementsByTagName('img')[0],link=target.getElementsByTagName('a')[0];
  assert.equal(image.src,product.imagen);assert.equal(image.loading,'lazy');assert.equal(image.width,64);assert.equal(image.height,64);
  assert.equal(link.href,'producto.html?id=gel-prueba');assert.match(target.textContent,/Frasco de 100 ml/);assert.match(target.textContent,/5,25|5.25/);
  assert.equal(target.getElementsByTagName('script').length,0);assert.equal(target.getElementsByTagName('img').length,1);assert.equal(image.hasAttribute('onerror'),false);
  image.dispatchEvent(new Event('error'));assert.equal(image.src,'assets/images/producto-sin-imagen.svg');
  image.dispatchEvent(new Event('error'));assert.equal(image.src,'assets/images/producto-sin-imagen.svg');
});
test('tarjetas bloquean fotos/URLs peligrosas y no presentan precio ausente como cero',async()=>{
  const {appendCompanionCards,safeCompanionHref}=await moduleAt('frontend/controllers/companion-cards.js');const doc=documentFixture(),target=doc.documentElement;
  appendCompanionCards(target,{kind:'products',items:[{...product,imagen:'javascript:alert(1)',precio:null},{...product,id:'../admin'}]},doc);
  assert.equal(target.getElementsByTagName('img').length,1);assert.equal(target.getElementsByTagName('img')[0].src,'assets/images/producto-sin-imagen.svg');assert.match(target.textContent,/Precio por confirmar/);
  for(const href of ['javascript:alert(1)','https://evil.test','//evil.test','admin.html?tabla=usuarios&registro=x','producto.html?id=x&next=//evil.test','producto.html?id=../admin','seguimiento.html?pedido=x#evil'])assert.equal(safeCompanionHref(href),null,href);
  assert.equal(safeCompanionHref('admin.html?tabla=productos&registro=gel-prueba'),'admin.html?tabla=productos&registro=gel-prueba');
  assert.equal(safeCompanionHref('seguimiento.html?pedido='+orderId),'seguimiento.html?pedido='+orderId);
});
test('tarjeta restringida informa tanto existencias como atención farmacéutica',async()=>{
  const {appendCompanionCards}=await moduleAt('frontend/controllers/companion-cards.js');const doc=documentFixture(),target=doc.documentElement;
  appendCompanionCards(target,{kind:'cart',items:[{...product,restricted:true,stock:1,cantidad:2}],subtotalCentavos:1050},doc);
  assert.match(target.textContent,/Stock insuficiente: 1/);assert.match(target.textContent,/atención farmacéutica/);
});
test('administración ofrece registro exacto sólo tras éxito y mantiene enlace si falla el refresco',async()=>{
  let failed=false;const run=await admin({model:{products:async()=>[product],saveProduct:async()=>{if(failed)throw Error('Conflicto');return product;}},refresh:async()=>{throw Error('Red');}});
  const preview=await run('modifica producto "id:gel-prueba": precio=7');assert.equal(preview.actions.some(a=>a.href),false);
  const saved=await run('confirmar');assert.equal(saved.actions[0].label,'Ver registro');assert.equal(saved.actions[0].href,'admin.html?tabla=productos&registro=gel-prueba');
  await run('modifica producto "id:gel-prueba": precio=8');failed=true;await assert.rejects(run('confirmar'),/Conflicto/);
  assert.equal((await run('confirmar')).actions,undefined);
});
test('promoción y zona abren el registro guardado, con identificador distinto al producto',async()=>{
  const zone={id:'zona-prueba',nombre:'Zona de prueba',tarifaCentavos:250,version:3};
  const run=await admin({model:{products:async()=>[product],savePromotion:async()=>({id:'promocion-prueba'})},deliveryModel:{adminZones:async()=>[zone],saveZone:async()=>zone}});
  await run('Publica promoción 20% para "id:gel-prueba" hasta 2030-12-31');const promotion=await run('confirmar');assert.equal(promotion.actions[0].href,'admin.html?tabla=promociones&registro=promocion-prueba');
  await run('modifica zona "zona-prueba": tarifaCentavos=300');const saved=await run('confirmar');assert.equal(saved.actions[0].href,'admin.html?tabla=zonas&registro=zona-prueba');
});
test('navegación administrativa encuentra registro fuera de primera página y revalida rol',async()=>{
  const {findCompanionRecord}=await moduleAt('frontend/controllers/admin.js',{strip:true});const pages=[];
  const found=await findCompanionRecord({table:'productos',record:product.id,allowed:()=>true,load:async(_table,page)=>{pages.push(page);return {items:page===2?[product]:[{id:'otro'}],total:2,pageSize:1,page};}});
  assert.equal(found.page,2);assert.equal(found.record.id,product.id);assert.deepEqual(pages,[1,2]);
  let allowed=true;await assert.rejects(findCompanionRecord({table:'productos',record:product.id,allowed:()=>allowed,load:async()=>{allowed=false;return {items:[product],total:1,pageSize:20};}}),/sesión/);
  await assert.rejects(findCompanionRecord({table:'usuarios',record:'x',allowed:()=>true,load:()=>assert.fail('Tabla no admitida')}),/registro|tabla/i);
  assert.equal(await findCompanionRecord({table:'zonas',record:'zona-inexistente',allowed:()=>true,load:async()=>({items:[],total:0,pageSize:20})}),null);
});
