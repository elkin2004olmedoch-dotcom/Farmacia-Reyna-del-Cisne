const {test,expect}=require('@playwright/test');

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
  const atlases=[];
  page.on('request',request=>{const url=new URL(request.url());if(/\/sprites\/[^/]+\.png$/.test(url.pathname))atlases.push(url.pathname.split('/').pop());});
  await page.goto('/');
  await page.waitForFunction(()=>globalThis.FarmaciaMascota?.getStatus().availableStates.length>0);
  await page.waitForLoadState('networkidle');
  expect(atlases).toEqual(['goti.png']);
  const selectedAtlas=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/sprites/farmi.png') && response.status()===200);
  await page.evaluate(()=>FarmaciaMascota.setCharacter('farmi'));
  await selectedAtlas;
  await page.waitForLoadState('networkidle');
  expect(atlases).toEqual(['goti.png','farmi.png']);
  expect(await page.evaluate(()=>FarmaciaMascota.getStatus().availableStates.length)).toBeGreaterThan(0);
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
