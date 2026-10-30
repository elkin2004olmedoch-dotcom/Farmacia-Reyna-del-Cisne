const {test,expect}=require('@playwright/test');

test('un error inicial del dashboard conserva el reintento por teclado',async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem('farmacia-mvc-token','synthetic-admin-ui'));
  await page.route('**/api/auth/me',route=>route.fulfill({json:{data:{id:'synthetic-admin',nombre:'Administrador de prueba',email:'admin@example.ec',role:'admin',activo:true}}}));
  let requests=0;
  await page.route('**/api/admin/resumen',route=>{requests++;return route.fulfill({status:503,json:{error:{message:'Resumen temporalmente no disponible.'}}});});
  await page.goto('/admin.html');
  const retry=page.locator('#admin-retry-summary');
  await expect(retry).toBeVisible();await retry.focus();
  await expect(retry).toBeFocused();await page.keyboard.press('Enter');
  await expect.poll(()=>requests).toBe(2);
  await expect(page.locator('#contenido')).toHaveJSProperty('inert',false);
});

for(const screen of [{path:'checkout.html',module:'checkout',control:'#checkout-next'},{path:'cuenta.html',module:'account',control:'#login-form [type=submit]'}])test(`los controles de ${screen.path} esperan su controlador antes de recibir interacción`,async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('farmacia-mvc-carrito',JSON.stringify({solar:1})));
  let release;const gate=new Promise(resolve=>release=resolve);
  await page.route(`**/controllers/${screen.module}.js`,async route=>{await gate;await route.continue();});
  try{
    await page.goto('/'+screen.path,{waitUntil:'domcontentloaded'});
    await expect(page.locator('#contenido')).toHaveJSProperty('inert',true);
    await expect(page.locator(screen.control)).toBeDisabled();
    await page.locator(screen.control).focus();
    await expect(page.locator(screen.control)).not.toBeFocused();
  }finally{release();}
  await expect(page.locator('#contenido')).toHaveJSProperty('inert',false);
  if(screen.module==='checkout'){
    await expect(page.locator('#checkout-items article')).toHaveCount(1);
    await page.locator(screen.control).focus();await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/cuenta.html\?next=checkout.html/);
  }else{
    await page.locator('#login-email').fill('correo-invalido');
    await page.locator(screen.control).click();
    await expect(page.locator('#login-email')).toHaveAttribute('aria-invalid','true');
    expect(new URL(page.url()).search).toBe('');
  }
});

test('la portada descarga solo los módulos necesarios para comprar y orientar al cliente',async({page})=>{
  const modules=[];
  page.on('request',request=>{const path=new URL(request.url()).pathname;if(/\/(controllers|models|views)\/[^/]+\.m?js$/.test(path))modules.push(path);});
  await page.goto('/');
  await expect(page.locator('#featured-products article')).toHaveCount(4);
  await expect(page.locator('farmacia-mascota #launcher')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(modules.filter(path=>/\/(?:admin(?:-companion|-command|-dashboard)?|billing|payments|deliveries|delivery-checkout|checkout|account|orders)\.m?js$/.test(path))).toEqual([]);
  await page.locator('farmacia-mascota #launcher').click();
  await expect(page.locator('farmacia-mascota #panel')).toBeVisible();
});

test('la portada limita productos y el catálogo conserva todos los resultados',async({page})=>{
  const queries=[];
  page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/productos')queries.push(url.searchParams.get('pageSize'));});
  await page.goto('/');
  await expect(page.locator('#featured-products article')).toHaveCount(4);
  expect(queries).toEqual(['4']);
  const response=await page.request.get('/api/productos?pageSize=100');
  const catalog=(await response.json()).data;
  expect(catalog.total).toBeGreaterThan(4);
  await page.goto('/catalogo.html');
  await expect(page.locator('#catalog-grid article')).toHaveCount(catalog.total);
});

test('cada mascota descarga su atlas cuando se selecciona y conserva sus animaciones',async({page})=>{
  const atlases=[],portraits=[];
  page.on('request',request=>{const url=new URL(request.url());if(/\/sprites\/[^/]+\.png$/.test(url.pathname))atlases.push(url.pathname.split('/').pop());if(/\/art\/[^/]+-base\.png$/.test(url.pathname))portraits.push(url.pathname);});
  await page.goto('/');
  await page.waitForFunction(()=>globalThis.FarmaciaMascota?.getStatus().availableStates.length>0);
  await page.waitForLoadState('networkidle');
  expect(atlases).toEqual(['goti.png']);
  const selectedAtlas=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/sprites/farmi.png') && response.status()===200);
  await page.evaluate(()=>FarmaciaMascota.setCharacter('farmi'));
  await selectedAtlas;
  await page.waitForLoadState('networkidle');
  expect(atlases).toEqual(['goti.png','farmi.png']);
  expect(portraits).toEqual([]);
  expect(await page.evaluate(()=>FarmaciaMascota.getStatus().availableStates.length)).toBeGreaterThan(0);
});

for(const unavailable of ['manifest.json','goti.png'])test(`la mascota conserva imagen y ayuda cuando falla ${unavailable}`,async({page})=>{
  await page.route(`**/sprites/${unavailable}*`,route=>route.fulfill({status:503,body:''}));
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.locator('farmacia-mascota #canvas').evaluate(canvas=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((value,index)=>index%4===3 && value>0))).toBe(true);
  await page.locator('farmacia-mascota #launcher').click();
  await expect(page.locator('farmacia-mascota #panel')).toBeVisible();
});

test('un atlas lento permite mostrar la mascota de respaldo y después recuperar la animación',async({page})=>{
  let release;const gate=new Promise(resolve=>release=resolve);
  await page.route('**/sprites/goti.png?*',async route=>{await gate;await route.continue();});
  const portrait=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/art/goti-base.png') && response.status()===200);
  const atlas=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/sprites/goti.png') && response.status()===200);
  try{
    await page.goto('/',{waitUntil:'domcontentloaded'});
    await portrait;
    await expect.poll(()=>page.locator('farmacia-mascota #canvas').evaluate(canvas=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((value,index)=>index%4===3 && value>0))).toBe(true);
    await page.locator('farmacia-mascota #launcher').click();
    await expect(page.locator('farmacia-mascota #panel')).toBeVisible();
  }finally{release();await atlas;}
  expect(await page.evaluate(()=>FarmaciaMascota.getStatus().availableStates.length)).toBe(9);
});

test('la fachada utiliza WebP con las dimensiones originales',async({page})=>{
  await page.goto('/');
  const image=page.locator('.business-photo img');
  await expect(image).toHaveAttribute('src','assets/images/farmacia-fachada-reina.webp');
  await expect.poll(()=>image.evaluate(img=>img.complete && img.naturalWidth)).toBe(1672);
  expect(await image.evaluate(img=>img.naturalHeight)).toBe(941);
});

test('la portada muestra productos mientras resuelve una sesión admin y mantiene la compra oculta',async({page},testInfo)=>{
  const login=await page.request.post('/api/auth/login',{data:{email:'admin-browser@example.ec',password:'AdminBrowser2026!'}});
  expect(login.status()).toBe(200);
  const {token}=(await login.json()).data;
  await page.addInitScript(token=>sessionStorage.setItem('farmacia-mvc-token',token),token);
  let release;const gate=new Promise(resolve=>release=resolve);
  await page.route('**/api/auth/me',async route=>{await gate;await route.continue();});
  const restored=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/auth/me');
  try{
    await page.goto('/',{waitUntil:'domcontentloaded'});
    await expect(page.locator('#featured-products article')).toHaveCount(4,{timeout:1500});
    await expect(page.locator('[data-customer-only]:visible')).toHaveCount(0);
    if(testInfo.project.name==='movil'){await page.locator('#menu-button').click();await expect(page.locator('#mobile-nav')).toBeVisible();}
  }finally{release();await restored;}
  await expect(page.locator('[data-account-link]')).toHaveText('Panel');
  await expect(page.locator('[data-customer-only]:visible')).toHaveCount(0);
  await expect(page.locator('farmacia-mascota')).toHaveCount(0);
});

test('una restauración 503 mantiene productos visibles y no trata el token como invitado',async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem('farmacia-mvc-token','synthetic-pending-session'));
  await page.route('**/api/auth/me',route=>route.fulfill({status:503,json:{ok:false,error:{message:'Sesión temporalmente no disponible.'}}}));
  await page.goto('/');
  await expect(page.locator('#featured-products article')).toHaveCount(4);
  await expect(page.locator('#page-status')).toContainText('Sesión temporalmente');
  await expect(page.locator('[data-customer-only]:visible')).toHaveCount(0);
  expect(await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'))).toBe('synthetic-pending-session');
});

test('las promociones pendientes no frenan el refresco del stock público',async({page})=>{
  let release;const gate=new Promise(resolve=>release=resolve);let productRequests=0;
  await page.route('**/api/promociones',async route=>{await gate;await route.continue();});
  await page.route('**/api/productos?*',async route=>{const response=await route.fetch();const payload=await response.json();if(++productRequests>1)payload.data.items[0].stock=73;await route.fulfill({response,json:payload});});
  const campaigns=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/promociones');
  try{
    await page.goto('/',{waitUntil:'domcontentloaded'});
    await expect(page.locator('#featured-products article')).toHaveCount(4);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await expect(page.locator('#featured-products .product-stock').first()).toHaveText('73 unidades disponibles',{timeout:1500});
  }finally{release();await campaigns;}
});
