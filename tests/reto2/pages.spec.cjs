const {test:base,expect}=require('@playwright/test');
const {randomUUID}=require('node:crypto');
const API='http://127.0.0.1:3302',STATIC='http://127.0.0.1:3301';
const admin={email:'admin-browser@example.ec',password:'AdminBrowser2026!'};
const tinyPNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGP4fGkRVsQwtCQAJ4yZwRji18kAAAAASUVORK5CYII=','base64');
const test=base.extend({
  api:async({playwright},use)=>{const api=await playwright.request.newContext({baseURL:API});try{await use(api);}finally{await api.dispose();}},
  page:async({page},use)=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>[STATIC,API].includes(new URL(route.request().url()).origin)?route.continue():route.abort());
    await use(page);expect(errors).toEqual([]);
  },
});
async function login(api,values=admin){const response=await api.post('/api/auth/login',{data:values});expect(response.status()).toBe(200);return (await response.json()).data.token;}
async function customer(api){
  const values={nombre:'Cliente Pages',email:'pages-'+randomUUID()+'@example.ec',telefono:'0979275988',cedula:'0102030400',password:'ClienteBrowser2026!'};
  const response=await api.post('/api/auth/register',{data:values});expect(response.status()).toBe(201);return {...values,token:(await response.json()).data.token};
}
async function withToken(page,token){await page.addInitScript(({token,origin})=>{if(location.origin===origin)sessionStorage.setItem('farmacia-mvc-token',token);},{token,origin:STATIC});}
async function hold(page,predicate){
  let release,attempts=0;const paths=[];const gate=new Promise(resolve=>release=resolve);
  await page.route(API+'/api/**',async route=>{
    if(!predicate(new URL(route.request().url())))return route.continue();
    attempts++;paths.push(new URL(route.request().url()).pathname);await gate;
    // Timed-out requests are deliberately cancelled while their gate is held.
    await route.continue().catch(()=>{});
  });
  return {release,get attempts(){return attempts;},attemptsFor:path=>paths.filter(value=>value===path).length};
}

test('artefacto estático separado conserva rutas, CSP, catálogo real y CORS exacto',async({page,api})=>{
  for(const route of ['/api/productos','/assets/uploads/00000000-0000-4000-8000-000000000000.webp','/server/index.cjs'])expect((await api.get(STATIC+route)).status()).toBe(404);
  const html=await api.get(STATIC+'/catalogo');expect(html.status()).toBe(200);
  expect(html.headers()['content-security-policy']).toContain(API);
  const allowed=await api.fetch('/api/auth/login',{method:'OPTIONS',headers:{Origin:STATIC,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});
  expect(allowed.status()).toBe(204);expect(allowed.headers()['access-control-allow-origin']).toBe(STATIC);
  expect(allowed.headers()['access-control-allow-headers'].toLowerCase()).toContain('authorization');
  const denied=await api.get('/api/productos',{headers:{Origin:'http://127.0.0.1:3399'}});expect(denied.status()).toBe(403);expect(denied.headers()['access-control-allow-origin']).toBeUndefined();
  const requests=[];page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))requests.push(request.url());});
  const expected=(await (await api.get('/api/productos?pageSize=100')).json()).data.total;
  await page.goto('/catalogo');await expect(page.locator('#catalog-grid article')).toHaveCount(expected);
  expect(requests.length).toBeGreaterThan(0);expect(requests.every(url=>new URL(url).origin===API)).toBe(true);
});

test('cliente inicia sesión entre orígenes y conserva carrito/formulario ante un POST fallido sin duplicarlo',async({page,api})=>{
  const user=await customer(api);
  await page.goto('/producto.html?id=solar');await page.locator('#detail-add-form [type=submit]').click();await expect(page.locator('[data-shop-count]')).toHaveText('1');
  await page.reload();await expect(page.locator('[data-shop-count]')).toHaveText('1');
  await page.goto('/checkout.html');await page.locator('#checkout-next').click();await expect(page).toHaveURL(/cuenta.html\?next=checkout.html/);
  await page.locator('#login-email').fill(user.email);await page.locator('#login-password').fill(user.password);await page.locator('#login-form [type=submit]').click();
  await expect(page).toHaveURL(/checkout.html$/);await page.locator('#checkout-next').click();await expect(page.locator('#delivery-form')).toBeVisible();
  await page.locator('#checkout-document').fill('0102030400');await page.locator('#checkout-terms').check();
  let posts=0;const matcher=API+'/api/pedidos';
  await page.route(matcher,async route=>{
    if(route.request().method()!=='POST')return route.continue();
    posts++;await route.fulfill({status:503,headers:{'Access-Control-Allow-Origin':STATIC},json:{ok:false,error:{message:'Pedido temporalmente no disponible.'}}});
  });
  await page.locator('#delivery-form [type=submit]').click();await expect(page.locator('#page-status')).toContainText('temporalmente');
  expect(posts).toBe(1);await expect(page.locator('#checkout-document')).toHaveValue('0102030400');await expect(page.locator('[data-shop-count]')).toHaveText('1');
  await page.unroute(matcher);await page.locator('#delivery-form [type=submit]').click();await expect(page.locator('#order-confirmation')).toContainText('Tu pedido quedó registrado.');
  await expect(page.locator('[data-shop-count]')).toHaveText('0');await page.goto('/pedidos.html');await expect(page.locator('.order-card')).toHaveCount(1);
  const token=await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'));
  const orders=await api.get('/api/pedidos/mis-pedidos',{headers:{Authorization:'Bearer '+token}});expect((await orders.json()).data.total).toBe(1);
});

test('admin pendiente no muestra compras y recupera su rol sin bloquear la portada ni el menú',async({page,api},testInfo)=>{
  await withToken(page,await login(api));const gate=await hold(page,url=>url.pathname==='/api/auth/me');
  try{
    await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('#featured-products article')).toHaveCount(4);
    await expect(page.locator('[data-customer-only]:visible')).toHaveCount(0);
    if(testInfo.project.name==='movil'){await page.locator('#menu-button').click();await expect(page.locator('#mobile-nav')).toBeVisible();}
  }finally{gate.release();}
  await expect(page.locator('[data-account-link]')).toHaveText('Panel');await expect(page.locator('[data-customer-only]:visible')).toHaveCount(0);
  await page.goto('/checkout.html');await expect(page).toHaveURL(/admin.html$/);
});

test('sesión vencida se limpia y un cliente normal no obtiene permisos administrativos',async({page,api})=>{
  await page.addInitScript(origin=>{if(location.origin===origin && !sessionStorage.getItem('pages-expired-inserted')){sessionStorage.setItem('pages-expired-inserted','1');sessionStorage.setItem('farmacia-mvc-token','synthetic-expired-pages-token');}},STATIC);
  await page.goto('/');await expect(page.locator('#featured-products article')).toHaveCount(4);
  await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'))).toBeNull();await expect(page.locator('body')).not.toHaveAttribute('data-session-pending');
  const user=await customer(api);await page.goto('/cuenta.html');await page.locator('#login-email').fill(user.email);await page.locator('#login-password').fill(user.password);await page.locator('#login-form [type=submit]').click();
  await expect(page.locator('#logout')).toBeVisible();
  const response=await api.get('/api/admin/resumen',{headers:{Authorization:'Bearer '+user.token}});expect(response.status()).toBe(403);
  await page.goto('/admin.html');await expect(page.locator('#admin-area')).toBeHidden();await expect(page.locator('#page-status')).toContainText('administradores');
});

test('503 al restaurar sesión conserva token y compras ocultas sin tratarlo como invitado',async({page,api})=>{
  const token=await login(api);await withToken(page,token);let attempts=0;
  await page.route(API+'/api/auth/me',async route=>{attempts++;await route.fulfill({status:503,headers:{'Access-Control-Allow-Origin':STATIC},json:{ok:false,error:{message:'Sesión temporalmente no disponible.'}}});});
  await page.goto('/');await expect(page.locator('#featured-products article')).toHaveCount(4);await expect(page.locator('#page-status')).toContainText('Sesión temporalmente');
  expect(attempts).toBe(1);expect(await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'))).toBe(token);await expect(page.locator('[data-customer-only]:visible')).toHaveCount(0);
});

test('admin carga imágenes en la API y la tienda estática muestra la subida y el stock agotado',async({page,api})=>{
  const token=await login(api),headers={Authorization:'Bearer '+token};
  const uploaded=await api.post('/api/admin/imagenes',{headers,data:{archivo:tinyPNG.toString('base64'),nombreOriginal:'pages.png'}});expect(uploaded.status()).toBe(201);
  const image=(await uploaded.json()).data.imagen;
  const response=await api.post('/api/productos',{headers,data:{nombre:'Agotado Pages '+randomUUID(),precio:6.25,stock:0,categoria:'bienestar',descripcion:'Producto sintético sin existencias',imagen:image,alt:'Imagen sintética Pages'}});expect(response.status()).toBe(201);
  const product=(await response.json()).data;
  await page.goto('/producto.html?id='+product.id);const photo=page.locator('.product-main-image img');
  await expect(photo).toHaveAttribute('src',API+'/'+image);await expect.poll(()=>photo.evaluate(img=>img.naturalWidth)).toBe(8);await expect(page.locator('#detail-add-button')).toBeDisabled();
  await withToken(page,token);await page.goto('/admin.html?tabla=productos');await expect(page.locator('#admin-table table')).toBeVisible();
  const row=page.locator('#admin-table tbody tr').filter({hasText:product.nombre});
  while(await row.count()===0 && await page.locator('#admin-next').isEnabled()){await page.locator('#admin-next').click();await expect(page.locator('#admin-table')).not.toHaveAttribute('aria-busy','true');}
  await row.locator('[data-edit]').click();const preview=page.locator('#product-image-preview');await expect(preview).toHaveAttribute('src',API+'/'+image);await expect.poll(()=>preview.evaluate(img=>img.naturalWidth)).toBe(8);
});

test('un GET transitorio reintenta una vez y presenta datos reales',async({page})=>{
  let attempts=0;
  await page.route(API+'/api/productos?*',async route=>{if(++attempts===1)return route.fulfill({status:503,headers:{'Access-Control-Allow-Origin':STATIC},json:{ok:false,error:{message:'Inicio temporal.'}}});return route.continue();});
  await page.goto('/');await expect(page.locator('#featured-products article')).toHaveCount(4);expect(attempts).toBe(2);
});

for(const recover of [false,true])test(recover?'API retenida 30 s simulados permite portada y recuperación por foco':'API sin respuesta termina en error acotado y conserva el carrito',async({page},testInfo)=>{
  await page.clock.install({time:new Date('2026-10-21T12:00:00Z')});await page.clock.pauseAt(new Date('2026-10-21T12:00:01Z'));
  await page.addInitScript(origin=>{if(location.origin===origin)localStorage.setItem('farmacia-mvc-carrito',JSON.stringify({solar:2}));},STATIC);
  const gate=await hold(page,url=>url.pathname==='/api/productos' || url.pathname==='/api/promociones');
  try{
    await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('.business-photo')).toBeVisible();await expect(page.locator('#featured-products article')).toHaveCount(0);
    await expect(page.locator('[data-shop-count]')).toHaveText('2');await expect.poll(()=>gate.attempts).toBeGreaterThanOrEqual(1);
    if(testInfo.project.name==='movil'){await page.locator('#menu-button').click();await expect(page.locator('#mobile-nav')).toBeVisible();await page.keyboard.press('Escape');}
    await page.clock.runFor(10000);await page.clock.runFor(500);await expect.poll(()=>gate.attemptsFor('/api/productos')).toBe(2);await page.clock.runFor(10000);
    await expect(page.locator('#page-status')).toHaveAttribute('role','alert');await expect(page.locator('#featured-products article')).toHaveCount(0);
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('farmacia-mvc-carrito')))).toEqual({solar:2});
    if(recover){await page.clock.runFor(9500);gate.release();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('#featured-products article')).toHaveCount(4);await expect(page.locator('[data-shop-count]')).toHaveText('2');}
  }finally{gate.release();}
});

test('admin descarga el RIDE de un borrador autenticado entre orígenes sin emitirlo',async({page,api})=>{
  const fixture=require('./sri-fixture.cjs');
  const token=await login(api),headers={Authorization:'Bearer '+token};
  const user=await customer(api);
  const configured=await api.put('/api/admin/facturacion/configuracion',{headers,data:fixture.emitter});
  expect(configured.status()).toBe(200);expect((await configured.json()).data.certificado.presente).toBe(false);
  const created=await api.post('/api/productos',{headers,data:{nombre:'Producto RIDE Pages '+randomUUID(),precio:5.75,stock:2,categoria:'bienestar',descripcion:'Producto sintético para comprobar la descarga del borrador',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase sintético RIDE'}});
  expect(created.status()).toBe(201);const product=(await created.json()).data;
  const ordered=await api.post('/api/pedidos',{headers:{Authorization:'Bearer '+user.token},data:{carrito:[{productoId:product.id,cantidad:1}],comprador:{name:user.nombre,email:user.email,phone:user.telefono,documentType:'cedula',document:user.cedula,delivery:'pickup',province:'',city:'',address:'',postalCode:''},claveSolicitud:randomUUID()}});
  expect(ordered.status()).toBe(201);const order=(await ordered.json()).data;
  const drafted=await api.post('/api/admin/facturacion/facturas',{headers,data:{...fixture.buyer,pedidoId:order.id,razonSocialComprador:user.nombre,correoComprador:user.email}});
  expect(drafted.status()).toBe(201);const invoice=(await drafted.json()).data;
  expect(invoice.estado).toBe('BORRADOR');expect(invoice.xmlDisponible).toBe(false);

  await withToken(page,token);await page.goto('/admin.html?tabla=facturacion');
  const button=page.locator('[data-invoice-ride="'+invoice.id+'"]');await expect(button).toBeVisible();
  const endpoint=API+'/api/admin/facturacion/facturas/'+invoice.id+'/ride';
  const [download,response]=await Promise.all([
    page.waitForEvent('download'),
    page.waitForResponse(response=>response.url()===endpoint && response.request().method()==='GET'),
    button.click(),
  ]);
  expect(response.status()).toBe(200);
  const responseHeaders=await response.allHeaders();
  expect(responseHeaders['access-control-allow-origin']).toBe(STATIC);
  expect(responseHeaders['access-control-allow-credentials']).toBeUndefined();
  expect(responseHeaders['cache-control']).toBe('no-store');
  expect(responseHeaders['content-type']).toContain('text/html');
  expect(responseHeaders['content-security-policy']).toContain("default-src 'none'");
  expect(response.request().headers().authorization).toBe('Bearer '+token);
  expect(download.url()).toMatch(/^blob:http:\/\/127\.0\.0\.1:3301\//);
  expect(download.suggestedFilename()).toBe('factura-'+invoice.id+'.html');
  const stream=await download.createReadStream(),chunks=[];
  for await(const chunk of stream)chunks.push(chunk);
  const html=Buffer.concat(chunks).toString('utf8');
  expect(html).toContain('SIN VALIDEZ TRIBUTARIA');expect(html).toContain('BORRADOR');expect(html).toContain('PRUEBAS');expect(html).toContain(product.nombre);
  const invoices=(await (await api.get('/api/admin/facturacion/facturas',{headers})).json()).data.items;
  const saved=invoices.find(item=>item.id===invoice.id);
  expect(saved.estado).toBe('BORRADOR');expect(saved.numeroAutorizacion).toBeNull();expect(saved.xmlDisponible).toBe(false);
});

test('Pages publica pagos y ejecuta los tres resultados de demostración con configuración y mascota entre orígenes',async({page})=>{
  const apiRequests=[],writes=[];
  page.on('request',request=>{
    const url=new URL(request.url());if(!url.pathname.startsWith('/api/'))return;
    apiRequests.push({origin:url.origin,path:url.pathname,method:request.method()});
    if(!['GET','HEAD','OPTIONS'].includes(request.method()))writes.push(request.method()+' '+url.pathname);
  });
  const configured=page.waitForResponse(API+'/api/pagos/configuracion',{timeout:10000});
  const document=await page.goto('/pagos.html');expect(document.status()).toBe(200);
  await expect(page.locator('body')).toHaveAttribute('data-page','payments');
  await expect(page.locator('#payment-total')).toContainText(/18[,.]50/);
  const response=await configured;expect(response.status()).toBe(200);
  expect(response.headers()['access-control-allow-origin']).toBe(STATIC);
  expect((await response.json()).data.payphone.disponible).toBe(false);
  await expect(page.locator('input[name="method"][value="card"]')).toBeDisabled();
  for(const [outcome,heading]of [['aprobado',/aprobad/i],['rechazado',/rechazad/i],['cancelado',/cancelad/i]]){
    await page.locator('#payment-demo-result').selectOption(outcome);
    await page.locator('#payment-submit').focus();await page.keyboard.press('Enter');
    await expect(page.locator('#payment-result')).toBeVisible();
    await expect(page.locator('#payment-result-title')).toContainText(heading);
    await expect(page.locator('#payment-result-title')).toBeFocused();
    await page.locator('#payment-reset').focus();await page.keyboard.press('Enter');
    await expect(page.locator('#payment-result')).toBeHidden();await expect(page.locator('#payment-submit')).toBeEnabled();
  }
  await page.waitForFunction(()=>globalThis.FarmaciaMascota?.getStatus().availableStates.length>0);
  await page.locator('farmacia-mascota #launcher').click();
  const atlas=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/sprites/farmi.png') && response.status()===200,{timeout:10000});
  await page.locator('farmacia-mascota #character').selectOption('farmi');await atlas;
  await expect.poll(()=>page.evaluate(()=>FarmaciaMascota.getStatus().character)).toBe('farmi');
  await expect.poll(()=>page.locator('farmacia-mascota #canvas').evaluate(canvas=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((value,index)=>index%4===3 && value>0))).toBe(true);
  expect(apiRequests.length).toBeGreaterThan(0);expect(apiRequests.every(request=>request.origin===API)).toBe(true);expect(writes).toEqual([]);
});
