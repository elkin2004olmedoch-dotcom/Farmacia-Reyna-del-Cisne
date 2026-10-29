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
async function capture(page,testInfo,name){
  await expect.poll(()=>page.locator('farmacia-mascota #canvas').evaluate(canvas=>{
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    return pixels.some((value,index)=>index%4===3 && value>0);
  })).toBe(true);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'docs/pruebas/pagos-2026-10-29/'+name+'-'+testInfo.project.name+'.png',fullPage:true});
}

test('la demostración de pagos abre sin sesión y conserva un importe ficticio claro',async({page},testInfo)=>{
  await page.goto('/pagos.html');
  await expect(page.locator('body')).toHaveAttribute('data-page','payments');
  await expect(page.getByRole('heading',{level:1})).toHaveText(/Un pago claro\.\s*A tu manera\./);
  await expect(page.locator('main')).toContainText(/demostraci[oó]n/i);
  await expect(page.locator('main')).toContainText(/18[,.]50/);
  await expect(page.locator('#payment-submit')).toBeEnabled();
  await assertNoCardFields(page);
  const config=await page.request.get('/api/pagos/configuracion');
  expect(config.status()).toBe(200);
  expect((await config.json()).data.payphone.disponible).toBe(false);
  await capture(page,testInfo,'demostracion');
});

for(const [outcome,heading]of [['aprobado',/aprobad/i],['rechazado',/rechazad/i],['cancelado',/cancelad/i]]){
  test('la demostración '+outcome+' anuncia el resultado y permite volver a intentar sin escribir en el negocio',async({page},testInfo)=>{
    const writes=observeBusinessWrites(page);
    await page.goto('/pagos.html');
    await page.locator('#payment-demo-result').selectOption(outcome);
    await page.locator('#payment-submit').focus();await page.keyboard.press('Enter');
    const result=page.locator('#payment-result');
    await expect(result).toBeVisible();await expect(result).toHaveAttribute('role','status');
    await expect(result.getByRole('heading')).toContainText(heading);
    await expect(result.getByRole('heading')).toBeFocused();
    await expect(result).toContainText(/demostraci[oó]n|simulad|prueba/i);
    expect(writes).toEqual([]);
    if(outcome==='aprobado')await capture(page,testInfo,'aprobacion-demostracion');
    await page.locator('#payment-reset').focus();await page.keyboard.press('Enter');
    await expect(result).toBeHidden();await expect(page.locator('#payment-submit')).toBeEnabled();
    expect(writes).toEqual([]);await assertNoCardFields(page);
  });
}

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
  await expect(page.locator('farmacia-mascota #messages .message.bot').last()).toContainText('En Pagos puedes probar una demostración sin cobros.');
  await expect(page.locator('farmacia-mascota #messages .message.bot').last().getByRole('link',{name:'Explorar pagos de prueba'})).toHaveAttribute('href','pagos.html');
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

test('un pedido real muestra el total del servidor y mantiene PayPhone pendiente sin alterar pedido ni stock',async({page,request},testInfo)=>{
  const data=await orderFixture(request);
  try{
    await useSession(page,data.user);const writes=observeBusinessWrites(page);
    await page.goto('/pagos.html?pedido='+data.order.id);
    await expect(page.locator('#payment-total')).toContainText(/25[,.]50/);
    await expect(page.locator('main')).toContainText(data.product.nombre);
    await expect(page.locator('input[name="method"][value="card"]')).toBeDisabled();
    await expect(page.locator('main')).toContainText(/pendiente de activaci[oó]n/i);
    await expect(page.locator('input[name="method"][value="manual"]')).toBeChecked();
    await expect(page.locator('#payment-submit')).toBeEnabled();
    await expect(page.locator('#payment-submit')).toContainText(/farmacia/i);
    await assertNoCardFields(page);
    const demo=page.getByRole('link',{name:/demostraci[oó]n/i});
    await expect(demo).toHaveAttribute('href',/^(?:\.\/)?pagos\.html$/);
    const payment=await request.get('/api/pedidos/'+data.order.id+'/pago',{headers:{Authorization:'Bearer '+data.user.token}});
    expect(payment.status()).toBe(200);
    const dto=(await payment.json()).data;
    expect(dto.pedido.totalCentavos).toBe(2550);expect(dto.pedido.estado).toBe('pendiente');expect(dto.pago).toBeNull();
    expect((await (await request.get('/api/productos/'+data.product.id)).json()).data.stock).toBe(5);
    expect(writes).toEqual([]);
    await capture(page,testInfo,'pedido');
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
  const user=await customer(request);await useSession(page,user);
  let release;const gate=new Promise(resolve=>release=resolve);
  await page.route('**/api/auth/me',async route=>{await gate;await route.continue();});
  const restored=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/auth/me',{timeout:10000});
  try{
    await page.goto('/pagos.html',{waitUntil:'domcontentloaded'});
    await expect(page.locator('#payment-submit')).toBeDisabled();
  }finally{release();await restored;}
  await expect(page.locator('#payment-submit')).toBeEnabled();
  await page.locator('#payment-submit').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#payment-result')).toBeVisible();
  expect(new URL(page.url()).search).toBe('');
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
