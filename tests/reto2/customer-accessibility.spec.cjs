const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const {randomUUID}=require('node:crypto');
const money=value=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(value);
async function accessible(page,label){const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;expect(violations.map(issue=>({id:issue.id,targets:issue.nodes.map(node=>node.target)})),label).toEqual([]);}
async function layouts(page,label){
  for(const width of [320,768,1920]){
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),label+' sin desbordamiento a '+width).toBe(false);
    const shell=await page.locator('.site-shell').boundingBox();expect(Math.abs(shell.width-width),label+' ocupa el ancho de la ventana a '+width).toBeLessThanOrEqual(1);
  }
}
async function fixture(page,testInfo){
  const response=await page.request.post('/api/auth/login',{data:{email:'admin-browser@example.ec',password:'AdminBrowser2026!'}});expect(response.status()).toBe(200);
  const admin=(await response.json()).data;const headers={Authorization:'Bearer '+admin.token};const tag='Accesibilidad '+testInfo.project.name+' '+randomUUID().slice(0,8);const products=[];
  for(const item of [{kind:'general',precio:23,ivaCategoria:'general',descuentoPorcentaje:10,categoria:'cuidado'},{kind:'cero',precio:10,ivaCategoria:'cero',descuentoPorcentaje:0,categoria:'bebe'},{kind:'receta',precio:12,ivaCategoria:'cero',descuentoPorcentaje:0,categoria:'bienestar'}]){
    const data={nombre:tag+' '+item.kind,precio:item.precio,stock:10,categoria:item.categoria,descripcion:'Producto artificial para comprobar accesibilidad, impuestos y carrito.',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase sintético de comprobación '+item.kind,descuentoPorcentaje:item.descuentoPorcentaje,ivaCategoria:item.ivaCategoria,fundamentoIva:item.ivaCategoria==='cero'?'Artículo 55 de la LRTI; clasificación sintética en la base temporal de tests.':null,tipoProducto:item.kind==='receta'?'medicamento':'cuidado',requiereReceta:item.kind==='receta',stockMinimo:2};
    if(item.kind==='receta')Object.assign(data,{pvpMaximo:12,laboratorio:'Laboratorio sintético',presentacion:'Caja de prueba',registroSanitario:'REGISTRO-SINTETICO'});
    const created=await page.request.post('/api/productos',{headers,data});expect(created.status()).toBe(201);const row=(await created.json()).data;const currentResponse=await page.request.get('/api/productos/'+row.id);expect(currentResponse.status()).toBe(200);products.push({...((await currentResponse.json()).data),kind:item.kind});
  }
  return {tag,headers,products,general:products[0],zero:products[1],rx:products[2],async cleanup(){for(const product of products)await page.request.delete('/api/productos/'+product.id,{headers});}};
}
async function customerLogin(page,testInfo){
  const email='cliente-accesibilidad-'+randomUUID()+'@example.ec';const password='ClienteAccesibilidad2026!';
  const created=await page.request.post('/api/auth/register',{data:{nombre:'Cliente Ecuador',email,telefono:'0979275988',cedula:'0102030400',password}});expect(created.status()).toBe(201);
  await page.goto('/cuenta.html');await page.locator('#login-email').fill(email);await page.locator('#login-password').fill(password);await page.locator('#login-form [type=submit]').focus();await page.keyboard.press('Enter');await expect(page.locator('#logout')).toBeVisible();
  return {email,password};
}

test('catálogo y comparación operables con teclado y sin desbordamiento en teléfono, tableta y PC',async({page},testInfo)=>{
  const data=await fixture(page,testInfo);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto('/catalogo.html?q='+encodeURIComponent(data.tag));await expect(page.locator('#catalog-grid article')).toHaveCount(3);
    const general=page.locator('#catalog-grid article').filter({hasText:data.general.nombre});const zero=page.locator('#catalog-grid article').filter({hasText:data.zero.nombre});const rx=page.locator('#catalog-grid article').filter({hasText:data.rx.nombre});
    await expect(general.locator('.tax-note')).toContainText(String(data.general.ivaPorcentaje));await expect(zero.locator('.tax-note')).toContainText('0 %');await expect(rx).toContainText(/receta/i);
    const category=page.locator('#catalog-category');await category.focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');await expect(category).toHaveValue('bienestar');await expect(page.locator('#catalog-grid article')).toHaveCount(1);
    await category.focus();await page.keyboard.press('Home');await page.keyboard.press('Tab');await expect(page.locator('#catalog-grid article')).toHaveCount(3);
    const sort=page.locator('#catalog-sort');await sort.focus();await page.keyboard.press('End');await page.keyboard.press('ArrowUp');await page.keyboard.press('Tab');await expect(sort).toHaveValue('low');await expect(page.locator('#catalog-grid article').first()).toContainText(data.zero.nombre);
    for(const product of [data.general,data.zero]){const pick=page.locator('[data-compare="'+product.id+'"]');await pick.focus();await page.keyboard.press('Space');await expect(pick).toBeChecked();}
    await accessible(page,'Catálogo con IVA, descuento y producto que requiere receta');await layouts(page,'Catálogo');
    await page.getByRole('link',{name:'Comparar productos →'}).first().focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(/comparar.html$/);await expect(page.locator('#comparison thead th')).toHaveCount(3);
    await expect(page.locator('#comparison')).toContainText(data.general.nombre);await expect(page.locator('#comparison')).toContainText(data.zero.nombre);
    const zeroPick=page.locator('[data-pick="'+data.zero.id+'"]');await zeroPick.focus();await page.keyboard.press('Space');await expect(page.locator('#comparison thead th')).toHaveCount(2);await expect(zeroPick).toBeFocused();await page.keyboard.press('Space');await expect(page.locator('#comparison thead th')).toHaveCount(3);
    await page.locator('#comparison').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#comparison')).toBeFocused();await accessible(page,'Comparación de dos productos sintéticos');await layouts(page,'Comparación');
    await page.goto('/catalogo.html?q='+encodeURIComponent(data.tag));await expect(page.locator('#catalog-grid article')).toHaveCount(3);await page.locator('#catalog-search').fill('Sin coincidencia '+randomUUID());await expect(page.locator('#catalog-grid article')).toHaveCount(0);await page.locator('#catalog-clear').focus();await page.keyboard.press('Enter');await expect(page.locator('#catalog-search')).toHaveValue('');await expect(page.locator('#catalog-category')).toHaveValue('todos');expect(errors).toEqual([]);
  }finally{await data.cleanup();}
});

test('detalle, imagen ampliada, cantidades y bloqueo de receta funcionan con teclado',async({page},testInfo)=>{
  const data=await fixture(page,testInfo);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto('/producto.html?id='+data.general.id);await expect(page.locator('#detail-add-form')).toBeVisible();await expect(page.locator('.tax-note')).toContainText(String(data.general.ivaPorcentaje));await expect(page.locator('.promotion-ribbon')).toContainText('10%');
    const zoom=page.locator('#zoom-product');await zoom.focus();await page.keyboard.press('Enter');await expect(page.locator('#image-dialog')).toBeVisible();await expect(page.locator('#image-dialog img')).toHaveAttribute('alt',data.general.alt);await page.keyboard.press('Escape');await expect(page.locator('#image-dialog')).toBeHidden();await expect(zoom).toBeFocused();
    await page.locator('[data-quantity="1"]').focus();await page.keyboard.press('Space');await expect(page.locator('#detail-quantity')).toHaveValue('2');await page.locator('[data-quantity="-1"]').focus();await page.keyboard.press('Enter');await expect(page.locator('#detail-quantity')).toHaveValue('1');
    const submit=page.locator('#detail-add-form [type=submit]');await submit.focus();await page.keyboard.press('Enter');await expect(page.locator('[data-shop-count]')).toHaveText('1');await expect(page.locator('#detail-add-form [type=submit]')).toBeFocused();
    await accessible(page,'Detalle con descuento e IVA');await layouts(page,'Detalle');await page.setViewportSize({width:testInfo.project.name==='movil'?375:1920,height:1000});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'docs/pruebas/reto2/capturas/cliente-detalle-accesible-'+testInfo.project.name+'.png',fullPage:true});
    await page.goto('/producto.html?id='+data.rx.id);await expect(page.locator('#product-detail')).toContainText(/receta/i);const enabledAdd=page.locator('#detail-add-form [type=submit]:enabled');await expect(enabledAdd).toHaveCount(0);const contact=page.getByRole('link',{name:'Coordinar con la farmacia'});await expect(contact).toBeVisible();
    await expect(page.locator('[data-shop-count]')).toHaveText('1');await accessible(page,'Detalle de producto con receta obligatoria');await layouts(page,'Detalle de receta');await contact.focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(/index.html#contacto$/);await expect(page.locator('#contacto')).toBeVisible();
    // Simula un carrito guardado antes de que el administrador marque receta obligatoria.
    await page.evaluate(productId=>localStorage.setItem('farmacia-mvc-carrito',JSON.stringify({[productId]:1})),data.rx.id);
    await page.goto('/checkout.html');await expect(page.locator('.checkout-cart-item')).toHaveCount(1);await expect(page.locator('#checkout-next')).toBeDisabled();await expect(page.locator('#checkout-items')).toContainText(/receta/i);expect(errors).toEqual([]);
  }finally{await data.cleanup();}
});

test('carrito, validación ecuatoriana y pedido conservan el desglose de IVA y el foco de teclado',async({page},testInfo)=>{
  const data=await fixture(page,testInfo);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await customerLogin(page,testInfo);await page.goto('/catalogo.html?q='+encodeURIComponent(data.tag));await expect(page.locator('#catalog-grid article')).toHaveCount(3);
    for(const product of [data.general,data.zero]){const add=page.locator('[data-add="'+product.id+'"]');await add.focus();await page.keyboard.press('Enter');await expect(add).toBeEnabled();await expect(add).toBeFocused();}
    await expect(page.locator('[data-shop-count]')).toHaveText('2');await page.goto('/checkout.html');await expect(page.locator('.checkout-cart-item')).toHaveCount(2);
    const regularCents=Math.round(Number(data.general.precio)*100),zeroCents=Math.round(Number(data.zero.precio)*100);const initialTotal=(regularCents+zeroCents)/100;
    await expect(page.locator('#checkout-summary')).toContainText('Base imponible');await expect(page.locator('#checkout-summary')).toContainText('IVA');await expect(page.locator('#checkout-summary .summary-total')).toContainText(money(initialTotal));
    await page.locator('[data-cart-plus="'+data.general.id+'"]').focus();await page.keyboard.press('Space');await expect(page.locator('#qty-'+data.general.id)).toHaveValue('2');await expect(page.locator('#qty-'+data.general.id)).toBeFocused();
    const total=(regularCents*2+zeroCents)/100;await expect(page.locator('#checkout-summary .summary-total')).toContainText(money(total));
    const remove=page.locator('[data-cart-remove="'+data.zero.id+'"]');await remove.focus();await page.keyboard.press('Enter');await expect(page.locator('#confirm-dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#confirm-dialog')).toBeHidden();await expect(remove).toBeFocused();await expect(page.locator('.checkout-cart-item')).toHaveCount(2);
    await page.locator('#checkout-next').focus();await page.keyboard.press('Enter');await expect(page.locator('#delivery-form')).toBeVisible();await expect(page.locator('#checkout-name')).toBeFocused();
    await page.locator('#checkout-document').fill('1111111111');await page.locator('#delivery-form [type=submit]').focus();await page.keyboard.press('Enter');await expect(page.locator('#checkout-document')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#checkout-document')).toBeFocused();
    await page.locator('#checkout-document').fill('0102030400');await page.locator('[name=delivery][value=delivery]').focus();await page.keyboard.press('Space');await expect(page.locator('#delivery-address')).toBeVisible();await page.locator('#checkout-province').selectOption('Pichincha');await page.locator('#checkout-city').fill('Quito');await page.locator('#checkout-address').fill('Av. Amazonas N10-20 junto al parque');await page.locator('#checkout-postalCode').fill('090101');await page.locator('#checkout-terms').focus();await page.keyboard.press('Space');
    await page.locator('#delivery-form [type=submit]').focus();await page.keyboard.press('Enter');await expect(page.locator('#checkout-postalCode')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#checkout-postalCode')).toBeFocused();await page.locator('#checkout-postalCode').fill('170101');
    await accessible(page,'Carrito y formulario ecuatoriano');await layouts(page,'Carrito');
    const orderResponse=page.waitForResponse(response=>response.request().method()==='POST' && new URL(response.url()).pathname==='/api/pedidos');await page.locator('#delivery-form [type=submit]').focus();await page.keyboard.press('Enter');const response=await orderResponse;expect(response.status()).toBe(201);const order=(await response.json()).data;
    expect(Number(order.total)).toBe(total);expect(Number(order.baseImponible)+Number(order.ivaMonto)).toBeCloseTo(total,2);expect(order.detalles.every(line=>[0,13,14,15].includes(line.ivaPorcentaje))).toBe(true);
    await expect(page.locator('#order-confirmation')).toContainText('Tu pedido quedó registrado.');await expect(page.locator('#order-confirmation h2').first()).toBeFocused();await expect(page.locator('#order-confirmation')).toContainText('IVA');await expect(page.locator('[data-shop-count]')).toHaveText('0');await layouts(page,'Confirmación de pedido');
    await page.getByRole('link',{name:'Ver mis pedidos →'}).focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(/pedidos.html$/);await expect(page.locator('.order-card')).toHaveCount(1);await expect(page.locator('.order-card')).toContainText(money(total));await expect(page.locator('.order-card')).toContainText('IVA');await expect(page.locator('.order-card')).not.toContainText('0102030400');
    const history=page.locator('.order-card summary');await history.focus();await page.keyboard.press('Space');await expect(page.locator('.order-card details')).toHaveAttribute('open','');await accessible(page,'Pedido con historial, documento enmascarado e IVA');await layouts(page,'Mis pedidos');
    const cancellation=await page.request.put('/api/pedidos/'+order.id+'/estado',{headers:data.headers,data:{estado:'cancelado',esperadoUpdatedAt:order.updatedAt}});expect(cancellation.status()).toBe(200);await page.reload();await expect(page.locator('.order-card')).toContainText('Cancelado');await expect(page.locator('.order-card')).toContainText(money(total));await expect(page.locator('.order-card')).toContainText('IVA');
    const original=(await (await page.request.get('/api/productos/'+data.general.id)).json()).data;expect(original.stock).toBe(data.general.stock);expect(errors).toEqual([]);
  }finally{await data.cleanup();}
});
