const {test,expect}=require('./browser-fixture.cjs');
const AxeBuilder=require('@axe-core/playwright').default;
const {randomUUID}=require('node:crypto');

async function prepare(page,request,items,{customer=false}={}){
  if(customer){
    const registered=await request.post('/api/auth/register',{data:{nombre:'Cliente Carrito',email:'carrito-'+randomUUID()+'@example.ec',telefono:'0991234567',cedula:'0102030400',password:'CompraCarrito2026!'}});expect(registered.status()).toBe(201);
    const session=(await registered.json()).data;
    const exchanged=await page.request.post('/api/auth/web/exchange',{headers:{Authorization:'Bearer '+session.token,Origin:'http://localhost:3300','X-Farmacia-Web':'1'},data:{}});expect(exchanged.status()).toBe(200);
  }
  await page.addInitScript(items=>{if(!sessionStorage.getItem('purchase-polish-ready')){localStorage.setItem('farmacia-mvc-carrito',JSON.stringify(items));sessionStorage.setItem('purchase-polish-ready','1');}},items);
}
async function capture(page,testInfo,name){await page.bringToFront();await page.evaluate(()=>{document.activeElement?.blur?.();window.scrollTo(0,0);});await page.screenshot({path:testInfo.outputPath(name),fullPage:true});}

test('marca y presentación acompañan la misma compra en lateral, carrito y revisión; editar conserva datos',async({page,request},testInfo)=>{
  await prepare(page,request,{solar:1,'generico-referencia':2},{customer:true});
  const writes=[];page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/pedidos')writes.push(r.url());});
  await page.goto('/catalogo.html');await page.locator('[data-cart-open]').click();const drawer=page.locator('#cart-drawer');await expect(drawer).toBeVisible();
  const solar=drawer.locator('[data-drawer-item=solar]');await expect(solar.locator('.product-purchase-meta')).toContainText('Beiersdorf AG');await expect(solar.locator('.product-purchase-meta')).toContainText('50 ml');
  await expect(drawer.locator('[data-drawer-item=generico-referencia] .product-purchase-meta')).toContainText('4.8 g');await expect(drawer.locator('.cart-drawer-total dd')).toContainText('24,75');
  for(const width of [320,375,768,1440]){
    await page.setViewportSize({width,height:1000});
    const clashes=await drawer.locator('.cart-drawer-item').evaluateAll(items=>items.filter(item=>{const name=item.querySelector('h3').getBoundingClientRect(),total=item.querySelector('.cart-drawer-line-total').getBoundingClientRect();return name.left<total.right&&name.right>total.left&&name.top<total.bottom&&name.bottom>total.top;}).length);expect(clashes).toBe(0);
    const small=await drawer.locator('.quantity-picker button').evaluateAll(buttons=>buttons.filter(button=>{const b=button.getBoundingClientRect();return b.width<44||b.height<44;}).length);expect(small).toBe(0);
  }
  await page.setViewportSize(testInfo.project.use.viewport);await page.screenshot({path:testInfo.outputPath('carrito-lateral.png')});await page.keyboard.press('Escape');await page.goto('/checkout.html');
  await expect(page.locator('#checkout-items .product-purchase-meta')).toHaveCount(2);await expect(page.locator('#checkout-grand-total')).toContainText('24,75');await expect(page.locator('#purchase-login-note')).not.toContainText('Inicia sesión');
  const nextBox=await page.locator('#checkout-next').boundingBox(),noteBox=await page.locator('#purchase-login-note').boundingBox();expect(noteBox.y).toBeGreaterThanOrEqual(nextBox.y+nextBox.height+8);
  await capture(page,testInfo,'carrito-completo.png');
  await page.locator('#checkout-next').focus();await page.keyboard.press('Enter');await expect(page.locator('#checkout-review-items .product-purchase-meta')).toHaveCount(2);await page.locator('#checkout-phone').fill('0987654321');
  await page.locator('#purchase-edit-cart').click();await page.locator('[data-cart-plus=solar]').click();await expect(page.locator('#checkout-grand-total')).toContainText('34,50');await page.locator('#checkout-next').click();await expect(page.locator('#checkout-phone')).toHaveValue('0987654321');
  await expect(page.locator('#checkout-review-items')).toContainText('Cantidad: 2');await expect(page.locator('#checkout-grand-total')).toContainText('34,50');
  for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.setViewportSize(testInfo.project.use.viewport);await capture(page,testInfo,'compra-entrega-pago.png');
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);expect(writes).toEqual([]);
});

test('una foto fallida conserva el producto; quitar el último artículo ofrece volver al catálogo sin resumen vacío',async({page,request},testInfo)=>{
  await prepare(page,request,{'alcohol-antiseptico':1});
  await page.route('**/producto-alcohol-antiseptico-weir.webp',route=>route.fulfill({status:404,body:''}));
  await page.goto('/catalogo.html');await page.locator('[data-cart-open]').click();const drawer=page.locator('#cart-drawer');
  await expect(drawer.locator('img')).toHaveAttribute('src',/producto-sin-imagen\.svg$/);await expect(drawer.locator('.product-purchase-meta')).toContainText('120 ml');await drawer.getByRole('link',{name:'Ir al carrito'}).click();
  await expect(page.locator('.checkout-item-image')).toHaveAttribute('src',/producto-sin-imagen\.svg$/);await expect(page.locator('.checkout-cart-item')).toContainText('Laboratorios Weir');
  await page.locator('[data-cart-remove]').focus();await page.keyboard.press('Enter');await page.locator('#confirm-dialog [value=confirm]').click();
  await expect(page.locator('#checkout-items')).toContainText('Tu carrito está vacío.');await expect(page.locator('#purchase-summary')).toBeHidden();await expect(page.getByRole('link',{name:'Explorar productos',exact:false})).toBeFocused();
  await capture(page,testInfo,'carrito-vacio.png');
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});

test('cancelar vaciado conserva productos y foco; confirmar ofrece explorar desde el carrito vacío',async({page,request})=>{
  await prepare(page,request,{solar:1,'generico-referencia':2});await page.goto('/checkout.html');
  const clear=page.locator('#checkout-clear');await expect(page.locator('#contenido')).not.toHaveAttribute('inert','');await expect(clear).toBeVisible();await clear.focus();await expect(clear).toBeFocused();await page.keyboard.press('Enter');await page.locator('#confirm-dialog [value=cancel]').click();
  await expect(clear).toBeFocused();await expect(page.locator('.checkout-cart-item')).toHaveCount(2);await expect(page.locator('#checkout-grand-total')).toContainText('24,75');
  await page.keyboard.press('Enter');await page.locator('#confirm-dialog [value=confirm]').click();await expect(page.locator('.checkout-cart-item')).toHaveCount(0);await expect(page.locator('#purchase-summary')).toBeHidden();await expect(page.getByRole('link',{name:'Explorar productos',exact:false})).toBeFocused();
});
