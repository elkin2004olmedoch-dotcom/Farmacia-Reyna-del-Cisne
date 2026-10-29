const {test,expect}=require('@playwright/test');
const {randomUUID}=require('node:crypto');
const {writeFile}=require('node:fs/promises');

async function api(request,path,{token,method='get',data,status=200}={}){
  const response=await request[method]('/api'+path,{headers:token?{Authorization:'Bearer '+token}:{},...(data?{data}:{})});
  expect(response.status(),method+' '+path).toBe(status);return status===204?null:(await response.json()).data;
}
async function login(page,email,password,destination){
  await page.goto('/cuenta.html');await page.locator('#login-email').fill(email);await page.locator('#login-password').fill(password);await page.locator('#login-form [type=submit]').click();await expect(page).toHaveURL(destination);
}
async function command(page,text,path,method='PUT',status=200){
  const farmi=page.locator('farmacia-admin-companion');
  if(await farmi.locator('#panel').isHidden())await farmi.getByRole('button',{name:'Abrir asistente administrativo'}).click();
  const response=page.waitForResponse(response=>response.request().method()===method && new URL(response.url()).pathname==='/api'+path);
  await farmi.locator('#input').fill(text);await farmi.locator('#form [type=submit]').click();
  const result=await response;expect(result.status()).toBe(status);await expect(farmi.locator('#input')).toBeEnabled();return (await result.json()).data;
}

// Catches broken role handoffs, stale fees, hidden IDs, automatic GPS/map loads and destination leaks after delivery.
test('recorrido visual real: cliente compra, Farmi administra y repartidor completa una entrega privada',async({page,browser,request},testInfo)=>{
  test.setTimeout(180000);
  expect(['localhost','127.0.0.1']).toContain(new URL(testInfo.project.use.baseURL).hostname);
  const suffix=randomUUID().slice(0,8),password='RecorridoSintetico2026!',email='recorrido-'+suffix+'@example.ec',courierEmail='mensajero-'+suffix+'@example.ec';
  const customerContext=await browser.newContext({baseURL:testInfo.project.use.baseURL,viewport:testInfo.project.use.viewport,geolocation:{latitude:0.125,longitude:-79.25,accuracy:15},permissions:['geolocation']});
  const courierContext=await browser.newContext({baseURL:testInfo.project.use.baseURL,viewport:testInfo.project.use.viewport});
  const customer=await customerContext.newPage(),courierPage=await courierContext.newPage(),adminDeliveries=await page.context().newPage();
  const screenshots=[],errors=[],mapNetwork=[],liveMap=process.env.PHARMACY_DEMO_LIVE_MAP==='true';let product,promotion,zone,courier,order,adminToken,mapRequests=0,mapFailure=null;
  const capture=async(subject,name,{viewport=false}={})=>{const path=testInfo.outputPath(name+'.png');if(!viewport)await subject.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,behavior:'instant'});});await subject.screenshot({path,fullPage:!viewport,animations:'disabled'});screenshots.push(path);await testInfo.attach(name,{path,contentType:'image/png'});};
  for(const subject of [page,customer,courierPage,adminDeliveries])subject.on('pageerror',error=>errors.push(error.message));
  customer.on('request',req=>{if(new URL(req.url()).hostname==='www.openstreetmap.org')mapRequests++;});
  customer.on('requestfailed',req=>{if(/openstreetmap/.test(req.url()))mapNetwork.push({url:req.url(),error:req.failure()?.errorText});});
  customer.on('response',response=>{if(/openstreetmap/.test(response.url()))mapNetwork.push({url:response.url(),status:response.status()});});
  if(!liveMap)await customer.route('https://www.openstreetmap.org/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><meta charset="utf-8"><title>Proveedor de mapa sustituido para prueba</title><body style="font:18px system-ui;background:#efe8d5;padding:24px"><h1>Mapa externo: fixture de prueba</h1><p>Coordenadas y GPS sintéticos. La API de la farmacia es real y temporal.</p><p>Última posición simulada: 0.12, −79.24</p></body></html>'}));
  try{
    await login(page,'admin-browser@example.ec','AdminBrowser2026!',/\/admin\.html$/);adminToken=await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'));
    product=await api(request,'/productos',{token:adminToken,method:'post',status:201,data:{nombre:'Cuidado de prueba '+suffix,precio:10,stock:10,categoria:'cuidado',descripcion:'Artículo sintético del recorrido de roles, sin dispensación médica.',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase de prueba del recorrido',ivaCategoria:'general',tipoProducto:'cuidado',requiereReceta:false,stockMinimo:1}});
    zone=await api(request,'/admin/zonas-entrega',{token:adminToken,method:'post',status:201,data:{nombre:'Puerto Quito prueba '+suffix,provincia:'Pichincha',canton:'Puerto Quito',tarifaCentavos:null,ivaCategoria:'general',fundamentoIva:null,activa:true}});
    await customer.goto('/cuenta.html');await customer.locator('#show-register').click();
    for(const [id,value]of Object.entries({nombre:'Cliente de Prueba',email,telefono:'0990000000',cedula:'0102030400',password,confirm:password}))await customer.locator('#register-'+id).fill(value);
    await customer.locator('#register-terms').check();await customer.locator('#register-form [type=submit]').click();await expect(customer.locator('#account-area')).toContainText('Hola, Cliente de Prueba');await capture(customer,'01-cliente-registrado');
    product=await command(page,`Actualiza el precio de "${product.nombre}" a 12.50`,'/productos/'+product.id);expect(Number(product.precio)).toBe(12.5);
    promotion=await command(page,`Publica una promoción de 20% para "${product.nombre}" hasta 2030-12-31 titulada "Recorrido ${suffix}"`,'/promociones','POST',201);
    expect(promotion.descuentoPorcentaje).toBe(20);await expect(page.locator('farmacia-admin-companion #messages')).toContainText('Promoción publicada');await capture(page,'02-farmi-precio-y-promocion');
    await login(adminDeliveries,'admin-browser@example.ec','AdminBrowser2026!',/\/admin\.html$/);await adminDeliveries.goto('/entregas.html');await expect(adminDeliveries.locator('#delivery-zones-list code').filter({hasText:zone.id})).toHaveText(zone.id);
    await adminDeliveries.locator('#courier-form').locator('..').locator('summary').click();
    for(const [id,value]of Object.entries({name:'Mensajero de Prueba',email:courierEmail,phone:'0990000000',password}))await adminDeliveries.locator('#courier-'+id).fill(value);
    const createdCourier=adminDeliveries.waitForResponse(response=>response.request().method()==='POST' && new URL(response.url()).pathname==='/api/admin/repartidores');await adminDeliveries.locator('#courier-form [type=submit]').click();const courierResponse=await createdCourier;expect(courierResponse.status()).toBe(201);courier=(await courierResponse.json()).data;
    await expect(adminDeliveries.locator('#couriers-list code').filter({hasText:courier.id})).toHaveText(courier.id);await capture(adminDeliveries,'03-admin-zona-pendiente-y-repartidor');
    await customer.goto('/catalogo.html');await customer.locator('#catalog-search').fill(product.nombre);const card=customer.locator('.featured-card').filter({hasText:product.nombre});await expect(card.locator('.promotion-ribbon')).toContainText('20%');await expect(card).toContainText('10,00');
    await card.locator('[data-add]').click();await expect(customer.locator('#cart-dock')).toBeVisible();await expect(customer.locator('#cart-dock-summary')).toContainText('1 unidad');await capture(customer,'04-catalogo-descuento-y-barra-inferior');
    await customer.locator('#cart-dock a').click();await expect(customer).toHaveURL(/\/checkout\.html$/);await expect(customer.locator('.checkout-item-image')).toHaveCount(1);expect(await customer.locator('.checkout-item-image').evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);await capture(customer,'05-carrito-con-imagen');
    await customer.locator('#checkout-next').click();await customer.locator('[name=delivery][value=delivery]').check();await customer.locator('#checkout-zone').selectOption(zone.id);
    await customer.locator('#checkout-document').fill('0102030400');await customer.locator('#checkout-address').fill('Calle Sintética 123 frente al parque de Puerto Quito');await customer.locator('#checkout-terms').check();
    await expect(customer.locator('#checkout-grand-total')).toHaveText('Por confirmar');await expect(customer.locator('#delivery-form [type=submit]')).toBeDisabled();await capture(customer,'06-checkout-tarifa-pendiente');
    zone=await command(page,`Modifica zona "${zone.id}": tarifaCentavos=250`,'/admin/zonas-entrega/'+zone.id);expect(zone.tarifaCentavos).toBe(250);
    await customer.locator('#checkout-refresh-zone').click();await expect(customer.locator('#checkout-grand-total')).toContainText('12,50');await expect(customer.locator('#delivery-form [type=submit]')).toBeEnabled();await capture(customer,'07-tarifa-actualizada-y-total');
    zone=await command(page,`Modifica zona "${zone.id}": tarifaCentavos=300`,'/admin/zonas-entrega/'+zone.id);
    const stale=customer.waitForResponse(response=>response.request().method()==='POST' && new URL(response.url()).pathname==='/api/pedidos');await customer.locator('#delivery-form [type=submit]').click();expect((await stale).status()).toBe(409);await expect(customer.locator('#page-status')).toContainText('tarifa de entrega cambió');await expect(customer.locator('#checkout-grand-total')).toContainText('13,00');
    await customer.locator('#checkout-use-location').click();await expect(customer.locator('#checkout-location-status')).toContainText('Punto añadido');
    const confirmed=customer.waitForResponse(response=>response.request().method()==='POST' && new URL(response.url()).pathname==='/api/pedidos');await customer.locator('#delivery-form [type=submit]').click();const ordered=await confirmed;expect(ordered.status()).toBe(201);order=(await ordered.json()).data;
    expect(order.costoEnvioCentavos).toBe(300);expect(Number(order.subtotalProductos)).toBe(10);expect(Number(order.total)).toBe(13);await expect(customer.locator('#order-confirmation')).toContainText('Envío');await capture(customer,'08-pedido-real-confirmado');
    for(const state of ['confirmado','preparado']){const changed=await command(page,`Cambia pedido "${order.id}" a ${state}`,'/pedidos/'+order.id+'/estado');expect(changed.estado).toBe(state);}
    await adminDeliveries.locator('#deliveries-refresh').click();await expect(adminDeliveries.locator('#page-status')).toContainText('Bandeja actualizada');
    while(await adminDeliveries.locator('#delivery-order-select option[value="'+order.id+'"]').count()===0){const before=await adminDeliveries.locator('#delivery-orders-info').textContent();await expect(adminDeliveries.locator('#delivery-orders-next')).toBeEnabled();await adminDeliveries.locator('#delivery-orders-next').click();await expect(adminDeliveries.locator('#delivery-orders-info')).not.toHaveText(before);}
    await adminDeliveries.locator('#delivery-order-select').selectOption(order.id);await adminDeliveries.getByText('Códigos de pedidos para Farmi',{exact:true}).click();await expect(adminDeliveries.locator('#delivery-order-codes code').filter({hasText:order.id})).toBeVisible();
    const assigned=await command(page,`Asigna pedido "${order.id}" a repartidor "${courier.id}"`,'/entregas/asignar','POST');expect(assigned.repartidorId).toBe(courier.id);
    await adminDeliveries.locator('#deliveries-refresh').click();const assignedCard=adminDeliveries.locator('[data-delivery="'+assigned.id+'"]').first();await expect(assignedCard).toContainText('Asignada');await assignedCard.locator('summary').click();await expect(assignedCard.locator('code').filter({hasText:assigned.id})).toBeVisible();await capture(adminDeliveries,'09-pedido-y-repartidor-asignados-por-farmi');
    await courierPage.addInitScript(()=>{window.demoGps={callback:null,watches:0,cleared:0};Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(callback){window.demoGps.callback=callback;window.demoGps.watches++;return 7;},clearWatch(){window.demoGps.cleared++;}}});});
    await login(courierPage,courierEmail,password,/\/entregas\.html$/);await expect(courierPage.locator('#delivery-admin')).toBeHidden();const delivery=courierPage.locator('[data-delivery="'+assigned.id+'"]');await expect(delivery).toBeVisible();await expect(delivery.locator('a[href^="tel:"]')).toHaveCount(0);await expect(delivery.locator('a[href^="https://www.google.com/maps/dir/"]')).toHaveAttribute('href',/destination=0.125%2C-79.25/);expect(await courierPage.evaluate(()=>window.demoGps.watches)).toBe(0);
    await customer.locator('#order-confirmation a[href^="seguimiento.html?pedido="]').click();await expect(customer.locator('#tracking-content')).toContainText('Asignada');expect(mapRequests).toBe(0);await expect(customer.locator('#tracking-map-panel iframe')).toHaveCount(0);
    await delivery.locator('[data-delivery-state="en_camino"]').click();await expect(delivery).toContainText('En camino');await delivery.locator('[data-delivery-gps]').click();await expect.poll(()=>courierPage.evaluate(()=>window.demoGps.watches)).toBe(1);
    await courierPage.evaluate(()=>window.demoGps.callback({coords:{latitude:0.12,longitude:-79.24,accuracy:18},timestamp:Date.now()}));await expect(courierPage.locator('#delivery-gps-status')).toContainText('Ubicación compartida');
    await delivery.locator('[data-delivery-state="en_destino"]').click();await expect(delivery.locator('a[href^="tel:"]')).toHaveAttribute('href',/^tel:\+?\d+$/);await capture(courierPage,'10-repartidor-llegada-google-maps-y-llamada');
    await customer.locator('#tracking-refresh').click();await expect(customer.locator('#tracking-content')).toContainText('En destino');await expect(customer.locator('#tracking-location')).toContainText('18 metros');expect(mapRequests).toBe(0);
    const mapLoaded=liveMap?customer.waitForResponse(response=>response.url().startsWith('https://www.openstreetmap.org/export/embed.html'),{timeout:20000}):null;
    await customer.locator('#tracking-map-load').click();const map=customer.locator('#tracking-map-panel iframe');await expect(map).toBeVisible();await map.scrollIntoViewIfNeeded();
    if(liveMap){try{
      const response=await mapLoaded;expect(response.ok()).toBe(true);
      const surface=customer.frameLocator('#tracking-map-panel iframe').locator('canvas.maplibregl-canvas, img.leaflet-tile-loaded').first();await expect(surface).toBeVisible({timeout:20000});
      const rendered=await surface.evaluate(node=>({renderer:node.tagName==='CANVAS'?'MapLibre':'Leaflet',width:node.width||node.naturalWidth,height:node.height||node.naturalHeight}));expect(rendered.width).toBeGreaterThan(0);expect(rendered.height).toBeGreaterThan(0);
      const loadedTiles=()=>mapNetwork.filter(item=>item.status===200 && /^https:\/\/tile\.openstreetmap\.org\//.test(item.url)).length;await expect.poll(loadedTiles,{timeout:20000}).toBeGreaterThan(0);await customer.waitForLoadState('networkidle',{timeout:20000});mapNetwork.push({domLoaded:true,...rendered,loadedTiles:loadedTiles()});
    }catch(error){mapFailure=error.message;mapNetwork.push({domLoaded:false,error:mapFailure});await testInfo.attach('mapa-real-limitacion',{body:mapFailure,contentType:'text/plain'});}}
    else await expect(customer.frameLocator('#tracking-map-panel iframe').getByRole('heading',{name:'Mapa externo: fixture de prueba'})).toBeVisible();
    expect(mapRequests).toBeGreaterThan(0);await expect(customer.locator('#tracking-google-map')).toHaveAttribute('href',/query=0.12%2C-79.24/);await capture(customer,'11-cliente-seguimiento-privado-mapa-voluntario',{viewport:true});
    await delivery.locator('[data-delivery-state="entregada"]').click();await expect(delivery).toContainText('Entrega cerrada');await expect(delivery.locator('a[href^="tel:"]')).toHaveCount(0);await expect(delivery).not.toContainText('Calle Sintética');await expect.poll(()=>courierPage.evaluate(()=>window.demoGps.cleared)).toBe(1);
    await customer.locator('#tracking-refresh').click();await expect(customer.locator('#tracking-content')).toContainText('Entregada');await expect(customer.locator('#tracking-map-panel iframe')).toHaveCount(0);await expect(customer.locator('[data-delivery-step="entregada"]')).toHaveAttribute('aria-current','step');
    const customerToken=await customer.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'));const tracking=await api(request,'/pedidos/'+order.id+'/seguimiento',{token:customerToken});expect(tracking.entrega.ubicacion).toBeNull();expect(tracking.estadoPedido).toBe('entregado');
    const courierToken=await courierPage.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token')),closed=(await api(request,'/entregas?page=1&pageSize=20',{token:courierToken})).items.find(item=>item.id===assigned.id);expect(closed.destino).toBeNull();expect(closed.ubicacion).toBeNull();await capture(customer,'12-cliente-entrega-cerrada-sin-ubicacion');expect(errors).toEqual([]);if(liveMap)expect(mapFailure,'El mapa externo debe cargar sus teselas reales').toBeNull();
  }finally{
    const cleanup=[];
    for(const [name,operation]of [
      ['promocion',()=>promotion&&api(request,'/promociones/'+promotion.id,{token:adminToken,method:'delete',status:204})],
      ['producto',()=>product&&api(request,'/productos/'+product.id,{token:adminToken,method:'delete',status:204})],
      ['zona',async()=>{if(zone){const current=(await api(request,'/admin/zonas-entrega',{token:adminToken})).find(item=>item.id===zone.id);await api(request,'/admin/zonas-entrega/'+zone.id,{token:adminToken,method:'put',data:{nombre:current.nombre,provincia:current.provincia,canton:current.canton,tarifaCentavos:current.tarifaCentavos,ivaCategoria:current.ivaCategoria,fundamentoIva:current.fundamentoIva,activa:false,esperadoVersion:current.version}});}}],
      ['repartidor',()=>courier&&api(request,'/admin/repartidores/'+courier.id,{token:adminToken,method:'put',data:{activo:false}})],
    ]){try{await operation();cleanup.push({name,ok:true});}catch(error){cleanup.push({name,ok:false,error:error.message});}}
    const evidencePath=testInfo.outputPath('recorrido-evidencia.json');await writeFile(evidencePath,JSON.stringify({entorno:'API localhost y SQLite temporal del browser-server; ningún dato de producción',gps:'Destino y GPS sintéticos; sólo compartidos tras clic explícito. La llamada y Google Maps no se abren.',mapa:liveMap?'Proveedor OpenStreetMap real':'Proveedor OpenStreetMap sustituido por fixture rotulado; sin mock de negocio',productId:product?.id,promotionId:promotion?.id,zoneId:zone?.id,courierId:courier?.id,orderId:order?.id,screenshots,mapNetwork,cleanup,errors},null,2));await testInfo.attach('recorrido-evidencia',{path:evidencePath,contentType:'application/json'});
    await customerContext.close();await courierContext.close();await adminDeliveries.close();
  }
});
