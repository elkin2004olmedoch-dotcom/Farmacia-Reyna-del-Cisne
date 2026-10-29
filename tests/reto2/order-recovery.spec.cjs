const {test,expect}=require('@playwright/test');
const {randomUUID}=require('node:crypto');

async function customerSession(page){
  const registered=await page.request.post('/api/auth/register',{data:{nombre:'Cliente Recuperación',email:'recuperacion-'+randomUUID()+'@example.ec',telefono:'0979275988',cedula:'0102030400',password:'ClienteRecuperacion2026!'}});
  expect(registered.status()).toBe(201);
  await page.addInitScript(token=>sessionStorage.setItem('farmacia-mvc-token',token),(await registered.json()).data.token);
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
}
function result(page=1){
  return {ok:true,data:{items:[{id:'pedido-recuperacion',createdAt:'2026-10-20T12:00:00Z',estado:'pendiente',entrega:'pickup',documento:'••••••0400',total:10,detalles:[],historial:[]}],total:60,page,pageSize:20}};
}
const matcher='**/api/pedidos/mis-pedidos?*';
const unavailable={status:503,json:{ok:false,error:{message:'Pedidos temporalmente no disponibles.'}}};

test('Mis pedidos recupera una carga inicial fallida al volver a la ventana',async({page})=>{
  await customerSession(page);let fail=true;
  await page.route(matcher,route=>route.fulfill(fail?unavailable:{json:result()}));
  await page.goto('/pedidos.html');await expect(page.locator('#page-status')).toContainText('Pedidos temporalmente no disponibles');await expect(page.locator('#orders-list')).toContainText('No se pudieron cargar');await expect(page.locator('.order-card')).toHaveCount(0);
  fail=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.order-card')).toHaveCount(1);await expect(page.locator('#orders-page-info')).toHaveText('Página 1 · 60 pedidos');await expect(page.locator('#page-status')).toHaveText('Datos actualizados.');
});

test('una página de pedidos fallida se puede reintentar sin saltar resultados',async({page})=>{
  await customerSession(page);let fail=true;const requested=[];
  await page.route(matcher,route=>{const number=Number(new URL(route.request().url()).searchParams.get('page'));requested.push(number);return route.fulfill(number===2 && fail?unavailable:{json:result(number)});});
  await page.goto('/pedidos.html');await expect(page.locator('#orders-page-info')).toHaveText('Página 1 · 60 pedidos');
  await page.locator('#orders-next').click();await expect(page.locator('#page-status')).toContainText('Pedidos temporalmente no disponibles');await expect(page.locator('#orders-page-info')).toHaveText('Página 1 · 60 pedidos');
  fail=false;await page.locator('#orders-next').click();await expect(page.locator('#orders-page-info')).toHaveText('Página 2 · 60 pedidos');expect(requested).toEqual([1,2,2]);
  await page.locator('#orders-prev').click();await expect(page.locator('#orders-page-info')).toHaveText('Página 1 · 60 pedidos');
});

test('el refresco automático espera a que termine el cambio de página',async({page})=>{
  await customerSession(page);const requested=[];let release,started;
  const delayed=new Promise(resolve=>release=resolve),pending=new Promise(resolve=>started=resolve);
  await page.route(matcher,async route=>{const number=Number(new URL(route.request().url()).searchParams.get('page'));requested.push(number);if(number===2){started();await delayed;}await route.fulfill({json:result(number)});});
  await page.goto('/pedidos.html');await expect(page.locator('#orders-page-info')).toHaveText('Página 1 · 60 pedidos');
  try{await page.locator('#orders-next').click();await pending;await page.clock.runFor(5000);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));}
  finally{release();}
  await expect(page.locator('#orders-page-info')).toHaveText('Página 2 · 60 pedidos');expect(requested).toEqual([1,2]);
});

test('un 401 inicial conserva la sesión cerrada sin anunciar un reintento',async({page})=>{
  await customerSession(page);
  await page.route(matcher,route=>route.fulfill({status:401,json:{ok:false,error:{message:'Tu sesión venció.'}}}));
  await page.goto('/pedidos.html');await expect(page.locator('#page-status')).toContainText('Tu sesión venció');
  await expect(page.locator('#orders-list')).toBeEmpty();await expect(page.locator('#orders-next')).toBeDisabled();await expect(page.locator('#orders-prev')).toBeDisabled();
  expect(await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'))).toBeNull();
});
