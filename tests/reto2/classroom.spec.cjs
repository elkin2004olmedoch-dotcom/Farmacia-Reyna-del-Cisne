const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {buildPages}=require('../../scripts/build-pages.cjs');
const AxeBuilder=require('@axe-core/playwright').default;
let server,origin,temporary;
test.beforeAll(async()=>{
  temporary=fs.mkdtempSync(path.join(os.tmpdir(),'farmacia-pages-classroom-'));
  const output=path.join(temporary,'public');buildPages({output});
  server=http.createServer((req,res)=>{
    let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);}catch{res.writeHead(400).end();return;}
    const relative=pathname.replace(/^\/+/,''),candidate=path.resolve(output,relative||'index.html');
    if(!candidate.startsWith(output+path.sep)){res.writeHead(404).end();return;}
    const file=fs.existsSync(candidate)&&fs.statSync(candidate).isFile()?candidate:candidate+'.html';
    if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
});
test.afterAll(async()=>{
  if(server)await new Promise(resolve=>server.close(resolve));
  if(temporary&&path.dirname(temporary)===os.tmpdir()&&path.basename(temporary).startsWith('farmacia-pages-classroom-'))fs.rmSync(temporary,{recursive:true,force:true});
});
test.beforeEach(async({page})=>{
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
});
async function go(page,path){await page.goto(origin+path);await expect(page.locator('#contenido')).not.toHaveAttribute('inert','');}
async function capture(page,testInfo,name){await page.screenshot({path:testInfo.outputPath(name+'.png'),fullPage:true,animations:'disabled'});}

test('clase: cliente compra con imagen y tarifa, prueba pago y conserva su carrito real',async({page},testInfo)=>{
  const outbound=[],errors=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')||new URL(r.url()).origin!==origin)outbound.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await go(page,'/clase.html');
  await page.evaluate(()=>localStorage.setItem('farmacia-mvc-carrito','{"real":2}'));
  await go(page,'/catalogo.html?demo=clase&rol=user');
  await expect(page.locator('#catalog-grid article')).toHaveCount(4);
  await page.locator('#catalog-search').fill('Gel de manos');
  await page.locator('#catalog-grid [data-add]').click();
  await expect(page.locator('#cart-dock')).toBeVisible();await page.locator('#cart-dock a').click();
  await expect(page.locator('.checkout-item-image')).toHaveCount(1);
  expect(await page.locator('.checkout-item-image').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await capture(page,testInfo,'carrito-clase');
  await page.locator('#checkout-next').click();await page.locator('[name=delivery][value=delivery]').check();
  await page.locator('#checkout-document').fill('0102030400');await page.locator('#checkout-address').fill('Calle de ejemplo 123, frente al parque');
  await page.locator('#checkout-terms').check();await expect(page.locator('#checkout-shipping-fee')).toContainText('1,50');
  await page.locator('#checkout-use-location').click();await expect(page.locator('#checkout-location-status')).toContainText('ficticio');
  await page.locator('#delivery-form [type=submit]').click();await expect(page.locator('#order-confirmation')).toBeVisible();
  await go(page,'/pedidos.html');await page.locator('a[href^="pagos.html?pedido="]').first().click();
  await expect(page.locator('#payment-submit')).toBeEnabled();await page.locator('#payment-submit').click();await expect(page.locator('#payment-result')).toContainText('Prueba aprobada');
  expect(await page.evaluate(()=>localStorage.getItem('farmacia-mvc-carrito'))).toBe('{"real":2}');
  expect(outbound).toEqual([]);expect(errors).toEqual([]);
});

test('clase: Farmi cambia precio y promoción; tarifa y reparto completan seguimiento sin GPS externo',async({page},testInfo)=>{
  const outbound=[],errors=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')||new URL(r.url()).origin!==origin)outbound.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await go(page,'/admin.html?demo=clase&rol=admin');
  await expect(page.locator('#admin-dashboard')).toBeVisible();
  await expect(page.locator('[data-admin-section="facturacion"]').first()).toBeHidden();
  const farmi=page.locator('farmacia-admin-companion');
  await farmi.getByRole('button',{name:'Abrir asistente administrativo'}).click();
  await farmi.locator('#input').fill('Actualiza el precio de "Vitamina C" a 3,50');await farmi.locator('#form [type=submit]').click();
  await expect(farmi.locator('#messages')).toContainText('Producto actualizado');
  await farmi.locator('#input').fill('Publica una promoción de 10% para "Vitamina C" hasta 2030-12-31 titulada "Cuidado de ejemplo"');await farmi.locator('#form [type=submit]').click();
  await expect(farmi.locator('#messages')).toContainText('Promoción publicada');await capture(page,testInfo,'farmi-clase');
  await go(page,'/entregas.html?demo=clase&rol=admin');
  await page.locator('[data-zone-edit]').first().click();await page.locator('#delivery-zone-form [name=tarifa]').fill('2.25');await page.locator('#delivery-zone-form [type=submit]').click();
  await expect(page.locator('#delivery-zones-list')).toContainText('2,25');
  await go(page,'/entregas.html?demo=clase&rol=repartidor');
  const delivery=page.locator('[data-delivery]').first();
  await delivery.locator('[data-delivery-state="en_camino"]').click();await delivery.locator('[data-delivery-gps]').click();
  await expect(page.locator('#delivery-gps-status')).toContainText('ejemplo');
  await delivery.locator('[data-delivery-state="en_destino"]').click();await delivery.getByRole('button',{name:'Simular llamada al cliente'}).click();
  await expect(page.locator('#page-status')).toContainText('Llamada simulada');await capture(page,testInfo,'repartidor-clase');
  await go(page,'/pedidos.html?demo=clase&rol=user');await page.locator('a[href^="seguimiento.html?pedido="]').first().click();await page.locator('#tracking-map-load').click();
  await expect(page.locator('#tracking-map-panel svg')).toBeVisible();await expect(page.locator('#tracking-map-panel')).toContainText('ilustrativa');await capture(page,testInfo,'mapa-clase');
  await go(page,'/entregas.html?demo=clase&rol=repartidor');await page.locator('[data-delivery-state="entregada"]').first().click();
  await expect(page.locator('[data-delivery]').first()).toContainText('Entrega cerrada');await expect(page.locator('[data-classroom-call]')).toHaveCount(0);
  expect(outbound).toEqual([]);expect(errors).toEqual([]);
});

test('clase: CRUD por formulario, funciones ocultas, teclado y reinicio preservan datos reales',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await go(page,'/admin.html?demo=clase&rol=admin&tabla=productos');
  await page.evaluate(()=>{localStorage.setItem('farmacia-mvc-carrito','{"real":4}');sessionStorage.setItem('farmacia-mvc-token','sesion-real-preservada');});
  await page.locator('#admin-create').click();
  const form=page.locator('#product-form');
  for(const [name,value]of Object.entries({nombre:'Producto de clase',precio:'5.25',stock:'9',descripcion:'Producto de cuidado de demostración',alt:'Envase ilustrativo de clase'}))await form.locator('[name="'+name+'"]').fill(value);
  await form.locator('[name=categoria]').selectOption('cuidado');await form.locator('[name=tipoProducto]').selectOption('cuidado');
  await form.locator('[type=submit]').click();await expect(page.locator('#editor-dialog')).not.toBeVisible();
  const row=page.locator('#admin-table tbody tr').filter({hasText:'Producto de clase'});await expect(row).toHaveCount(1);
  await row.locator('[data-edit]').click();await form.locator('[name=precio]').fill('6.50');await form.locator('[type=submit]').click();await expect(row).toContainText('6,50');
  await row.locator('[data-delete]').click();await page.locator('#confirm-dialog [value=confirm]').click();await expect(row.locator('[data-edit]')).toBeDisabled();
  if(testInfo.project.name==='movil'){
    await page.locator('#menu-button').click();
    for(let i=0;i<8;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement.getClientRects().length)).toBeGreaterThan(0);}
    await page.keyboard.press('Escape');
  }
  const farmi=page.locator('farmacia-admin-companion');await farmi.getByRole('button',{name:'Abrir asistente administrativo'}).click();
  await farmi.locator('#input').fill('Abre proveedores');await farmi.locator('#form [type=submit]').click();await expect(farmi.locator('#messages')).toContainText('oculta en la demo');
  await expect(page.locator('#admin-page-title')).toHaveText('Productos');
  await go(page,'/pagos.html?demo=clase&rol=user');await expect(page.locator('#payment-error')).toBeHidden();await expect(page.locator('#payment-submit')).toBeEnabled();
  await go(page,'/pedidos.html');await expect(page.getByRole('button',{name:'Consultar factura SRI'})).toBeHidden();
  await go(page,'/clase.html');await capture(page,testInfo,'inicio-clase');
  const audit=await new AxeBuilder({page}).analyze();expect(audit.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#classroom-reset').click();await page.locator('#confirm-dialog [value=cancel]').click();
  await page.locator('#classroom-reset').click();await page.locator('#confirm-dialog [value=confirm]').click();await expect(page).toHaveURL(/clase.html/);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('farmacia-clase-carrito')||'{}'))).toEqual({});
  expect(await page.evaluate(()=>localStorage.getItem('farmacia-mvc-carrito'))).toBe('{"real":4}');
  expect(await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'))).toBe('sesion-real-preservada');expect(errors).toEqual([]);
});
