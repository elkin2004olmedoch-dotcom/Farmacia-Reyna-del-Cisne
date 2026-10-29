const {test,expect}=require('@playwright/test');
const {randomUUID}=require('node:crypto');

test('checkout muestra tarifa pendiente, actualiza la cotización y exige revisar un cambio antes de confirmar',async({page,request})=>{
  const login=await request.post('/api/auth/login',{data:{email:'admin-browser@example.ec',password:'AdminBrowser2026!'}});expect(login.status()).toBe(200);const headers={Authorization:'Bearer '+(await login.json()).data.token};
  const suffix=randomUUID().slice(0,8),email='cotizacion-'+suffix+'@example.ec';
  const registered=await request.post('/api/auth/register',{data:{nombre:'Cliente Cotización',email,telefono:'0979275988',cedula:'0102030400',password:'ClienteCotizacion2026!'}});expect(registered.status()).toBe(201);const customer=(await registered.json()).data;
  const zoneInput={nombre:'Cotización '+suffix,provincia:'Pichincha',canton:'Puerto Quito',tarifaCentavos:null,ivaCategoria:'general',fundamentoIva:null,activa:true};
  const createdZone=await request.post('/api/admin/zonas-entrega',{headers,data:zoneInput});expect(createdZone.status()).toBe(201);let zone=(await createdZone.json()).data;
  const createdProduct=await request.post('/api/productos',{headers,data:{nombre:'Artículo cotización '+suffix,precio:5,stock:10,categoria:'cuidado',descripcion:'Artículo sintético para comprobar cotización de entrega',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase de prueba',tipoProducto:'cuidado',requiereReceta:false}});expect(createdProduct.status()).toBe(201);const product=(await createdProduct.json()).data;
  try{
    await page.goto('/cuenta.html');await page.evaluate(token=>sessionStorage.setItem('farmacia-mvc-token',token),customer.token);await page.goto('/producto.html?id='+product.id);
    await page.locator('#detail-add-button').click();await page.goto('/checkout.html');await expect(page.locator('.checkout-item-image')).toHaveCount(1);
    await page.locator('#checkout-next').click();await page.locator('[name=delivery][value=delivery]').check();await page.locator('#checkout-zone').selectOption(zone.id);
    await page.locator('#checkout-document').fill('0102030400');await page.locator('#checkout-address').fill('Calle de prueba frente al parque de Puerto Quito');await page.locator('#checkout-terms').check();
    await expect(page.locator('#delivery-form [type=submit]')).toBeDisabled();await expect(page.locator('#checkout-grand-total')).toHaveText('Por confirmar');
    let updated=await request.put('/api/admin/zonas-entrega/'+zone.id,{headers,data:{...zoneInput,tarifaCentavos:250,esperadoVersion:zone.version}});expect(updated.status()).toBe(200);zone=(await updated.json()).data;
    await page.locator('#checkout-refresh-zone').focus();await page.keyboard.press('Enter');await expect(page.locator('#checkout-grand-total')).toContainText('7,50');await expect(page.locator('#delivery-form [type=submit]')).toBeEnabled();await expect(page.locator('#checkout-address')).toHaveValue('Calle de prueba frente al parque de Puerto Quito');
    updated=await request.put('/api/admin/zonas-entrega/'+zone.id,{headers,data:{...zoneInput,tarifaCentavos:300,esperadoVersion:zone.version}});expect(updated.status()).toBe(200);
    const stale=page.waitForResponse(response=>response.request().method()==='POST' && new URL(response.url()).pathname==='/api/pedidos');await page.locator('#delivery-form [type=submit]').click();expect((await stale).status()).toBe(409);
    await expect(page.locator('#page-status')).toContainText('tarifa de entrega cambió');await expect(page.locator('#checkout-grand-total')).toContainText('8,00');await expect(page.locator('.checkout-item-image')).toHaveCount(1);
    const confirmed=page.waitForResponse(response=>response.request().method()==='POST' && new URL(response.url()).pathname==='/api/pedidos');await page.locator('#delivery-form [type=submit]').focus();await page.keyboard.press('Enter');const response=await confirmed;expect(response.status()).toBe(201);const order=(await response.json()).data;
    expect(order.costoEnvioCentavos).toBe(300);expect(Number(order.subtotalProductos)).toBe(5);expect(Number(order.total)).toBe(8);await expect(page.locator('#order-confirmation')).toContainText('Envío');await expect(page.locator('#order-confirmation a[href^="seguimiento.html?pedido="]')).toBeVisible();
    const history=await request.get('/api/pedidos/mis-pedidos',{headers:{Authorization:'Bearer '+customer.token}});expect((await history.json()).data.total).toBe(1);
  }finally{await request.delete('/api/productos/'+product.id,{headers});}
});
