const {test,expect}=require('./browser-fixture.cjs');
const {randomUUID}=require('node:crypto');
const money=cents=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(cents/100);
async function availableProduct(request){
  const response=await request.get('/api/productos?pageSize=100');expect(response.status()).toBe(200);
  const product=(await response.json()).data.items.find(item=>item.stock>3 && !item.requiereReceta && !item.controlado && !item.biologico && !item.cadenaFrio);
  expect(product).toBeTruthy();return product;
}
async function login(request,email,password){const response=await request.post('/api/auth/login',{data:{email,password}});expect(response.status()).toBe(200);return (await response.json()).data;}

test('añadir abre carrito lateral accesible; cantidades, IVA, quitar y foco usan el carrito real',async({page,request},testInfo)=>{
  const product=await availableProduct(request),requests=[];page.on('request',req=>{if(req.method()==='POST' && new URL(req.url()).pathname==='/api/pedidos')requests.push(req.url());});
  await page.goto('/catalogo.html');const add=page.locator(`[data-add="${product.id}"]`),drawer=page.getByRole('dialog',{name:/Tu carrito/});
  await add.focus();await page.keyboard.press('Enter');await expect(drawer).toBeVisible();await expect(drawer.getByRole('button',{name:'Cerrar carrito'})).toBeFocused();
  const item=drawer.locator(`[data-drawer-item="${product.id}"]`);await expect(item).toBeVisible();await expect(item.locator('img')).toHaveAttribute('alt',product.alt || product.nombre);await expect.poll(()=>item.locator('img').evaluate(img=>img.complete && img.naturalWidth>0)).toBeTruthy();
  const unit=Math.round(Number(product.precio)*100),base=Math.round(unit*100/(100+product.ivaPorcentaje));
  await expect(drawer.locator('.cart-drawer-total dd')).toHaveText(money(unit));await expect(drawer.locator('.cart-drawer-summary dl>div').nth(0).locator('dd')).toHaveText(money(base));await expect(drawer.locator('.cart-drawer-summary dl>div').nth(1).locator('dd')).toHaveText(money(unit-base));
  const plus=item.locator('[data-drawer-plus]');await plus.focus();await page.keyboard.press('Enter');await expect(item.locator('.cart-drawer-quantity')).toHaveText('2');await expect(plus).toBeFocused();await expect(drawer.locator('.cart-drawer-total dd')).toHaveText(money(unit*2));
  await item.locator('[data-drawer-minus]').click();await expect(item.locator('.cart-drawer-quantity')).toHaveText('1');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await page.keyboard.press('Escape');await expect(drawer).toBeHidden();await expect(add).toBeFocused();
  await page.evaluate(async id=>{const {cart}=await import('/models/cart.js');cart.update(id,2);},product.id);await expect(drawer).toBeHidden();
  const open=page.locator('[data-cart-open]');await open.click();await expect(drawer).toBeVisible();await expect(item.locator('.cart-drawer-quantity')).toHaveText('2');
  if(testInfo.project.name==='escritorio'){
    const bounds=await drawer.boundingBox();expect(bounds.x).toBeGreaterThan(0);await page.mouse.click(Math.max(1,bounds.x/2),40);await expect(drawer).toBeHidden();await expect(open).toBeFocused();await open.click();
  }
  await item.locator('[data-drawer-remove]').click();await expect(page.locator('#confirm-dialog')).toBeVisible();await page.locator('#confirm-dialog [value=confirm]').click();await expect(drawer).toBeVisible();await expect(drawer).toContainText('Tu carrito está vacío.');await expect(drawer.locator('.cart-drawer-footer')).toBeHidden();await expect(page.locator('[data-shop-count]').first()).toHaveText('0');
  await drawer.getByRole('button',{name:'Cerrar carrito'}).click();await expect(open).toBeFocused();expect(requests).toEqual([]);
});

test('la ficha abre el lateral y devuelve foco al botón tras redibujar; un fallo de lectura se muestra',async({page,request})=>{
  const product=await availableProduct(request);await page.goto('/producto.html?id='+encodeURIComponent(product.id));
  await page.locator('#detail-quantity').fill('2');await page.locator('#detail-add-button').click();
  const drawer=page.getByRole('dialog',{name:/Tu carrito/});await expect(drawer).toBeVisible();await expect(drawer.locator('.cart-drawer-quantity')).toHaveText('2');await page.keyboard.press('Escape');await expect(page.locator('#detail-add-button')).toBeFocused();
  await page.route('**/api/productos?*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:{message:'Catálogo temporalmente no disponible.'}})}));
  await page.locator('[data-cart-open]').click();await expect(drawer).toBeVisible();await expect(drawer.locator('#cart-drawer-status')).toHaveAttribute('role','alert');await expect(drawer.locator('#cart-drawer-status')).toContainText('temporalmente no disponible');
  await drawer.getByRole('link',{name:'Ir al carrito'}).click();await expect(page).toHaveURL(/checkout.html$/);
});

test('menú de cuenta muestra perfil y pedidos y cierra una sesión real de cliente',async({page,request})=>{
  const email='menu-'+randomUUID().slice(0,8)+'@example.ec',password='MenuCliente2026!';
  const registered=await request.post('/api/auth/register',{data:{nombre:'Cliente Menú',email,telefono:'0990000000',cedula:'0102030400',password}});expect(registered.status()).toBe(201);const session=(await registered.json()).data;
  await page.addInitScript(token=>sessionStorage.setItem('farmacia-mvc-token',token),session.token);await page.goto('/catalogo.html');await expect(page.locator('body')).toHaveAttribute('data-session-role','user');
  const toggle=page.locator('#account-menu-toggle'),menu=page.locator('#account-menu');await expect(menu).toBeHidden();await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');await expect(menu).toContainText('Cliente Menú');await expect(menu.getByRole('link',{name:'Mi cuenta',exact:true})).toHaveAttribute('href','cuenta.html');await expect(menu.getByRole('link',{name:'Mis pedidos',exact:true})).toHaveAttribute('href','pedidos.html');
  await page.keyboard.press('Escape');await expect(menu).toBeHidden();await expect(toggle).toBeFocused();await toggle.click();await page.locator('#catalog-search').click();await expect(menu).toBeHidden();
  await toggle.click();const logout=page.waitForResponse(response=>response.request().method()==='POST' && new URL(response.url()).pathname==='/api/auth/logout');await menu.getByRole('button',{name:'Cerrar sesión'}).click();expect((await logout).status()).toBe(204);await expect(page).toHaveURL(/cuenta.html$/);
  const restored=await request.get('/api/auth/me',{headers:{Authorization:'Bearer '+session.token}});expect(restored.status()).toBe(401);
});

test('un cambio de sesión a administración o reparto no abre controles de compra',async({page,request})=>{
  const product=await availableProduct(request),admin=await login(request,'admin-browser@example.ec','AdminBrowser2026!');
  const email='reparto-menu-'+randomUUID().slice(0,8)+'@example.ec',password='RepartoMenu2026!';
  const created=await request.post('/api/admin/repartidores',{headers:{Authorization:'Bearer '+admin.token},data:{nombre:'Repartidor Menú',email,telefono:'0990000000',password}});expect(created.status()).toBe(201);const courier=await login(request,email,password);
  await page.goto('/catalogo.html');await expect(page.locator('#catalog-grid article').first()).toBeVisible();
  for(const session of [admin,courier]){
    await page.evaluate(async({session,product})=>{const {auth}=await import('/models/auth.js');const {cart}=await import('/models/cart.js');auth.save(session);cart.add(product);},{session,product});
    await expect(page.locator('body')).toHaveAttribute('data-session-role',session.usuario.role);await expect(page.locator('#cart-drawer')).toBeHidden();await expect(page.locator('#account-menu-toggle')).toBeHidden();await expect(page.locator('#account-menu')).toBeHidden();
  }
});
