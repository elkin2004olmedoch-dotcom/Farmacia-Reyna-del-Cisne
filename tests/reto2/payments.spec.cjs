const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const {randomUUID}=require('node:crypto');

function observeBusinessWrites(page){
  const writes=[];
  page.on('request',request=>{
    const path=new URL(request.url()).pathname;
    if(!['GET','HEAD','OPTIONS'].includes(request.method()) && /^\/api\/(?:pagos|pedidos|productos|inventario)(?:\/|$)/.test(path))writes.push(request.method()+' '+path);
  });
  return writes;
}
async function customer(request){
  const email='pagos-'+randomUUID()+'@example.ec',password='ClientePagos2026!';
  const response=await request.post('/api/auth/register',{data:{nombre:'Cliente Pagos',email,telefono:'0979275988',cedula:'0102030400',password}});
  expect(response.status()).toBe(201);
  return {email,password,...(await response.json()).data};
}
async function orderFixture(request){
  const login=await request.post('/api/auth/login',{data:{email:'admin-browser@example.ec',password:'AdminBrowser2026!'}});
  expect(login.status()).toBe(200);
  const headers={Authorization:'Bearer '+(await login.json()).data.token},user=await customer(request);
  const created=await request.post('/api/productos',{headers,data:{nombre:'Producto pago '+randomUUID().slice(0,8),precio:8.5,stock:8,categoria:'cuidado',descripcion:'Artículo sintético para comprobar pagos sin cobros reales',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase sintético para pagos',tipoProducto:'cuidado',requiereReceta:false,ivaCategoria:'general',descuentoPorcentaje:0}});
  expect(created.status()).toBe(201);
  const product=(await created.json()).data;
  const ordered=await request.post('/api/pedidos',{headers:{Authorization:'Bearer '+user.token},data:{carrito:[{productoId:product.id,cantidad:3}],comprador:{name:'Cliente Pagos',email:user.email,phone:'0979275988',documentType:'cedula',document:'0102030400',delivery:'pickup',province:'',city:'',address:'',postalCode:''},claveSolicitud:randomUUID()}});
  expect(ordered.status()).toBe(201);
  return {user,product,order:(await ordered.json()).data,headers,async cleanup(){await request.delete('/api/productos/'+product.id,{headers});}};
}
async function useSession(page,user){
  await page.goto('/cuenta.html');
  await page.evaluate(token=>sessionStorage.setItem('farmacia-mvc-token',token),user.token);
}
async function assertNoCardFields(page){
  await expect(page.locator('input[autocomplete^="cc-"],input[name*="card" i],input[name*="tarjeta" i],input[name*="cvv" i],input[name*="cvc" i]')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/apple\s*pay/i})).toHaveCount(0);
}
async function contactSpy(page,clipboard=false){
  await page.addInitScript(clipboard=>{
    window.paymentTest={opened:[],copied:[]};
    window.open=url=>{window.paymentTest.opened.push(String(url));return null;};
    if(clipboard)Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.paymentTest.copied.push(text);}}});
  },clipboard);
}
async function assertUnpaidOrder(request,data){
  const payment=await request.get('/api/pedidos/'+data.order.id+'/pago',{headers:{Authorization:'Bearer '+data.user.token}});
  expect(payment.status()).toBe(200);
  const dto=(await payment.json()).data;
  expect(dto.pedido.totalCentavos).toBe(2550);expect(dto.pedido.estado).toBe('pendiente');expect(dto.pago).toBeNull();
  expect((await (await request.get('/api/productos/'+data.product.id)).json()).data.stock).toBe(5);
}

test.describe('transferencia configurada',()=>{
  test.use({serviceWorkers:'block'});
  test('muestra banco, cuenta y titular, copia los datos y conserva el pago pendiente',async({page,request},testInfo)=>{
    const data=await orderFixture(request);
    try{
      await useSession(page,data.user);await contactSpy(page,true);const writes=observeBusinessWrites(page);
      await page.route('**/api/pedidos/'+data.order.id+'/pago',async route=>{const response=await route.fetch(),body=await response.json();await route.fulfill({response,json:{...body,data:{...body.data,transferencia:{disponible:true,banco:'Banco Ejemplo',tipo:'ahorros',numeroCuenta:'0123456789',titular:'Titular Sintético'}}}});});
      await page.goto('/pagos.html?pedido='+data.order.id+'&metodo=transfer');
      await expect(page.locator('#payment-bank-details')).toBeVisible();await expect(page.locator('#payment-bank-name')).toHaveText('Banco Ejemplo');await expect(page.locator('#payment-bank-type')).toHaveText('Ahorros');await expect(page.locator('#payment-bank-number')).toHaveText('0123456789');await expect(page.locator('#payment-bank-holder')).toHaveText('Titular Sintético');
      await page.locator('#payment-transfer-copy').focus();await page.keyboard.press('Enter');await expect(page.locator('#payment-transfer-copy-status')).toHaveText('Datos de transferencia copiados.');
      const copied=await page.evaluate(()=>window.paymentTest.copied);expect(copied).toHaveLength(1);for(const value of ['Banco Ejemplo','ahorros','0123456789','Titular Sintético',data.order.id])expect(copied[0]).toContain(value);
      await expect(page.locator('#payment-submit')).toHaveText('Enviar comprobante a la farmacia ↗');await page.locator('#payment-submit').click();await expect.poll(()=>page.evaluate(()=>window.paymentTest.opened.length)).toBe(1);expect(new URL(await page.evaluate(()=>window.paymentTest.opened[0])).searchParams.get('text')).toContain('comprobante de transferencia');
      await assertUnpaidOrder(request,data);expect(writes).toEqual([]);await assertNoCardFields(page);
      for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
      const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;expect(violations.map(issue=>issue.id)).toEqual([]);
      await page.setViewportSize(testInfo.project.use.viewport);await page.screenshot({path:testInfo.outputPath('transferencia.png'),fullPage:true});
    }finally{await data.cleanup();}
  });
});
async function capture(page,testInfo,name){
  await expect.poll(()=>page.locator('farmacia-mascota #canvas').evaluate(canvas=>{
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    return pixels.some((value,index)=>index%4===3 && value>0);
  })).toBe(true);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'docs/pruebas/pagos-2026-10-29/'+name+'-'+testInfo.project.name+'.png',fullPage:true});
}

test('sin pedido, pagos orienta a Mis pedidos sin inventar importes ni iniciar operaciones',async({page},testInfo)=>{
  const writes=observeBusinessWrites(page),reads=[];
  page.on('request',request=>{if(/^\/api\/(?:pagos|pedidos)(?:\/|$)/.test(new URL(request.url()).pathname))reads.push(request.method()+' '+new URL(request.url()).pathname);});
  await page.goto('/pagos.html');
  await expect(page.locator('body')).toHaveAttribute('data-page','payments');
  await expect(page.getByRole('heading',{level:1})).toHaveText('Elige cómo pagar.');
  await expect(page.getByRole('link',{name:'Ver mis pedidos →',exact:true})).toHaveAttribute('href','pedidos.html');
  await expect(page.locator('#payment-summary')).toContainText('Elige un pedido para consultar su importe');
  await expect(page.locator('#payment-mode')).toHaveText('Mis compras');
  await expect(page.locator('#payment-total,#payment-demo-result,#payment-result,#payment-reset,#payment-demo-panel')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/18[,.]50|demostraci[oó]n|fictici[oa]|prueba de pago/i);
  await expect(page.locator('#payment-form')).toBeHidden();
  await expect(page.locator('#payment-submit')).toBeDisabled();
  await expect(page.locator('input[name="method"][value="card"]')).toBeDisabled();
  await expect(page.locator('label.payment-method').filter({has:page.locator('input[value="card"]')})).toBeHidden();
  await assertNoCardFields(page);
  const config=await page.request.get('/api/pagos/configuracion');
  expect(config.status()).toBe(200);
  expect((await config.json()).data.payphone.disponible).toBe(false);
  await capture(page,testInfo,'sin-pedido');
  expect(reads).toEqual([]);expect(writes).toEqual([]);
});

test('la página mantiene teclado, contraste, mascota animada y ancho móvil sin el control flotante de WhatsApp',async({page})=>{
  const errors=[],viewport=page.viewportSize();page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/pagos.html');
  await page.keyboard.press('Tab');await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');await expect(page.locator('#contenido')).toBeFocused();
  await expect(page.locator('.floating-whatsapp,.whatsapp-float,.whatsapp-floating,[data-whatsapp-float]')).toHaveCount(0);
  await page.waitForFunction(()=>globalThis.FarmaciaMascota?.getStatus().availableStates.length>0);
  const launcher=page.locator('farmacia-mascota #launcher');await expect(launcher).toBeVisible();
  await launcher.focus();await page.keyboard.press('Enter');await expect(page.locator('farmacia-mascota #panel')).toBeVisible();
  await page.locator('farmacia-mascota #character').selectOption('farmi');
  await expect.poll(()=>page.evaluate(()=>FarmaciaMascota.getStatus().character)).toBe('farmi');
  await expect.poll(()=>page.locator('farmacia-mascota #canvas').evaluate(canvas=>{
    const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    return data.some((value,index)=>index%4===3 && value>0);
  })).toBe(true);
  await page.locator('farmacia-mascota #input').fill('¿Cómo puedo pagar?');
  await page.locator('farmacia-mascota #input').press('Enter');
  await expect(page.locator('farmacia-mascota #messages .message.bot').last()).toContainText('Desde Mis pedidos puedes consultar el importe');
  await expect(page.locator('farmacia-mascota #messages .message.bot').last().getByRole('link',{name:'Pagar mi pedido'})).toHaveAttribute('href','pedidos.html');
  await expect(page.locator('farmacia-mascota #messages .message.bot').last()).not.toContainText(/demostraci[oó]n|pagos de prueba/i);
  await page.locator('farmacia-mascota #close').click();await expect(launcher).toBeFocused();
  for(const width of [320,375,768,1440]){
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Pagos sin desbordamiento a '+width).toBe(false);
  }
  await page.setViewportSize(viewport);
  const issues=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;
  expect(issues.map(issue=>({id:issue.id,targets:issue.nodes.map(node=>node.target)}))).toEqual([]);
  expect(errors).toEqual([]);
});

test('un pedido real muestra el total del servidor y permite coordinar el pago sin alterar pedido ni stock',async({page,request},testInfo)=>{
  const data=await orderFixture(request);
  try{
    await useSession(page,data.user);const writes=observeBusinessWrites(page);
    await page.goto('/pagos.html?pedido='+data.order.id);
    await expect(page.locator('#payment-total')).toContainText(/25[,.]50/);
    await expect(page.locator('main')).toContainText(data.product.nombre);
    await expect(page.locator('input[name="method"][value="card"]')).toBeEnabled();
    await expect(page.locator('label.payment-method').filter({has:page.locator('input[value="card"]')})).toBeVisible();
    await expect(page.locator('input[name="method"][value="transfer"]')).toBeEnabled();
    await expect(page.locator('#payment-persisted-state')).toHaveText('Pago por coordinar con la farmacia.');
    await expect(page.locator('input[name="method"][value="manual"]')).toBeChecked();
    await expect(page.locator('#payment-submit')).toBeEnabled();
    await expect(page.locator('#payment-submit')).toContainText(/farmacia/i);
    await assertNoCardFields(page);
    await expect(page.locator('main').getByRole('link',{name:/demostraci[oó]n|pagos de prueba/i})).toHaveCount(0);
    await expect(page.locator('#payment-demo-result,#payment-result,#payment-reset')).toHaveCount(0);
    await assertUnpaidOrder(request,data);
    expect(writes).toEqual([]);
    await capture(page,testInfo,'pedido');
  }finally{await data.cleanup();}
});

test('tarjeta sin pasarela solicita un enlace seguro del pedido sin crear pagos ni recoger tarjetas',async({page,request})=>{
  const data=await orderFixture(request);
  try{
    await useSession(page,data.user);await contactSpy(page);const writes=observeBusinessWrites(page);
    await page.goto('/pagos.html?pedido='+data.order.id+'&metodo=card');
    await expect(page.locator('#payment-total')).toContainText(/25[,.]50/);
    await expect(page.locator('input[value="card"]')).toBeChecked();
    await expect(page.locator('#payment-submit')).toHaveText('Solicitar enlace seguro ↗');
    await expect(page.locator('#payment-method-note')).toContainText('no realiza un cobro');
    await expect(page.locator('#payment-method-note')).toContainText('verificación del pago queda pendiente');
    await assertNoCardFields(page);await page.locator('#payment-submit').click();
    await expect.poll(()=>page.evaluate(()=>window.paymentTest.opened.length)).toBe(1);
    const url=new URL(await page.evaluate(()=>window.paymentTest.opened[0]));
    expect(url.origin).toBe('https://api.whatsapp.com');expect(url.pathname).toBe('/send');
    expect(url.searchParams.get('text')).toContain('enlace seguro');expect(url.searchParams.get('text')).toContain(data.order.id);expect(url.searchParams.get('text')).toMatch(/25[,.]50/);
    expect(url.searchParams.get('text')).not.toContain(data.user.email);expect(url.searchParams.get('text')).not.toContain('0979275988');
    await expect(page.locator('#payment-persisted-state')).toHaveText('Pago por coordinar con la farmacia.');
    await assertUnpaidOrder(request,data);expect(writes).toEqual([]);
    for(const query of ['&metodo=no-permitido','&metodo=card&metodo=transfer']){
      await page.goto('/pagos.html?pedido='+data.order.id+query);
      await expect(page.locator('#payment-total')).toContainText(/25[,.]50/);
      await expect(page.locator('input[value="manual"]')).toBeChecked();
    }
    expect(writes).toEqual([]);
  }finally{await data.cleanup();}
});

test('transferencia copia sólo importe y referencia y solicita datos bancarios sin acreditar un pago',async({page,request})=>{
  const data=await orderFixture(request);
  try{
    await useSession(page,data.user);await contactSpy(page,true);const writes=observeBusinessWrites(page);
    await page.goto('/pagos.html?pedido='+data.order.id+'&metodo=transfer');
    await expect(page.locator('input[value="transfer"]')).toBeChecked();
    await expect(page.locator('#payment-transfer-panel')).toBeVisible();
    await expect(page.locator('#payment-transfer-amount')).toContainText(/25[,.]50/);
    await expect(page.locator('#payment-transfer-reference')).toHaveText(data.order.id);
    await expect(page.locator('#payment-transfer-panel input')).toHaveCount(0);
    await expect(page.locator('#payment-transfer-panel')).toContainText('Solicita los datos bancarios a la farmacia');
    await page.locator('#payment-transfer-copy').click();
    await expect(page.locator('#payment-transfer-copy-status')).toHaveText('Importe y referencia copiados.');
    const copied=await page.evaluate(()=>window.paymentTest.copied);
    expect(copied).toEqual([`Pedido: ${data.order.id}\nImporte: ${await page.locator('#payment-transfer-amount').textContent()}`]);
    expect(copied[0]).not.toContain(data.user.email);expect(copied[0]).not.toContain('0979275988');expect(copied[0]).not.toContain(data.product.nombre);
    await expect(page.locator('#payment-submit')).toHaveText('Solicitar datos bancarios ↗');await page.locator('#payment-submit').click();
    await expect.poll(()=>page.evaluate(()=>window.paymentTest.opened.length)).toBe(1);
    const url=new URL(await page.evaluate(()=>window.paymentTest.opened[0]));
    expect(url.origin).toBe('https://api.whatsapp.com');expect(url.searchParams.get('text')).toContain('datos bancarios');expect(url.searchParams.get('text')).toContain(data.order.id);expect(url.searchParams.get('text')).toMatch(/25[,.]50/);
    await expect(page.locator('#payment-persisted-state')).toHaveText('Pago por coordinar con la farmacia.');
    await assertNoCardFields(page);await assertUnpaidOrder(request,data);expect(writes).toEqual([]);
  }finally{await data.cleanup();}
});

test('una solicitud existente con pasarela desactivada impide pedir otro enlace o una transferencia',async({page,request})=>{
  const data=await orderFixture(request);
  try{
    await useSession(page,data.user);await contactSpy(page);const writes=observeBusinessWrites(page);
    await page.route('**/api/pedidos/'+data.order.id+'/pago',async route=>{
      const response=await route.fetch(),body=await response.json();
      await route.fulfill({response,json:{...body,data:{...body.data,payphone:{disponible:false,entorno:null},pago:{estado:'pendiente',proveedor:'payphone',entorno:'production',moneda:'USD',totalCentavos:2550,createdAt:'2026-11-02T12:00:00.000Z',updatedAt:'2026-11-02T12:00:00.000Z',urlPago:null}}}});
    });
    await page.goto('/pagos.html?pedido='+data.order.id+'&metodo=card');
    await expect(page.locator('input[value="card"]')).toBeDisabled();
    await expect(page.locator('input[value="transfer"]')).toBeDisabled();
    await expect(page.locator('#payment-submit')).toBeDisabled();
    await expect(page.locator('#payment-card-note')).toContainText('Ya existe una solicitud de pago');
    await expect(page.locator('#payment-persisted-state')).toContainText('Solicitud pendiente');
    await page.locator('input[value="manual"]').check();await expect(page.locator('#payment-submit')).toBeEnabled();
    expect(await page.evaluate(()=>window.paymentTest.opened)).toEqual([]);expect(writes).toEqual([]);
  }finally{await data.cleanup();}
});

test('iniciar sesión conserva un retorno de pago del mismo origen con su pedido',async({page,request})=>{
  const data=await orderFixture(request);
  try{
    await page.goto('/pagos.html?pedido='+data.order.id);
    await expect(page).toHaveURL(/\/cuenta\.html\?/);
    expect(new URL(page.url()).searchParams.get('next')).toBe('pagos.html?pedido='+data.order.id);
    await page.locator('#login-email').fill(data.user.email);await page.locator('#login-password').fill(data.user.password);
    await page.locator('#login-form [type=submit]').click();
    await expect(page).toHaveURL(new RegExp('/pagos\\.html\\?pedido='+data.order.id+'$'));
    await expect(page.locator('#payment-total')).toContainText(/25[,.]50/);
  }finally{await data.cleanup();}
});

test('otra cuenta no ve el resumen ni inicia un pago de un pedido ajeno',async({page,request})=>{
  const data=await orderFixture(request),other=await customer(request);
  try{
    await useSession(page,other);const writes=observeBusinessWrites(page);
    const denied=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/pedidos/'+data.order.id+'/pago',{timeout:10000});
    await page.goto('/pagos.html?pedido='+data.order.id);expect((await denied).status()).toBe(404);
    await expect(page.locator('#payment-error')).toContainText(/no se encontr[oó]|permiso|acceso|pertenece|autorizad/i);
    await expect(page.locator('main')).not.toContainText(data.product.nombre);
    await expect(page.locator('#payment-submit:visible:not(:disabled)')).toHaveCount(0);expect(writes).toEqual([]);
  }finally{await data.cleanup();}
});

test('un fallo temporal al consultar el pago se recupera al reintentar la carga',async({page,request})=>{
  const data=await orderFixture(request);
  try{
    await useSession(page,data.user);let fail=true;
    await page.route('**/api/pedidos/'+data.order.id+'/pago',route=>fail?route.fulfill({status:503,json:{ok:false,error:{message:'Pagos temporalmente no disponibles.'}}}):route.continue());
    await page.goto('/pagos.html?pedido='+data.order.id);
    await expect(page.locator('#payment-error')).toContainText('Pagos temporalmente no disponibles');
    await expect(page.locator('#payment-submit:visible:not(:disabled)')).toHaveCount(0);
    fail=false;await page.locator('#payment-retry').focus();await page.keyboard.press('Enter');
    await expect(page.locator('#payment-total')).toContainText(/25[,.]50/);
    await expect(page.locator('main')).toContainText(data.product.nombre);
  }finally{await data.cleanup();}
});

test('un enlace de pedido malformado no habilita acciones ni interpreta su contenido como HTML',async({page})=>{
  const writes=observeBusinessWrites(page),reads=[];
  page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/pedidos/'))reads.push(request.url());});
  await page.goto('/pagos.html?pedido='+encodeURIComponent('"><img src=x onerror=window.pagoXss=true>'));
  await expect(page.locator('#payment-error')).toContainText(/mis pedidos/i);
  await expect(page.locator('#payment-submit')).toBeDisabled();
  expect(await page.evaluate(()=>Boolean(window.pagoXss))).toBe(false);
  expect(reads).toEqual([]);expect(writes).toEqual([]);
});

test('la interfaz rechaza un destino PayPhone con dominio engañoso antes de salir de la farmacia',async({page,request})=>{
  const data=await orderFixture(request);
  try{
    await useSession(page,data.user);let dto;
    // La base temporal sigue autorizando y calculando el pedido. Sólo se
    // sustituye el borde del proveedor, que carece de credenciales comerciales.
    await page.route('**/api/pedidos/'+data.order.id+'/pago',async route=>{
      const response=await route.fetch(),body=await response.json();
      dto={...body.data,payphone:{disponible:true,entorno:'sandbox'}};
      await route.fulfill({response,json:{...body,data:dto}});
    });
    await page.route('**/api/pedidos/'+data.order.id+'/pago/payphone',route=>route.fulfill({json:{ok:true,data:{...dto,pago:{estado:'pendiente',proveedor:'payphone',entorno:'sandbox',moneda:'USD',totalCentavos:2550,createdAt:'2026-10-29T12:00:00.000Z',updatedAt:'2026-10-29T12:00:00.000Z',urlPago:'https://pay.payphonetodoesposible.com.attacker.example/PayPhone/Index?paymentId=falso'}}}}));
    await page.route('https://pay.payphonetodoesposible.com.attacker.example/**',route=>route.fulfill({status:200,body:'Destino externo de prueba'}));
    await page.goto('/pagos.html?pedido='+data.order.id);
    await page.locator('input[name="method"][value="card"]').check();
    await page.locator('#payment-submit').click();
    await expect(page.locator('#payment-error')).toContainText(/verificar.*direcci[oó]n|direcci[oó]n.*verific/i);
    expect(new URL(page.url()).origin).toBe('http://localhost:3300');
    expect(new URL(page.url()).searchParams.get('pedido')).toBe(data.order.id);
    const payment=await request.get('/api/pedidos/'+data.order.id+'/pago',{headers:{Authorization:'Bearer '+data.user.token}});
    expect((await payment.json()).data.pago).toBeNull();
  }finally{await data.cleanup();}
});

test('regresión: una sesión pendiente mantiene bloqueado el formulario hasta que el controlador pueda atenderlo',async({page,request})=>{
  const data=await orderFixture(request);await useSession(page,data.user);
  let release;const gate=new Promise(resolve=>release=resolve);
  await page.route('**/api/auth/me',async route=>{await gate;await route.continue();});
  const restored=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/auth/me',{timeout:10000});
  try{
    try{
      await page.goto('/pagos.html?pedido='+data.order.id,{waitUntil:'domcontentloaded'});
      await expect(page.locator('#payment-submit')).toBeDisabled();
    }finally{release();await restored;}
    await expect(page.locator('#payment-total')).toContainText(/25[,.]50/);
    await expect(page.locator('#payment-submit')).toBeEnabled();
    await expect(page.locator('input[name="method"][value="manual"]')).toBeChecked();
    await expect(page.locator('#payment-persisted-state')).toHaveText('Pago por coordinar con la farmacia.');
    expect(new URL(page.url()).searchParams.get('pedido')).toBe(data.order.id);
  }finally{await data.cleanup();}
});

test('regresión: una sesión que vence retira el resumen privado y conserva el retorno al mismo pago',async({page,request})=>{
  const data=await orderFixture(request);
  try{
    await useSession(page,data.user);await page.goto('/pagos.html?pedido='+data.order.id);
    await expect(page.locator('main')).toContainText(data.product.nombre);
    await page.route('**/api/pedidos/mis-pedidos?*',route=>route.fulfill({status:401,json:{ok:false,error:{message:'Tu sesión venció.'}}}));
    await page.evaluate(async()=>{
      const {request}=await import('./models/api.js');
      try{await request('/pedidos/mis-pedidos?page=1&pageSize=1');}catch{}
    });
    await expect(page).toHaveURL(/\/cuenta\.html\?/);
    expect(new URL(page.url()).searchParams.get('next')).toBe('pagos.html?pedido='+data.order.id);
    await expect(page.locator('main')).not.toContainText(data.product.nombre);
    expect(await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'))).toBeNull();
  }finally{await data.cleanup();}
});

test('regresión: un intento que se está creando permite consultar su estado sin preparar otro pago',async({page,request})=>{
  const data=await orderFixture(request);
  try{
    await useSession(page,data.user);const writes=observeBusinessWrites(page);let creating=true;
    await page.route('**/api/pedidos/'+data.order.id+'/pago',async route=>{
      const response=await route.fetch(),body=await response.json();
      await route.fulfill({response,json:{...body,data:{...body.data,payphone:{disponible:true,entorno:'sandbox'},pago:{estado:creating?'creando':'pendiente',proveedor:'payphone',entorno:'sandbox',moneda:'USD',totalCentavos:2550,createdAt:'2026-10-29T12:00:00.000Z',updatedAt:'2026-10-29T12:00:00.000Z',urlPago:creating?null:'https://pay.payphonetodoesposible.com/PayPhone/Index?paymentId=estado-sintetico'}}}});
    });
    await page.goto('/pagos.html?pedido='+data.order.id);
    await expect(page.locator('#payment-persisted-state')).toContainText(/preparando/i);
    await expect(page.locator('input[name="method"][value="card"]')).toBeDisabled();
    await expect(page.locator('#payment-refresh')).toBeVisible();
    creating=false;await page.locator('#payment-refresh').focus();await page.keyboard.press('Enter');
    await expect(page.locator('#payment-persisted-state')).toContainText(/pendiente/i);
    await expect(page.locator('input[name="method"][value="card"]')).toBeEnabled();
    expect(writes).toEqual([]);
  }finally{await data.cleanup();}
});

test('regresión: un intento de producción no se presenta como prueba ni permite continuar al cambiar a sandbox',async({page,request})=>{
  const data=await orderFixture(request);
  try{
    await useSession(page,data.user);
    await page.route('**/api/pedidos/'+data.order.id+'/pago',async route=>{
      const response=await route.fetch(),body=await response.json();
      await route.fulfill({response,json:{...body,data:{...body.data,payphone:{disponible:true,entorno:'sandbox'},pago:{estado:'pendiente',proveedor:'payphone',entorno:'production',moneda:'USD',totalCentavos:2550,createdAt:'2026-10-29T12:00:00.000Z',updatedAt:'2026-10-29T12:00:00.000Z',urlPago:'https://pay.payphonetodoesposible.com/PayPhone/Index?paymentId=produccion-sintetica'}}}});
    });
    await page.goto('/pagos.html?pedido='+data.order.id);
    await expect(page.locator('#payment-total')).toContainText(/25[,.]50/);
    await expect(page.locator('input[name="method"][value="card"]')).toBeDisabled();
    await expect(page.locator('main')).toContainText(/entorno.{0,100}cambi|cambi.{0,100}entorno/i);
    await expect(page.locator('#payment-mode')).not.toContainText(/pruebas|sin cobros/i);
  }finally{await data.cleanup();}
});
