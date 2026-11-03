const {test,expect}=require('./browser-fixture.cjs');
const {randomUUID}=require('node:crypto');

test('checkout muestra tarifa pendiente, actualiza la cotización y exige revisar un cambio antes de confirmar',async({page,request})=>{
  const login=await request.post('/api/auth/login',{data:{email:'admin-browser@example.ec',password:'AdminBrowser2026!'}});expect(login.status()).toBe(200);const headers={Authorization:'Bearer '+(await login.json()).data.token};
  const suffix=randomUUID().slice(0,8),email='cotizacion-'+suffix+'@example.ec';
  const registered=await request.post('/api/auth/register',{data:{nombre:'Cliente Cotización',email,telefono:'0979275988',cedula:'0102030400',password:'ClienteCotizacion2026!'}});expect(registered.status()).toBe(201);const customer=(await registered.json()).data;
  const zoneInput={nombre:'Cotización '+suffix,provincia:'pichincha',canton:'Puerto Quito',tarifaCentavos:null,ivaCategoria:'general',fundamentoIva:null,activa:true};
  const createdZone=await request.post('/api/admin/zonas-entrega',{headers,data:zoneInput});expect(createdZone.status()).toBe(201);let zone=(await createdZone.json()).data;
  const createdProduct=await request.post('/api/productos',{headers,data:{nombre:'Artículo cotización '+suffix,precio:5,stock:10,categoria:'cuidado',descripcion:'Artículo sintético para comprobar cotización de entrega',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase de prueba',tipoProducto:'cuidado',requiereReceta:false}});expect(createdProduct.status()).toBe(201);const product=(await createdProduct.json()).data;
  try{
    const exchanged=await page.request.post('/api/auth/web/exchange',{headers:{Authorization:'Bearer '+customer.token,Origin:'http://localhost:3300','X-Farmacia-Web':'1'},data:{}});expect(exchanged.status()).toBe(200);await page.goto('/producto.html?id='+product.id);
    await page.locator('#detail-add-button').click();await expect(page.getByRole('button',{name:'Carrito, 1 unidades',exact:true})).toBeVisible();await page.goto('/checkout.html');await expect(page.locator('.checkout-item-image')).toHaveCount(1);
    await page.locator('#checkout-next').click();await page.locator('[name=delivery][value=delivery]').check();await page.locator('#checkout-zone').selectOption(zone.id);await expect(page.locator('#checkout-province')).toHaveValue('Pichincha');
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
test('envío nacional gratuito y retiro automático sin crear un pedido cuando no se localiza el destino',async({page,request})=>{
 const login=await request.post('/api/auth/login',{data:{email:'admin-browser@example.ec',password:'AdminBrowser2026!'}}),headers={Authorization:'Bearer '+(await login.json()).data.token},suffix=Date.now()+'-'+Math.random().toString(16).slice(2);
 const customer=(await (await request.post('/api/auth/register',{data:{nombre:'Cliente Ecuador',email:'ecuador-'+suffix+'@example.ec',telefono:'0991234567',cedula:'0102030400',password:'ClienteEcuador2026!'}})).json()).data;
 const created=await request.post('/api/productos',{headers,data:{nombre:'Cuidado Ecuador '+suffix,precio:5,stock:10,categoria:'cuidado',descripcion:'Artículo sintético de cobertura nacional',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase',tipoProducto:'cuidado',requiereReceta:false}});expect(created.status()).toBe(201);const product=(await created.json()).data;
 const exchange=await page.request.post('/api/auth/web/exchange',{headers:{Authorization:'Bearer '+customer.token,Origin:'http://localhost:3300','X-Farmacia-Web':'1'},data:{}});expect(exchange.status()).toBe(200);
 await page.goto('/producto.html?id='+product.id);await page.locator('#detail-add-button').click();await expect(page.getByRole('button',{name:'Carrito, 1 unidades',exact:true})).toBeVisible();await page.goto('/checkout.html');await page.locator('#checkout-next').click();
 await page.locator('#checkout-delivery').check();await page.locator('#checkout-zone').selectOption('ecuador-nacional');await page.locator('#checkout-province').selectOption('Azuay');await page.locator('#checkout-city').fill('Cuenca');await page.locator('#checkout-address').fill('Sin ubicación calle desconocida');await page.locator('#checkout-document').fill('0102030400');await page.locator('#checkout-terms').check();
 await expect(page.locator('#checkout-shipping-fee')).toContainText('0,00');await expect(page.locator('#checkout-grand-total')).toContainText('5,00');
 let writes=0;page.on('request',req=>{if(req.method()==='POST'&&new URL(req.url()).pathname==='/api/pedidos')writes++;});
 await page.locator('#delivery-form [type=submit]').click();await expect(page.locator('#checkout-pickup')).toBeChecked();await expect(page.locator('#page-status')).toContainText('retiro');await expect(page.locator('#checkout-shipping-fee')).toHaveText('Retiro sin costo');expect(writes).toBe(0);
 await page.locator('#checkout-delivery').check();await page.locator('#checkout-address').fill('Avenida Solano numero 123');
 const pending=page.waitForResponse(res=>res.request().method()==='POST'&&new URL(res.url()).pathname==='/api/pedidos');await page.locator('#delivery-form [type=submit]').click();const response=await pending;expect(response.status()).toBe(201);const order=(await response.json()).data;expect(order.entrega).toBe('delivery');expect(order.costoEnvioCentavos).toBe(0);expect(Number(order.total)).toBe(5);expect(order.latitudEntrega).toBe(.125);
 await request.delete('/api/productos/'+product.id,{headers});
});
test('administración edita la tarifa nacional y conserva su alcance en el formulario',async({page,request},testInfo)=>{
 const login=await request.post('/api/auth/login',{data:{email:'admin-browser@example.ec',password:'AdminBrowser2026!'}}),admin=(await login.json()).data,headers={Authorization:'Bearer '+admin.token};
 const response=await request.get('/api/admin/zonas-entrega',{headers}),original=(await response.json()).data.find(row=>row.id==='ecuador-nacional');
 await page.request.post('/api/auth/web/exchange',{headers:{...headers,Origin:'http://localhost:3300','X-Farmacia-Web':'1'},data:{}});await page.goto('/entregas.html');
 await page.locator('[data-zone-edit="ecuador-nacional"]').click();await expect(page.locator('#delivery-zone-scope')).toHaveValue('nacional');await expect(page.locator('#delivery-zone-price')).toHaveValue((original.tarifaCentavos/100).toFixed(2));
 try{
  await page.locator('#delivery-zone-price').fill('1.25');const pending=page.waitForResponse(res=>res.request().method()==='PUT'&&res.url().includes('/api/admin/zonas-entrega/ecuador-nacional'));await page.locator('#delivery-zone-form [type=submit]').click();const saved=await pending;expect(saved.status()).toBe(200);expect((await saved.json()).data.alcance).toBe('nacional');
  await expect(page.locator('#page-status')).toContainText('Zona y tarifa guardadas');await page.screenshot({path:testInfo.outputPath('tarifa-nacional-admin.png'),fullPage:true});
 }finally{
  const current=(await (await request.get('/api/admin/zonas-entrega',{headers})).json()).data.find(row=>row.id===original.id),values=Object.fromEntries(['nombre','provincia','canton','alcance','tarifaCentavos','ivaCategoria','fundamentoIva','activa'].map(key=>[key,original[key]]));
  const restored=await request.put('/api/admin/zonas-entrega/'+original.id,{headers,data:{...values,esperadoVersion:current.version}});expect(restored.status()).toBe(200);
 }
});
