const {test,expect}=require('@playwright/test');

async function availableProducts(page){
  const response=await page.request.get('/api/productos?pageSize=100');
  expect(response.ok()).toBeTruthy();
  const {data}=await response.json();
  return data.items.filter(product=>product.stock>1 && !product.requiereReceta && !product.controlado && !product.biologico && !product.cadenaFrio);
}

test('cabecera permite buscar con teclado y navegar por categorías y cobertura',async({page})=>{
  const products=await availableProducts(page);expect(products.length).toBeGreaterThan(0);
  const product=products[0];
  await page.goto('/');
  const search=page.getByRole('search').getByRole('searchbox');
  await search.fill(product.nombre);await search.focus();await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp('catalogo.html\\?q='));
  await expect(page.locator('#catalog-search')).toHaveValue(product.nombre);
  await expect(page.locator('#catalog-grid article').filter({hasText:product.nombre})).toHaveCount(1);
  await expect(page.locator('#catalog-grid article img').first()).toHaveAttribute('width','320');
  await expect(page.locator('#catalog-grid article img').first()).toHaveAttribute('height','320');
  const categories=page.getByRole('navigation',{name:'Categorías de productos'});
  const care=categories.getByRole('link',{name:'Cuidado personal',exact:true});
  await care.focus();await page.keyboard.press('Enter');
  await expect(page.locator('#catalog-category')).toHaveValue('cuidado');
  await page.locator('.shop-coverage').focus();await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/index.html#cobertura$/);
  await expect(page.locator('#cobertura')).toContainText('todo Puerto Quito');
  await expect(page.locator('.shop-actions a[href="pedidos.html"]')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});

test('búsqueda, categoría y orden permanecen en URL al cambiar, recargar y restablecer',async({page})=>{
  await page.goto('/catalogo.html?q=vitamina&category=bienestar&sort=high&origen=portada#contenido');
  await expect(page.locator('#catalog-sort')).toHaveValue('high');
  await page.locator('#catalog-search').fill('cuidado');
  await page.locator('#catalog-category').selectOption('cuidado');
  await page.locator('#catalog-sort').selectOption('low');
  await expect.poll(()=>new URL(page.url()).searchParams.get('q')).toBe('cuidado');
  let url=new URL(page.url());expect(url.searchParams.get('category')).toBe('cuidado');expect(url.searchParams.get('sort')).toBe('low');expect(url.searchParams.get('origen')).toBe('portada');expect(url.hash).toBe('#contenido');
  await page.reload();
  await expect(page.locator('#catalog-search')).toHaveValue('cuidado');await expect(page.locator('#catalog-category')).toHaveValue('cuidado');await expect(page.locator('#catalog-sort')).toHaveValue('low');
  await page.locator('#catalog-clear').focus();await page.keyboard.press('Enter');
  url=new URL(page.url());for(const field of ['q','category','sort'])expect(url.searchParams.has(field)).toBeFalsy();expect(url.searchParams.get('origen')).toBe('portada');
});

test('carrito conserva miniatura, enlace, disponibilidad y foco al ajustar cantidades con teclado',async({page})=>{
  const products=await availableProducts(page);expect(products.length).toBeGreaterThan(0);const product=products[0];
  await page.goto('/');
  await page.evaluate(id=>localStorage.setItem('farmacia-mvc-carrito',JSON.stringify({[id]:1})),product.id);
  await page.goto('/checkout.html');
  const item=page.locator('.checkout-cart-item');await expect(item).toHaveCount(1);
  const image=item.locator('img');await expect(image).toHaveAttribute('alt',product.alt || product.nombre);await expect(image).toHaveAttribute('width','90');await expect(image).toHaveAttribute('height','100');await expect.poll(()=>image.evaluate(img=>img.complete && img.naturalWidth>0)).toBeTruthy();
  await expect(item.getByRole('heading').getByRole('link')).toHaveAttribute('href','producto.html?id='+encodeURIComponent(product.id));
  await expect(item).toContainText(product.stock+' disponibles');
  const plus=item.locator('[data-cart-plus]');await plus.focus();await page.keyboard.press('Enter');
  await expect(item.locator('[data-cart-quantity]')).toHaveValue('2');await expect(item.locator('[data-cart-quantity]')).toBeFocused();
  const max=Math.min(99,product.stock);await expect(item.locator('[data-cart-quantity]')).toHaveAttribute('max',String(max));
  await expect(item.locator('.checkout-line-total')).toHaveAccessibleName('Total de '+product.nombre);
  await item.getByRole('heading').getByRole('link').focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(new RegExp('producto.html\\?id='+product.id));
  const cardImage=page.locator('#zoom-product img');await expect(cardImage).toHaveAttribute('width','600');await expect(cardImage).toHaveAttribute('height','600');
});

test('barra inferior del carrito sigue las unidades entre catálogo, ficha y otras pestañas',async({page,context})=>{
  const [product]=await availableProducts(page);expect(product).toBeTruthy();
  await page.goto('/catalogo.html');
  const dock=page.getByRole('region',{name:'Resumen del carrito',includeHidden:true});
  await expect(dock).toBeHidden();
  const add=page.locator(`[data-add="${product.id}"]`);await add.focus();await page.keyboard.press('Enter');
  await expect(dock).toBeVisible();await expect(dock).toContainText('1 unidad');await expect(add).toBeFocused();
  await page.goto('/producto.html?id='+encodeURIComponent(product.id));
  await expect(dock).toBeVisible();await expect(dock).toContainText('1 unidad');
  const other=await context.newPage();await other.goto('/catalogo.html');
  await other.evaluate(async id=>{const {cart}=await import('/models/cart.js');cart.update(id,2);},product.id);
  await expect(dock).toContainText('2 unidades');
  await other.evaluate(async()=>{const {cart}=await import('/models/cart.js');cart.clear();});
  await expect(dock).toBeHidden();
  await page.locator('#detail-add-button').click();await expect(dock).toBeVisible();
  await dock.getByRole('link',{name:'Ver carrito'}).focus();await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/checkout.html$/);await expect(page.locator('#checkout-items')).toContainText(product.nombre);
  await expect(dock).toHaveCount(0);await other.close();
});

test('barra inferior del carrito respeta sesión y deja accesible el pie a 320 px',async({page})=>{
  const [product]=await availableProducts(page);expect(product).toBeTruthy();
  await page.goto('/catalogo.html');
  await page.evaluate(async id=>{const {cart}=await import('/models/cart.js');cart.add({id,stock:5});},product.id);
  const dock=page.getByRole('region',{name:'Resumen del carrito',includeHidden:true});
  await expect(dock).toBeVisible();
  await page.setViewportSize({width:320,height:740});
  const link=dock.getByRole('link',{name:'Ver carrito'});await expect(link).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  const helper=page.locator('farmacia-mascota #launcher');await expect(helper).toBeVisible();
  const launcher=await helper.boundingBox(),bar=await dock.boundingBox();expect(launcher.y+launcher.height).toBeLessThanOrEqual(bar.y);
  const footer=page.locator('.site-footer');await footer.locator('a').last().focus();await page.keyboard.press('End');
  await expect.poll(async()=>{const footerLink=await footer.locator('a').last().boundingBox();return footerLink.y+footerLink.height;}).toBeLessThanOrEqual(bar.y);
  for(const role of ['admin','repartidor']){
    await page.evaluate(async role=>{const {auth}=await import('/models/auth.js');auth.save({token:'ui-session',usuario:{role,nombre:'Prueba',email:'prueba@example.ec'}});},role);
    await expect(dock).toBeHidden();
  }
  await page.evaluate(async()=>{const {auth}=await import('/models/auth.js');auth.clear();});await expect(dock).toBeVisible();
  await page.evaluate(()=>document.body.dataset.sessionPending='');await expect(dock).toBeHidden();
});
