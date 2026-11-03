const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const {randomUUID}=require('node:crypto');

test('compra con tarifa real, confirmación y seguimiento conservan importes y estados de la API',async({page,request},testInfo)=>{
  const signed=await request.post('/api/auth/login',{data:{email:'admin-browser@example.ec',password:'AdminBrowser2026!'}});expect(signed.status()).toBe(200);
  const staff={Authorization:'Bearer '+(await signed.json()).data.token},tag=randomUUID().slice(0,8);
  const registered=await request.post('/api/auth/register',{data:{nombre:'Cliente Compra',email:'compra-'+tag+'@example.ec',telefono:'0979275988',cedula:'0102030400',password:'ClienteCompra2026!'}});expect(registered.status()).toBe(201);
  const customer=(await registered.json()).data;
  const created=await request.post('/api/productos',{headers:staff,data:{nombre:'Cuidado personal '+tag,precio:11.5,stock:8,categoria:'cuidado',descripcion:'Producto para verificar el recorrido de compra en la base temporal.',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase de cuidado personal',tipoProducto:'cuidado',ivaCategoria:'general',requiereReceta:false}});expect(created.status()).toBe(201);
  const product=(await created.json()).data,zoneInput={nombre:'Compra '+tag,provincia:'Pichincha',canton:'Puerto Quito',tarifaCentavos:null,ivaCategoria:'general',fundamentoIva:null,activa:true};
  const createdZone=await request.post('/api/admin/zonas-entrega',{headers:staff,data:zoneInput});expect(createdZone.status()).toBe(201);let zone=(await createdZone.json()).data;
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({token,id})=>{
    sessionStorage.setItem('farmacia-mvc-token',token);if(!sessionStorage.getItem('purchase-fixture-ready')){localStorage.setItem('farmacia-mvc-carrito',JSON.stringify({[id]:1}));sessionStorage.setItem('purchase-fixture-ready','true');}
    window.purchaseGpsCalls=0;
    for(const method of ['getCurrentPosition','watchPosition'])if(navigator.geolocation)Object.defineProperty(navigator.geolocation,method,{value:()=>{window.purchaseGpsCalls++;throw new Error('El GPS debe ser voluntario.');}});
  },{token:customer.token,id:product.id});
  try{
    await page.goto('/checkout.html');await expect(page.locator('.checkout-cart-item')).toHaveCount(1);await expect(page.locator('#checkout-next')).toBeEnabled();
    await page.locator('#checkout-next').click();await expect(page.locator('#delivery-form')).toBeVisible();await expect(page.locator('#purchase-cart-panel')).toBeHidden();await expect(page.locator('#delivery-form #purchase-summary')).toBeVisible();
    await expect(page.locator('#checkout-name')).toBeFocused();await expect(page.locator('#checkout-review-items')).toContainText(product.nombre);
    await page.locator('[name=delivery][value=delivery]').check();await page.locator('#checkout-zone').selectOption(zone.id);await page.locator('#checkout-document').fill('0102030400');await page.locator('#checkout-address').fill('Calle de prueba 123 frente al parque');await page.locator('#checkout-terms').check();await page.locator('[name=paymentPreference][value=transfer]').check();
    await expect(page.locator('#checkout-grand-total')).toHaveText('Por confirmar');await expect(page.locator('#delivery-form [type=submit]')).toBeDisabled();
    const priced=await request.put('/api/admin/zonas-entrega/'+zone.id,{headers:staff,data:{...zoneInput,tarifaCentavos:250,esperadoVersion:zone.version}});expect(priced.status()).toBe(200);zone=(await priced.json()).data;
    await page.locator('#checkout-refresh-zone').click();await expect(page.locator('#checkout-grand-total')).toContainText('14,00');await expect(page.locator('#delivery-form [type=submit]')).toBeEnabled();
    await expect(page.locator('#checkout-address')).toHaveValue('Calle de prueba 123 frente al parque');
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.screenshot({path:testInfo.outputPath('finalizar-compra.png'),fullPage:true,animations:'disabled'});
    const pending=page.waitForResponse(response=>response.request().method()==='POST' && new URL(response.url()).pathname==='/api/pedidos');await page.locator('#delivery-form [type=submit]').click();const placed=await pending;expect(placed.status()).toBe(201);let order=(await placed.json()).data;
    expect(Number(order.total)).toBe(14);expect(order.costoEnvioCentavos).toBe(250);expect(order.estado).toBe('pendiente');
    expect(placed.request().postDataJSON().comprador.paymentPreference).toBeUndefined();
    await expect(page.getByRole('link',{name:'Elegir forma de pago →'})).toHaveAttribute('href',`pagos.html?pedido=${order.id}&metodo=transfer`);
    await expect(page.locator('#order-confirmation')).toBeVisible();await expect(page.locator('#order-confirmation')).toContainText('¡Gracias por tu compra!');await expect(page.locator('#order-confirmation')).toContainText('Por coordinar');await expect(page.locator('#order-confirmation .purchase-order-line img')).toHaveCount(1);
    expect(await page.locator('#order-confirmation .purchase-order-line img').evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);expect(await page.evaluate(()=>window.purchaseGpsCalls)).toBe(0);await expect(page.locator('iframe')).toHaveCount(0);
    await page.screenshot({path:testInfo.outputPath('pedido-registrado.png'),fullPage:true,animations:'disabled'});
    await page.getByRole('link',{name:'Ver mis pedidos →'}).click();const card=page.locator('.order-card').filter({hasText:'Pedido '+order.id.slice(0,8)});await expect(card).toBeVisible();await expect(card.locator('[aria-current=step]')).toHaveAttribute('data-order-step','pendiente');
    for(const estado of ['confirmado','preparado']){
      const changed=await request.put('/api/pedidos/'+order.id+'/estado',{headers:staff,data:{estado,esperadoUpdatedAt:order.updatedAt}});expect(changed.status()).toBe(200);order=(await changed.json()).data;
      await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(card.locator('[aria-current=step]')).toHaveAttribute('data-order-step',estado);
    }
    await expect(card).toContainText('14,00');await expect(card).not.toContainText('0102030400');await card.locator('[data-order-invoice]').click();await expect(card.locator('[id^=invoice-]')).toContainText('La farmacia todavía no ha creado una factura');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);expect(errors).toEqual([]);
    const remaining=await request.get('/api/productos/'+product.id);expect((await remaining.json()).data.stock).toBe(7);
  }finally{
    await request.delete('/api/productos/'+product.id,{headers:staff});await request.put('/api/admin/zonas-entrega/'+zone.id,{headers:staff,data:{...zoneInput,tarifaCentavos:zone.tarifaCentavos,activa:false,esperadoVersion:zone.version}});
  }
});
