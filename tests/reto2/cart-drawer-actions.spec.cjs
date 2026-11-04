const {test,expect,apiToken}=require('./browser-fixture.cjs');
const AxeBuilder=require('@axe-core/playwright').default;
const path=require('node:path');
const {randomUUID}=require('node:crypto');

async function products(request){
  const response=await request.get('/api/productos?pageSize=100');expect(response.status()).toBe(200);
  return (await response.json()).data.items.filter(p=>p.stock>=10 && !p.requiereReceta && !p.controlado && !p.biologico && !p.cadenaFrio);
}
async function openCart(page,items){
  await page.goto('/catalogo.html');
  await page.evaluate(async items=>{const {cart}=await import('/models/cart.js');cart.write(items);},items);
  await page.locator('[data-cart-open]').click();
  const drawer=page.locator('#cart-drawer');await expect(drawer).toBeVisible();
  await expect(drawer.locator('[data-drawer-plus]').first()).toBeEnabled();return drawer;
}
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('farmacia-mvc-carrito')||'{}'));
async function remove(page,drawer,id){await drawer.locator(`[data-drawer-remove="${id}"]`).click();await expect(page.locator('#confirm-dialog')).toBeVisible();await page.locator('#confirm-dialog [value=confirm]').click();}
async function admin(request){return apiToken(request,'admin-browser@example.ec','AdminBrowser2026!');}
async function updateProduct(request,product,patch){
  const {nombre,precio,stock,categoria,descripcion,imagen,alt}=product,token=await admin(request);
  const response=await request.put('/api/productos/'+product.id,{headers:{Authorization:'Bearer '+token},data:{nombre,precio:Number(precio),stock,categoria,descripcion,imagen,alt,...patch}});expect(response.status(),await response.text()).toBe(200);
}

test('quitar confirma sin mutar al cancelar; conserva foco, contador y persistencia y permite deshacer',async({page,request},info)=>{
  const [a,b]=await products(request),initial={[a.id]:2,[b.id]:1},drawer=await openCart(page,initial),button=drawer.locator(`[data-drawer-remove="${a.id}"]`),confirm=page.locator('#confirm-dialog');
  await button.focus();await page.keyboard.press('Enter');await expect(confirm).toBeVisible();await expect(confirm.locator('p')).toContainText(a.nombre);expect(await stored(page)).toEqual(initial);
  await expect(confirm.locator('[value=cancel]')).toBeFocused();
  expect((await new AxeBuilder({page}).include('#confirm-dialog').analyze()).violations).toEqual([]);
  await page.screenshot({path:path.join(info.outputDir,'drawer-confirmation.png')});
  await page.keyboard.press('Escape');await expect(confirm).toBeHidden();await expect(drawer).toBeVisible();await expect(button).toBeFocused();expect(await stored(page)).toEqual(initial);
  await remove(page,drawer,a.id);await expect(drawer.locator('[data-drawer-item]')).toHaveCount(1);expect(await stored(page)).toEqual({[b.id]:1});await expect(page.locator('[data-shop-count]').first()).toHaveText('1');
  const undo=drawer.getByRole('button',{name:'Deshacer',exact:true});await expect(undo).toHaveCount(1);await expect(undo).toBeFocused();
  expect((await new AxeBuilder({page}).include('#cart-drawer').analyze()).violations).toEqual([]);
  await page.screenshot({path:path.join(info.outputDir,'drawer-undo.png')});
  await undo.click();await expect(drawer.locator(`[data-drawer-item="${a.id}"] .cart-drawer-quantity`)).toHaveText('2');expect(await stored(page)).toEqual(initial);await expect(undo).toBeHidden();await expect(drawer.locator('#cart-drawer-status')).toContainText('Producto recuperado');
  expect(await drawer.evaluate(el=>el.contains(document.activeElement)&&el.matches(':modal'))).toBeTruthy();
  await page.reload();await page.locator('[data-cart-open]').click();await expect(page.locator('#cart-drawer [data-drawer-item]')).toHaveCount(2);expect(await stored(page)).toEqual(initial);
});

test('vaciar cancela sin cambios y confirma una sola vez, sin ofrecer deshacer masivo',async({page,request})=>{
  const [a,b]=await products(request),initial={[a.id]:2,[b.id]:1},drawer=await openCart(page,initial),clear=drawer.getByRole('button',{name:'Vaciar carrito',exact:true});
  await expect(clear).toHaveCount(1);await clear.click();await expect(page.locator('#confirm-dialog')).toBeVisible();await page.locator('#confirm-dialog [value=cancel]').click();await expect(clear).toBeFocused();expect(await stored(page)).toEqual(initial);
  await remove(page,drawer,a.id);await expect(drawer.getByRole('button',{name:'Deshacer',exact:true})).toBeVisible();
  await clear.click();await page.locator('#confirm-dialog [value=confirm]').click();await expect(drawer).toContainText('Tu carrito está vacío.');expect(await stored(page)).toEqual({});await expect(page.locator('[data-shop-count]').first()).toHaveText('0');await expect(clear).toBeHidden();await expect(drawer.getByRole('button',{name:'Deshacer',exact:true})).toBeHidden();
  expect(await drawer.evaluate(el=>el.contains(document.activeElement)&&el.matches(':modal'))).toBeTruthy();
});

test('deshacer acumula cantidades nuevas y consulta stock actual sin sobrescribir',async({page,request})=>{
  const [a]=await products(request),drawer=await openCart(page,{[a.id]:2});await remove(page,drawer,a.id);
  await page.evaluate(async id=>{const {cart}=await import('/models/cart.js');cart.update(id,3);},a.id);
  await drawer.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(drawer.locator('.cart-drawer-quantity')).toHaveText('5');expect(await stored(page)).toEqual({[a.id]:5});await expect(page.locator('#cart-drawer')).toHaveCount(1);
});

for(const change of ['stock','retirado','receta','controlado','biologico','cadenaFrio'])test(`deshacer rechaza producto ${change} tras consultar la API`,async({page,request})=>{
  const [a]=await products(request),drawer=await openCart(page,{[a.id]:2});await remove(page,drawer,a.id);
  if(change==='retirado'){const token=await admin(request);expect((await request.delete('/api/productos/'+a.id,{headers:{Authorization:'Bearer '+token}})).status()).toBe(204);}
  else await updateProduct(request,a,change==='stock'?{stock:1}:{[change==='receta'?'requiereReceta':change]:true});
  await drawer.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(drawer.locator('#cart-drawer-status')).toHaveAttribute('role','alert');expect(await stored(page)).toEqual({});await expect(drawer).toBeVisible();
  expect(await drawer.evaluate(el=>el.contains(document.activeElement)&&el.matches(':modal'))).toBeTruthy();
});

for(const limit of ['stock','99'])test(`deshacer respeta el límite acumulado de ${limit} y bloquea acciones simultáneas`,async({page,request})=>{
  const [a,b]=await products(request),drawer=await openCart(page,{[a.id]:2,[b.id]:1});await remove(page,drawer,a.id);
  await updateProduct(request,a,{stock:limit==='stock'?4:150});
  await page.evaluate(async({id,quantity})=>{const {cart}=await import('/models/cart.js');cart.update(id,quantity);},{id:a.id,quantity:limit==='stock'?3:98});
  let release;const pending=new Promise(resolve=>release=resolve);
  await page.route('**/api/productos/'+a.id,async route=>{await pending;await route.continue();});
  const started=page.waitForRequest('**/api/productos/'+a.id);await drawer.getByRole('button',{name:'Deshacer',exact:true}).click();await started;
  await page.evaluate(()=>{document.querySelector('[data-drawer-undo]').click();document.querySelector('[data-drawer-clear]').click();document.querySelector('[data-drawer-remove]').click();});
  await expect(page.locator('#confirm-dialog')).toBeHidden();release();
  await expect(drawer.locator('#cart-drawer-status')).toHaveAttribute('role','alert');expect(await stored(page)).toEqual({[a.id]:limit==='stock'?3:98,[b.id]:1});
});

test('un cambio de sesión durante la confirmación impide quitar y vaciar',async({page,request})=>{
  const [a]=await products(request),drawer=await openCart(page,{[a.id]:2});
  for(const selector of ['[data-drawer-remove]','[data-drawer-clear]']){
    await drawer.locator(selector).click();await expect(page.locator('#confirm-dialog')).toBeVisible();
    await page.evaluate(async()=>{const {auth}=await import('/models/auth.js');auth.clear();});
    await page.locator('#confirm-dialog [value=confirm]').click();expect(await stored(page)).toEqual({[a.id]:2});await expect(drawer.getByRole('button',{name:'Deshacer',exact:true})).toBeHidden();
  }
});

test('vaciar desde otro control invalida deshacer del drawer',async({page,request})=>{
  const [a,b]=await products(request),drawer=await openCart(page,{[a.id]:2,[b.id]:1});await remove(page,drawer,a.id);
  await expect(drawer.getByRole('button',{name:'Deshacer',exact:true})).toBeVisible();
  await page.evaluate(async()=>{const {cart}=await import('/models/cart.js');cart.clear();});
  await expect(drawer.getByRole('button',{name:'Deshacer',exact:true})).toBeHidden();expect(await stored(page)).toEqual({});
});

test('otra eliminación sustituye deshacer y cerrar sesión lo invalida incluso con consulta pendiente',async({page,request})=>{
  const registered=await request.post('/api/auth/register',{data:{nombre:'Cliente Carrito',email:'drawer-'+randomUUID()+'@example.ec',telefono:'0990000000',cedula:'0102030400',password:'CarritoCliente2026!'}});expect(registered.status()).toBe(201);const session=(await registered.json()).data;
  await page.addInitScript(token=>sessionStorage.setItem('farmacia-mvc-token',token),session.token);
  const [a,b]=await products(request),drawer=await openCart(page,{[a.id]:2,[b.id]:1});await remove(page,drawer,a.id);await remove(page,drawer,b.id);
  await drawer.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(drawer.locator(`[data-drawer-item="${b.id}"]`)).toBeVisible();expect(await stored(page)).toEqual({[b.id]:1});
  await remove(page,drawer,b.id);let release;const waiting=new Promise(resolve=>release=resolve);
  await page.route('**/api/productos/'+b.id,async route=>{await waiting;await route.continue();});
  const started=page.waitForRequest('**/api/productos/'+b.id);await drawer.getByRole('button',{name:'Deshacer',exact:true}).click();await started;
  await page.evaluate(async()=>{const {auth}=await import('/models/auth.js');await auth.logout();});release();
  await expect(drawer.getByRole('button',{name:'Deshacer',exact:true})).toBeHidden();await expect(drawer.locator('[aria-busy=true]')).toHaveCount(0);expect(await stored(page)).toEqual({});
});
