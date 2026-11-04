const {test,expect}=require('./browser-fixture.cjs');
const headerButtons='#menu-button,#search-toggle,[data-cart-open],#account-menu-toggle';

test('cabecera sin JavaScript conserva enlaces y no ofrece botones sin controlador',async({browser,page})=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:page.viewportSize()});
  try{const plain=await context.newPage();for(const path of ['/catalogo.html','/admin.html']){
    await plain.goto('http://localhost:3300'+path);
    await expect(plain.locator(headerButtons)).toHaveCount(path==='/admin.html'?1:4);
    for(const button of await plain.locator(headerButtons).all())await expect(button).toBeDisabled();
    await expect(plain.locator('header .ref-brand,header .admin-store-link[href="index.html"]')).toBeVisible();
  }}finally{await context.close();}
});

test('sesión lenta mantiene controles pendientes y después permite carrito, cuenta y navegación móvil',async({page},info)=>{
  let release,entered;const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve);
  await page.route('**/api/auth/me',async route=>{entered();await gate;await route.continue();});
  try{
    await page.goto('/catalogo.html');await started;
    await expect(page.locator(headerButtons)).toHaveCount(4);
    for(const button of await page.locator(headerButtons).all())await expect(button).toBeDisabled();
    await expect(page.locator('.ref-brand')).toBeVisible();await expect(page.locator('#cart-drawer')).toHaveCount(0);
    release();await expect(page.locator('#screen-controls')).toBeEnabled();
    for(const button of await page.locator(headerButtons).all())await expect(button).toBeEnabled();
    const cart=page.locator('[data-cart-open]');await cart.focus();await page.keyboard.press('Enter');await expect(page.locator('#cart-drawer')).toBeVisible();
    await page.keyboard.press('Escape');await expect(page.locator('#cart-drawer')).toBeHidden();await expect(cart).toBeFocused();
    await page.locator('#account-menu-toggle').click();await expect(page.locator('#account-menu')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#account-menu')).toBeHidden();
    if(await page.locator('#menu-button').isVisible()){
      await page.locator('#menu-button').click();await expect(page.locator('#mobile-nav')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#mobile-nav')).toBeHidden();
      await page.locator('#search-toggle').click();await expect(page.locator('#global-search')).toBeFocused();await page.keyboard.press('Escape');
    }
    await page.screenshot({path:info.outputPath('cabecera-lista.png')});
  }finally{release();}
});

test('un fallo temporal de sesión permite usar la tienda y conserva el carrito',async({page,request})=>{
  const response=await request.get('/api/productos?pageSize=1');expect(response.status()).toBe(200);const product=(await response.json()).data.items[0],items={[product.id]:1};
  await page.addInitScript(items=>localStorage.setItem('farmacia-mvc-carrito',JSON.stringify(items)),items);
  await page.route('**/api/auth/me',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:{message:'Conexión temporalmente interrumpida.'}})}));
  await page.goto('/catalogo.html');await expect(page.locator('#screen-controls')).toBeEnabled();await page.locator('[data-cart-open]').click();
  await expect(page.locator('#cart-drawer [data-drawer-item="'+product.id+'"]')).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('farmacia-mvc-carrito')))).toEqual(items);
});

test('primera fila priorizada conserva la foto alternativa y permite comprar tras un fallo de imagen',async({page,request},info)=>{
  const response=await request.get('/api/productos?pageSize=1');expect(response.status()).toBe(200);const product=(await response.json()).data.items[0];
  await page.route('**/'+product.imagen,route=>route.fulfill({status:404,contentType:'text/plain',body:'Imagen no disponible'}));
  await page.goto('/catalogo.html');const images=page.locator('#catalog-grid .pharmacy-product-card img');await expect(images.first()).toBeVisible();
  for(let index=0;index<4;index++)await expect(images.nth(index)).toHaveAttribute('loading',index<3?'eager':'lazy');
  await expect(images.first()).toHaveAttribute('fetchpriority','high');await expect(page.locator('#catalog-grid img[fetchpriority="high"]')).toHaveCount(1);
  await expect(images.first()).toHaveAttribute('src','assets/images/producto-sin-imagen.svg');await expect.poll(()=>images.first().evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
  await page.locator('[data-add="'+product.id+'"]').click();await expect(page.locator('#cart-drawer')).toBeVisible();await expect(page.locator('#cart-drawer [data-drawer-item="'+product.id+'"]')).toBeVisible();
  await page.screenshot({path:info.outputPath('foto-alternativa-y-carrito.png')});
});
