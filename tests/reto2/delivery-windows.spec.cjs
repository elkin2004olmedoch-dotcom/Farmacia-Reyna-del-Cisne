const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const {randomUUID}=require('node:crypto');

async function api(request,path,{token,method='get',data,status=200}={}){
  const response=await request[method]('/api'+path,{headers:token?{Authorization:'Bearer '+token}:{},...(data?{data}:{})});
  expect(response.status(),method+' '+path).toBe(status);return status===204?null:(await response.json()).data;
}
async function signedIn(page,token,path){await page.goto('/cuenta.html');await page.evaluate(value=>sessionStorage.setItem('farmacia-mvc-token',value),token);await page.goto(path);}
async function basicFixture(request){
  const admin=await api(request,'/auth/login',{method:'post',data:{email:'admin-browser@example.ec',password:'AdminBrowser2026!'}});
  const suffix=randomUUID().slice(0,8),email='cliente-entregas-'+suffix+'@example.ec';
  const customer=await api(request,'/auth/register',{method:'post',status:201,data:{nombre:'Cliente Reparto',email,telefono:'0979275988',cedula:'0102030400',password:'ClienteReparto2026!'}});
  const product=await api(request,'/productos',{token:admin.token,method:'post',status:201,data:{nombre:'Artículo de reparto '+suffix,precio:5,stock:10,categoria:'cuidado',descripcion:'Artículo sintético para comprobar entregas privadas',imagen:'assets/images/producto-vitaminas.jpg',alt:'Artículo de prueba',descuentoPorcentaje:0,ivaCategoria:'general',tipoProducto:'cuidado',requiereReceta:false,stockMinimo:1}});
  return {admin,customer,product,suffix,email};
}
async function newOrder(request,data,zone){
  let order=await api(request,'/pedidos',{token:data.customer.token,method:'post',status:201,data:{carrito:[{productoId:data.product.id,cantidad:1}],comprador:{name:'Cliente de prueba',email:data.email,phone:'0979275988',documentType:'cedula',document:'0102030400',delivery:'delivery',province:'Pichincha',city:'Puerto Quito',address:'Calle de prueba 123 frente al parque',postalCode:'170950',zonaEntregaId:zone.id,esperadoTarifaVersion:zone.version,latitudEntrega:0.125,longitudEntrega:-79.25,consienteUbicacion:true},claveSolicitud:randomUUID()}});
  for(const estado of ['confirmado','preparado'])order=await api(request,'/pedidos/'+order.id+'/estado',{token:data.admin.token,method:'put',data:{estado,esperadoUpdatedAt:order.updatedAt}});
  return order;
}
async function accessibleAt320(page){
  await page.setViewportSize({width:320,height:950});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(audit.violations.map(issue=>({id:issue.id,targets:issue.nodes.map(node=>node.target)}))).toEqual([]);
}

test('administración configura reparto, cliente consulta mapa voluntario y repartidor comparte GPS, llega, llama y finaliza',async({page,browser,request})=>{
  const data=await basicFixture(request),courierEmail='repartidor-'+data.suffix+'@example.ec',errors=[];page.on('pageerror',error=>errors.push(error.message));
  const courierContext=await browser.newContext(),customerContext=await browser.newContext();
  try{
    await signedIn(page,data.admin.token,'/entregas.html');await expect(page.locator('#delivery-admin')).toBeVisible();
    await page.locator('#delivery-zone-editor summary').click();
    await page.locator('#delivery-zone-name').fill('Prueba reparto '+data.suffix);await page.locator('#delivery-zone-price').fill('2.25');await page.locator('#delivery-zone-form [type=submit]').focus();await page.keyboard.press('Enter');
    await expect(page.locator('#delivery-zones-list')).toContainText('Prueba reparto '+data.suffix);
    const zone=(await api(request,'/admin/zonas-entrega',{token:data.admin.token})).find(item=>item.nombre==='Prueba reparto '+data.suffix);expect(zone.tarifaCentavos).toBe(225);
    await page.locator('#courier-form').locator('..').locator('summary').click();
    await page.locator('#courier-name').fill('Repartidor de Prueba');await page.locator('#courier-email').fill(courierEmail);await page.locator('#courier-phone').fill('0979275988');await page.locator('#courier-password').fill('RepartidorPrueba2026!');
    const createdCourier=page.waitForResponse(response=>response.request().method()==='POST' && new URL(response.url()).pathname==='/api/admin/repartidores');await page.locator('#courier-form [type=submit]').click();
    const courierResponse=await createdCourier;expect(courierResponse.status()).toBe(201);const courier=(await courierResponse.json()).data;await expect(page.locator('[data-courier-toggle="'+courier.id+'"]')).toBeVisible();
    await page.locator('[data-courier-toggle="'+courier.id+'"]').click();await expect(page.locator('[data-courier-toggle="'+courier.id+'"]')).toHaveText(/Activar/);
    await page.locator('[data-courier-toggle="'+courier.id+'"]').click();await expect(page.locator('[data-courier-toggle="'+courier.id+'"]')).toHaveText(/Desactivar/);
    const order=await newOrder(request,data,zone);expect(order.costoEnvioCentavos).toBe(225);expect(Number(order.total)).toBe(7.25);
    await page.reload();await expect(page.locator('#delivery-orders-info')).toContainText('Página');
    while(await page.locator('#delivery-order-select option[value="'+order.id+'"]').count()===0){const before=await page.locator('#delivery-orders-info').textContent();await expect(page.locator('#delivery-orders-next')).toBeEnabled();await page.locator('#delivery-orders-next').click();await expect(page.locator('#delivery-orders-info')).not.toHaveText(before);}
    await page.locator('#delivery-order-select').selectOption(order.id);await page.locator('#delivery-courier-select').selectOption(courier.id);await page.locator('#delivery-assignment-form [type=submit]').click();
    const adminCard=page.locator('[data-delivery]').filter({hasText:order.id.slice(0,8)});await expect(adminCard).toContainText('Asignada');
    // El formulario abierto y su edición sobreviven a una actualización de la bandeja.
    await page.locator('#delivery-zone-editor summary').click();await page.locator('#delivery-zone-name').fill('Borrador sin guardar');await page.locator('#deliveries-refresh').click();await expect(page.locator('#delivery-zone-name')).toHaveValue('Borrador sin guardar');
    await accessibleAt320(page);
    const customerPage=await customerContext.newPage();let mapRequests=0;
    await customerPage.route('https://www.openstreetmap.org/**',route=>{mapRequests++;return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><title>Mapa de prueba</title><body>Mapa sintético sin proveedor real</body></html>'});});
    await signedIn(customerPage,data.customer.token,'/seguimiento.html?pedido='+order.id);await expect(customerPage.locator('#tracking-content')).toContainText('Asignada');expect(mapRequests).toBe(0);await expect(customerPage.locator('#tracking-map-panel iframe')).toHaveCount(0);
    const courierAuth=await api(request,'/auth/login',{method:'post',data:{email:courierEmail,password:'RepartidorPrueba2026!'}}),courierPage=await courierContext.newPage();
    await courierPage.addInitScript(()=>{
      window.testGps={callback:null,cleared:0};
      Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(callback){window.testGps.callback=callback;return 7;},clearWatch(){window.testGps.cleared++;}}});
    });
    await signedIn(courierPage,courierAuth.token,'/cuenta.html');
    await expect(courierPage).toHaveURL(/\/entregas\.html$/);await expect(courierPage.locator('#delivery-admin')).toBeHidden();
    const card=courierPage.locator('[data-delivery]').filter({hasText:order.id.slice(0,8)});await expect(card).toBeVisible();await expect(card.locator('a[href^="tel:"]')).toHaveCount(0);await expect(card.locator('a[href^="https://www.google.com/maps/dir/"]')).toHaveAttribute('href',/destination=0.125%2C-79.25/);
    expect(await courierPage.evaluate(()=>window.testGps.callback)).toBeNull();
    let gpsRequests=0;courierPage.on('request',req=>{if(req.method()==='PUT' && /\/entregas\/[^/]+\/ubicacion$/.test(new URL(req.url()).pathname))gpsRequests++;});
    await card.locator('[data-delivery-state="en_camino"]').click();await expect(card).toContainText('En camino');await card.locator('[data-delivery-gps]').click();
    await courierPage.evaluate(()=>window.testGps.callback({coords:{latitude:0.12,longitude:-79.24,accuracy:18},timestamp:Date.now()}));await expect(courierPage.locator('#delivery-gps-status')).toContainText('Ubicación compartida');
    await courierPage.evaluate(()=>window.testGps.callback({coords:{latitude:0.121,longitude:-79.241,accuracy:18},timestamp:Date.now()}));expect(gpsRequests).toBe(1);
    await customerPage.locator('#tracking-refresh').click();await expect(customerPage.locator('#tracking-location')).toContainText('18 metros');expect(mapRequests).toBe(0);
    await customerPage.locator('#tracking-map-load').focus();await customerPage.keyboard.press('Enter');await expect(customerPage.locator('#tracking-map-panel iframe')).toBeVisible();await expect.poll(()=>mapRequests).toBe(1);
    const frame=await customerPage.locator('#tracking-map-panel iframe').elementHandle();await customerPage.locator('#tracking-refresh').click();expect(await frame.evaluate(node=>node.isConnected)).toBe(true);expect(mapRequests).toBe(1);
    await expect(customerPage.locator('#tracking-google-map')).toHaveAttribute('href',/www.google.com\/maps\/search/);await accessibleAt320(customerPage);
    await card.locator('[data-delivery-gps]').click();await expect(courierPage.locator('#delivery-gps-status')).toContainText('retirada del servidor');await expect.poll(()=>courierPage.evaluate(()=>window.testGps.cleared)).toBe(1);
    await customerPage.locator('#tracking-refresh').click();await expect(customerPage.locator('#tracking-map-panel iframe')).toHaveCount(0);
    await card.locator('[data-delivery-state="en_destino"]').click();await expect(card.locator('a[href^="tel:"]')).toHaveAttribute('href',/^tel:\+?\d+$/);await accessibleAt320(courierPage);
    await card.locator('[data-delivery-state="entregada"]').click();await expect(card).toContainText('Entrega cerrada');await expect(card.locator('a[href^="tel:"]')).toHaveCount(0);await expect(card).not.toContainText('Calle de prueba');
    await customerPage.locator('#tracking-refresh').click();await expect(customerPage.locator('#tracking-content')).toContainText('Entregada');await expect(customerPage.locator('[data-delivery-step="entregada"]')).toHaveAttribute('aria-current','step');expect(mapRequests).toBe(1);
    expect(errors).toEqual([]);
  }finally{await courierContext.close();await customerContext.close();await api(request,'/productos/'+data.product.id,{token:data.admin.token,method:'delete',status:204}).catch(()=>{});}
});

test('seguimiento ajeno no expone datos y una sesión vencida retira contenido y mapa',async({page,request})=>{
  const data=await basicFixture(request);
  const zone=await api(request,'/admin/zonas-entrega',{token:data.admin.token,method:'post',status:201,data:{nombre:'Privacidad '+data.suffix,provincia:'Pichincha',canton:'Puerto Quito',tarifaCentavos:0,ivaCategoria:'general',fundamentoIva:null,activa:true}});
  const order=await newOrder(request,data,zone);
  await page.goto('/seguimiento.html?pedido='+order.id);await expect(page).toHaveURL(/cuenta\.html\?next=/);
  await page.locator('#login-email').fill(data.email);await page.locator('#login-password').fill('ClienteReparto2026!');await page.locator('#login-form [type=submit]').click();
  await expect(page).toHaveURL(new RegExp('/seguimiento\\.html\\?pedido='+order.id+'$'));await expect(page.locator('#tracking-content')).toContainText(order.id.slice(0,8));
  const other=await api(request,'/auth/register',{method:'post',status:201,data:{nombre:'Otra cuenta',email:'otra-'+data.suffix+'@example.ec',telefono:'0979275988',cedula:'0102030400',password:'ClienteReparto2026!'}});
  await signedIn(page,other.token,'/seguimiento.html?pedido='+order.id);await expect(page.locator('#page-status')).toContainText('No se encontró');await expect(page.locator('#tracking-content')).not.toContainText(order.id.slice(0,8));
  await signedIn(page,data.customer.token,'/seguimiento.html?pedido='+order.id);await expect(page.locator('#tracking-content')).toContainText(order.id.slice(0,8));
  await page.route('**/api/pedidos/*/seguimiento',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({ok:false,error:{message:'Sesión vencida'}})}));
  await page.locator('#tracking-refresh').click();await expect(page.locator('#tracking-area')).toBeHidden();await expect(page.locator('#tracking-area')).toBeEmpty();
  await page.goto('/cuenta.html?next='+encodeURIComponent('//destino-ajeno.example/seguimiento.html?pedido='+order.id));
  await page.locator('#login-email').fill(data.email);await page.locator('#login-password').fill('ClienteReparto2026!');await page.locator('#login-form [type=submit]').click();await expect(page).toHaveURL(/\/cuenta\.html$/);
});
