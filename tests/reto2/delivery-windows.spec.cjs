const {test,expect}=require('./browser-fixture.cjs');
const AxeBuilder=require('@axe-core/playwright').default;
const {randomUUID}=require('node:crypto');

async function api(request,path,{token,method='get',data,status=200}={}){
  const response=await request[method]('/api'+path,{headers:token?{Authorization:'Bearer '+token}:{},...(data?{data}:{})});
  expect(response.status(),method+' '+path).toBe(status);return status===204?null:(await response.json()).data;
}
async function signedIn(page,token,path){await page.goto('about:blank');const exchanged=await page.request.post('http://localhost:3300/api/auth/web/exchange',{headers:{Authorization:'Bearer '+token,Origin:'http://localhost:3300','X-Farmacia-Web':'1'},data:{}});expect(exchanged.status()).toBe(200);await page.goto(path);}
async function basicFixture(request){
  const admin=await api(request,'/auth/login',{method:'post',data:{email:'admin-browser@example.ec',password:'AdminBrowser2026!'}});
  const suffix=randomUUID().slice(0,8),email='cliente-entregas-'+suffix+'@example.ec';
  const customer=await api(request,'/auth/register',{method:'post',status:201,data:{nombre:'Cliente Reparto',email,telefono:'0979275988',cedula:'0102030400',password:'ClienteReparto2026!'}});
  const product=await api(request,'/productos',{token:admin.token,method:'post',status:201,data:{nombre:'Artículo de reparto '+suffix,precio:5,stock:10,categoria:'cuidado',descripcion:'Artículo sintético para comprobar entregas privadas',imagen:'assets/images/producto-vitaminas.jpg',alt:'Artículo de prueba',descuentoPorcentaje:0,ivaCategoria:'general',tipoProducto:'cuidado',requiereReceta:false,stockMinimo:1}});
  return {admin,customer,product,suffix,email};
}
async function newOrder(request,data,zone,{prepare=true}={}){
  let order=await api(request,'/pedidos',{token:data.customer.token,method:'post',status:201,data:{carrito:[{productoId:data.product.id,cantidad:1}],comprador:{name:'Cliente de prueba',email:data.email,phone:'0979275988',documentType:'cedula',document:'0102030400',delivery:'delivery',province:'Pichincha',city:'Puerto Quito',address:'Calle de prueba 123 frente al parque',postalCode:'170950',zonaEntregaId:zone.id,esperadoTarifaVersion:zone.version,latitudEntrega:0.125,longitudEntrega:-79.25,consienteUbicacion:true},claveSolicitud:randomUUID()}});
  if(prepare)for(const estado of ['confirmado','preparado'])order=await api(request,'/pedidos/'+order.id+'/estado',{token:data.admin.token,method:'put',data:{estado,esperadoUpdatedAt:order.updatedAt}});
  return order;
}
async function accessibleAt320(page){
  await page.setViewportSize({width:320,height:950});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(audit.violations.map(issue=>({id:issue.id,targets:issue.nodes.map(node=>node.target)}))).toEqual([]);
}

test('código privado e incidencias permiten cierre accesible sin filtrar el código al repartidor',async({page,request,browser},testInfo)=>{
 const data=await basicFixture(request),email='codigo-courier-'+data.suffix+'@example.ec',password='RepartidorPrueba2026!';
 const driver=await api(request,'/admin/repartidores',{token:data.admin.token,method:'post',status:201,data:{nombre:'Repartidor Código',email,telefono:'0979275988',password}});
 const zone=await api(request,'/admin/zonas-entrega',{token:data.admin.token,method:'post',status:201,data:{nombre:'Zona Código '+data.suffix,provincia:'Pichincha',canton:'Puerto Quito',tarifaCentavos:0,ivaCategoria:'general',fundamentoIva:null,activa:true}}),order=await newOrder(request,data,zone);
 let item=await api(request,'/entregas/asignar',{token:data.admin.token,method:'post',data:{pedidoId:order.id,repartidorId:driver.id}}),session=await api(request,'/auth/login',{method:'post',data:{email,password}});
 for(const estado of ['en_camino','en_destino'])item=await api(request,'/entregas/'+item.id+'/estado',{token:session.token,method:'put',data:{estado,esperadoVersion:item.version}});
 await api(request,'/entregas/'+item.id+'/ubicacion',{token:session.token,method:'put',data:{latitud:.12,longitud:-79.24,precision:12,registradaAt:new Date().toISOString(),esperadoGpsVersion:item.gpsVersion}});
 await signedIn(page,data.customer.token,'/seguimiento.html?pedido='+order.id);const code=(await page.locator('[data-delivery-code]').textContent()).trim();expect(code).toMatch(/^\d{6}$/);await expect(page.locator('#tracking-content')).toContainText('Llegada estimada');
 const context=await browser.newContext({baseURL:'http://localhost:3300',viewport:{width:320,height:850}}),courier=await context.newPage();
 try{
  await signedIn(courier,session.token,'/entregas.html');const card=courier.locator('[data-delivery="'+item.id+'"]');await expect(card.locator('[data-delivery-code]')).toHaveCount(0);
  await card.getByRole('button',{name:'Reportar incidencia'}).click();await courier.getByLabel('Observación para el cliente').fill('El acceso principal está temporalmente cerrado.');await courier.locator('.delivery-progress-dialog [type=submit]').click();await expect(card).toContainText('El acceso principal');
  await page.locator('#tracking-refresh').click();await expect(page.locator('#tracking-content')).toContainText('El acceso principal');await expect(page.locator('#tracking-content')).toContainText('Pendiente de resolver');
  await card.getByRole('button',{name:'Marcar resuelta'}).click();await expect(card).toContainText('Resuelta');
  await card.getByRole('button',{name:'Pedido entregado',exact:true}).click();const field=courier.getByLabel('Código de entrega de 6 dígitos');await expect(field).toBeFocused();
  await field.fill(code==='000000'?'000001':'000000');await field.press('Enter');await expect(courier.locator('#delivery-progress-error')).toContainText('no coincide');await expect(field).toBeFocused();
  await accessibleAt320(courier);await courier.screenshot({path:testInfo.outputPath('entrega-codigo-dialogo.png'),fullPage:true});
  await field.fill(code);await field.press('Enter');await expect(card).toContainText('Entrega cerrada');await expect(courier.locator('.delivery-progress-dialog')).toHaveCount(0);
  await page.locator('#tracking-refresh').click();await expect(page.locator('[data-delivery-code]')).toHaveCount(0);await expect(page.locator('#tracking-content')).toContainText('Entregada');await expect(page.locator('#tracking-content')).toContainText('Resuelta');
 }finally{await context.close();}
});

test('un pedido pendiente a domicilio permite confirmar y asignar sin adelantar su salida',async({page,request},testInfo)=>{
  const data=await basicFixture(request);
  const zone=await api(request,'/admin/zonas-entrega',{token:data.admin.token,method:'post',status:201,data:{nombre:'Zona pendiente '+data.suffix,provincia:'Pichincha',canton:'Puerto Quito',tarifaCentavos:200,ivaCategoria:'general',fundamentoIva:null,activa:true}});
  const courier=await api(request,'/admin/repartidores',{token:data.admin.token,method:'post',status:201,data:{nombre:'Repartidor Pendiente',email:'pendiente-'+data.suffix+'@example.ec',telefono:'0979275988',password:'RepartidorPrueba2026!'}});
  await api(request,'/admin/repartidores',{token:data.admin.token,method:'post',status:201,data:{nombre:'Repartidor Alternativo',email:'alternativo-'+data.suffix+'@example.ec',telefono:'0979275988',password:'RepartidorPrueba2026!'}});
  const order=await newOrder(request,data,zone,{prepare:false});
  await signedIn(page,data.admin.token,'/entregas.html');
  await expect(page.locator('#delivery-order-select option[value="'+order.id+'"]')).toHaveCount(1);
  await page.locator('#delivery-order-select').selectOption(order.id);await page.locator('#delivery-courier-select').selectOption(courier.id);
  const submit=page.locator('#delivery-assignment-form [type=submit]');
  await page.locator('#delivery-assignment').screenshot({path:'.superpowers/sdd/2026-11-03-asignacion/asignacion-'+testInfo.project.name+'.png'});
  await expect(submit).toHaveText('Confirmar y asignar entrega');await submit.click();
  await expect(page.locator('#confirm-dialog')).toBeVisible();await page.locator('#confirm-dialog [value=cancel]').click();
  let saved=await api(request,'/pedidos/mis-pedidos',{token:data.customer.token});
  expect(saved.items.find(item=>item.id===order.id).estado).toBe('pendiente');
  expect((await api(request,'/entregas',{token:data.admin.token})).items.some(item=>item.pedidoId===order.id)).toBe(false);
  await submit.focus();await page.keyboard.press('Enter');await page.locator('#confirm-dialog [value=confirm]').click();
  const card=page.locator('[data-delivery]').filter({hasText:order.id.slice(0,8)});
  await expect(card).toContainText('Confirmado');await expect(card.getByRole('button',{name:'Iniciar recorrido'})).toBeDisabled();
  saved=await api(request,'/pedidos/mis-pedidos',{token:data.customer.token});
  const confirmed=saved.items.find(item=>item.id===order.id);expect(confirmed.estado).toBe('confirmado');expect(confirmed.total).toBe(order.total);expect(confirmed.costoEnvioCentavos).toBe(order.costoEnvioCentavos);
  const assigned=(await api(request,'/entregas',{token:data.admin.token})).items.find(item=>item.pedidoId===order.id);expect(assigned.repartidorId).toBe(courier.id);
  const courierSession=await api(request,'/auth/login',{method:'post',data:{email:'pendiente-'+data.suffix+'@example.ec',password:'RepartidorPrueba2026!'}});
  await signedIn(page,courierSession.token,'/entregas.html');await expect(page.locator('[data-delivery="'+assigned.id+'"]')).toContainText(order.id.slice(0,8));
  await expect(page.getByRole('button',{name:'Ver ruta en la app'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Iniciar recorrido'})).toBeDisabled();
  const route=page.getByRole('button',{name:'Ver ruta en la app'});await route.click();await expect(page.locator('#courier-route-panel')).toBeVisible();await expect(route).toBeEnabled();
  await page.locator('#courier-route-close').focus();await page.keyboard.press('Enter');await expect(page.locator('#courier-route-panel')).toBeHidden();await expect(route).toBeFocused();
  await accessibleAt320(page);
});

test('pedidos de administración enlaza la asignación del pedido seleccionado aunque esté en otra página',async({page,request})=>{
  const data=await basicFixture(request);
  const zone=await api(request,'/admin/zonas-entrega',{token:data.admin.token,method:'post',status:201,data:{nombre:'Zona enlace '+data.suffix,provincia:'Pichincha',canton:'Puerto Quito',tarifaCentavos:150,ivaCategoria:'general',fundamentoIva:null,activa:true}});
  const order=await newOrder(request,data,zone,{prepare:false});
  // Put the target outside the first assignment page without creating business records.
  await page.route('**/api/admin/tablas?tabla=pedidos*',async route=>{
    const url=new URL(route.request().url()),current=Number(url.searchParams.get('page')||1);
    const filler={...order,id:'retired-fixture',estado:'entregado'};
    await route.fulfill({json:{ok:true,data:{items:current===1?[filler]:[order],total:21,page:current,pageSize:20}}});
  });
  await signedIn(page,data.admin.token,'/admin.html?tabla=pedidos');
  await page.locator('#admin-next').click();
  const link=page.getByRole('link',{name:'Asignar repartidor',exact:true});await expect(link).toHaveAttribute('href','entregas.html?pedido='+order.id);
  await link.click();await expect(page.locator('#delivery-order-select')).toHaveValue(order.id);
  await expect(page.locator('#delivery-orders-info')).toContainText('Página 2');
  await expect(page.locator('#delivery-assignment-form [type=submit]')).toHaveText('Confirmar y asignar entrega');
  await page.context().clearCookies();await page.reload();
  await expect(page).toHaveURL(/cuenta\.html\?next=/);
  await page.locator('#login-email').fill('admin-browser@example.ec');await page.locator('#login-password').fill('AdminBrowser2026!');await page.locator('#login-form [type=submit]').click();
  await expect(page.locator('#delivery-order-select')).toHaveValue(order.id);
  await accessibleAt320(page);
});

test('actualizar conserva el pedido de una reasignación fuera de la página del selector',async({page,request})=>{
  const data=await basicFixture(request);
  const zone=await api(request,'/admin/zonas-entrega',{token:data.admin.token,method:'post',status:201,data:{nombre:'Zona reasignación '+data.suffix,provincia:'Pichincha',canton:'Puerto Quito',tarifaCentavos:150,ivaCategoria:'general',fundamentoIva:null,activa:true}});
  const order=await newOrder(request,data,zone);
  const courier=await api(request,'/admin/repartidores',{token:data.admin.token,method:'post',status:201,data:{nombre:'Repartidor Reasignación',email:'reasignar-'+data.suffix+'@example.ec',telefono:'0979275988',password:'RepartidorPrueba2026!'}});
  const delivery=await api(request,'/entregas/asignar',{token:data.admin.token,method:'post',data:{pedidoId:order.id,repartidorId:courier.id}});
  let name='Otro pedido';
  await page.route('**/api/admin/tablas?tabla=pedidos*',route=>route.fulfill({json:{ok:true,data:{items:[{...order,id:'pickup-fixture',entrega:'pickup',nombre:name}],total:1,page:1,pageSize:20}}}));
  await signedIn(page,data.admin.token,'/entregas.html');
  await page.locator('[data-delivery="'+delivery.id+'"] [data-delivery-reassign]').click();
  await expect(page.locator('#delivery-order-select')).toHaveValue(order.id);
  name='Datos actualizados';await page.locator('#deliveries-refresh').click();
  await expect(page.locator('#delivery-order-select')).toHaveValue(order.id);await expect(page.locator('#delivery-courier-select')).toHaveValue(courier.id);
});

test('actualizar entregas incorpora pedidos confirmados y repartidores nuevos sin perder selecciones ni borradores',async({page,request})=>{
  const data=await basicFixture(request),zoneInput={nombre:'Zona inicial '+data.suffix,provincia:'Pichincha',canton:'Puerto Quito',tarifaCentavos:225,ivaCategoria:'general',fundamentoIva:null,activa:true};
  const zone=await api(request,'/admin/zonas-entrega',{token:data.admin.token,method:'post',status:201,data:zoneInput});
  const courierInput={nombre:'Repartidor Inicial',email:'inicial-'+data.suffix+'@example.ec',telefono:'0979275988',password:'RepartidorPrueba2026!'};
  const courier=await api(request,'/admin/repartidores',{token:data.admin.token,method:'post',status:201,data:courierInput});
  const order=await newOrder(request,data,zone);
  let pendingOrder=await newOrder(request,data,zone,{prepare:false}),orderPage=1;
  while(true){const result=await api(request,'/admin/tablas?tabla=pedidos&page='+orderPage+'&pageSize=20',{token:data.admin.token});if(result.items.some(item=>item.id===pendingOrder.id))break;expect(orderPage*20).toBeLessThan(result.total);orderPage++;}
  try{
    await signedIn(page,data.admin.token,'/entregas.html');
    await expect(page.locator('#delivery-orders-info')).toContainText('Página 1 ·');
    for(let current=1;current<orderPage;current++){await page.locator('#delivery-orders-next').click();await expect(page.locator('#delivery-orders-info')).toContainText('Página '+(current+1)+' ·');}
    const selectedOrder=await page.locator('#delivery-order-select option').evaluateAll((options,preferred)=>options.find(option=>option.value===preferred)?.value||options.find(option=>option.value)?.value||'',order.id);
    await page.locator('#delivery-order-select').selectOption(selectedOrder);await page.locator('#delivery-courier-select').selectOption(courier.id);
    await page.locator('#delivery-zone-editor summary').click();await page.locator('#delivery-zone-name').fill('Borrador sin guardar');
    await page.locator('#courier-form').locator('..').locator('summary').click();await page.locator('#courier-name').fill('Nombre pendiente');
    const initialPage=await page.locator('#delivery-orders-info').textContent();
    const addedZone=await api(request,'/admin/zonas-entrega',{token:data.admin.token,method:'post',status:201,data:{...zoneInput,nombre:'Zona nueva '+data.suffix}});
    const addedCourier=await api(request,'/admin/repartidores',{token:data.admin.token,method:'post',status:201,data:{...courierInput,nombre:'Repartidor Nuevo',email:'nuevo-'+data.suffix+'@example.ec'}});
    for(const estado of ['confirmado','preparado'])pendingOrder=await api(request,'/pedidos/'+pendingOrder.id+'/estado',{token:data.admin.token,method:'put',data:{estado,esperadoUpdatedAt:pendingOrder.updatedAt}});
    await expect(page.locator('#delivery-order-select option[value="'+pendingOrder.id+'"]')).toContainText('Preparado',{timeout:10000});
    await page.locator('#deliveries-refresh').focus();await page.keyboard.press('Enter');
    await expect(page.locator('#delivery-order-select option[value="'+pendingOrder.id+'"]')).toHaveCount(1);
    await expect(page.locator('#delivery-courier-select option[value="'+addedCourier.id+'"]').first()).toHaveCount(1);
    await expect(page.locator('[data-zone-edit="'+addedZone.id+'"]')).toBeVisible();
    await expect(page.locator('#delivery-order-select')).toHaveValue(selectedOrder);await expect(page.locator('#delivery-courier-select')).toHaveValue(courier.id);
    await expect(page.locator('#delivery-zone-name')).toHaveValue('Borrador sin guardar');await expect(page.locator('#courier-name')).toHaveValue('Nombre pendiente');
    await expect(page.locator('#delivery-zone-editor')).toHaveAttribute('open','');
    expect((await page.locator('#delivery-orders-info').textContent()).split(' · ')[0]).toBe(initialPage.split(' · ')[0]);
  }finally{await api(request,'/productos/'+data.product.id,{token:data.admin.token,method:'delete',status:204}).catch(()=>{});}
});

test('administración configura reparto, cliente consulta mapa voluntario y repartidor comparte GPS, llega, llama y finaliza',async({page,browser,request})=>{
  const data=await basicFixture(request),courierEmail='repartidor-'+data.suffix+'@example.ec',errors=[];page.on('pageerror',error=>errors.push(error.message));
  const courierContext=await browser.newContext(),customerContext=await browser.newContext();
  try{
    await signedIn(page,data.admin.token,'/entregas.html');await expect(page.locator('#delivery-admin')).toBeVisible();
    await page.locator('#delivery-zone-editor summary').click();
    await page.locator('#delivery-zone-name').fill('Prueba reparto '+data.suffix);await page.locator('#delivery-zone-price').fill('2.25');await page.locator('#delivery-zone-form [type=submit]').focus();await page.keyboard.press('Enter');
    await expect(page.locator('#delivery-zones-list')).toContainText('Prueba reparto '+data.suffix);
    const zone=(await api(request,'/admin/zonas-entrega',{token:data.admin.token})).find(item=>item.nombre==='Prueba reparto '+data.suffix);expect(zone.tarifaCentavos).toBe(225);
    await expect(page.locator('#delivery-zones-list code').filter({hasText:zone.id})).toBeVisible();
    await page.locator('#courier-form').locator('..').locator('summary').click();
    await page.locator('#courier-name').fill('Repartidor de Prueba');await page.locator('#courier-email').fill(courierEmail);await page.locator('#courier-phone').fill('0979275988');await page.locator('#courier-password').fill('RepartidorPrueba2026!');
    const createdCourier=page.waitForResponse(response=>response.request().method()==='POST' && new URL(response.url()).pathname==='/api/admin/repartidores');await page.locator('#courier-form [type=submit]').click();
    const courierResponse=await createdCourier;expect(courierResponse.status()).toBe(201);const courier=(await courierResponse.json()).data;await expect(page.locator('[data-courier-toggle="'+courier.id+'"]')).toBeVisible();
    await expect(page.locator('#couriers-list code').filter({hasText:courier.id})).toBeVisible();
    await page.locator('[data-courier-toggle="'+courier.id+'"]').click();await expect(page.locator('[data-courier-toggle="'+courier.id+'"]')).toHaveText(/Activar/);
    await page.locator('[data-courier-toggle="'+courier.id+'"]').click();await expect(page.locator('[data-courier-toggle="'+courier.id+'"]')).toHaveText(/Desactivar/);
    const order=await newOrder(request,data,zone);expect(order.costoEnvioCentavos).toBe(225);expect(Number(order.total)).toBe(7.25);
    await page.reload();await expect(page.locator('#delivery-orders-info')).toContainText('Página');
    while(await page.locator('#delivery-order-select option[value="'+order.id+'"]').count()===0){const before=await page.locator('#delivery-orders-info').textContent();await expect(page.locator('#delivery-orders-next')).toBeEnabled();await page.locator('#delivery-orders-next').click();await expect(page.locator('#delivery-orders-info')).not.toHaveText(before);}
    await page.getByText('Códigos de pedidos para Farmi',{exact:true}).click();await expect(page.locator('#delivery-order-codes code').filter({hasText:order.id})).toBeVisible();
    await page.locator('#delivery-order-select').selectOption(order.id);await page.locator('#delivery-courier-select').selectOption(courier.id);await page.locator('#delivery-assignment-form [type=submit]').click();
    const adminCard=page.locator('[data-delivery]').filter({hasText:order.id.slice(0,8)});await expect(adminCard).toContainText('Asignada');
    await adminCard.locator('summary').click();await expect(adminCard.locator('code').filter({hasText:order.id})).toBeVisible();await expect(adminCard.locator('code').filter({hasText:courier.id})).toBeVisible();
    await expect(adminCard.locator('code').filter({hasText:await adminCard.getAttribute('data-delivery')})).toBeVisible();
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
    // Mi cuenta conserva el perfil editable del personal; Mis entregas abre su bandeja.
    await courierPage.getByRole('link',{name:'Mis entregas',exact:true}).first().click();
    await expect(courierPage).toHaveURL(/\/entregas\.html$/);await expect(courierPage.locator('#delivery-admin')).toBeHidden();
    const card=courierPage.locator('[data-delivery]').filter({hasText:order.id.slice(0,8)});await expect(card).toBeVisible();await expect(card.locator('a[href^="tel:"]')).toHaveCount(0);await expect(card.getByRole('button',{name:'Ver ruta en la app'})).toBeVisible();
    expect(await courierPage.evaluate(()=>window.testGps.callback)).toBeNull();
    let gpsRequests=0;courierPage.on('request',req=>{if(req.method()==='PUT' && /\/entregas\/[^/]+\/ubicacion$/.test(new URL(req.url()).pathname))gpsRequests++;});
    await card.locator('[data-delivery-state="en_camino"]').click();await expect(card).toContainText('En camino');
    await courierPage.evaluate(()=>window.testGps.callback({coords:{latitude:0.12,longitude:-79.24,accuracy:18},timestamp:Date.now()}));await expect(courierPage.locator('#delivery-gps-status')).toContainText('Ubicación compartida');
    await adminCard.locator('summary').focus();await page.bringToFront();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(adminCard).toContainText('En camino');await expect(adminCard.locator('details')).toHaveAttribute('open','');await expect(adminCard.locator('summary')).toBeFocused();
    await courierPage.evaluate(()=>window.testGps.callback({coords:{latitude:0.121,longitude:-79.241,accuracy:18},timestamp:Date.now()}));expect(gpsRequests).toBe(1);
    await customerPage.locator('#tracking-refresh').click();await expect(customerPage.locator('#tracking-location')).toContainText('18 metros');expect(mapRequests).toBe(0);
    await customerPage.locator('#tracking-map-load').focus();await customerPage.keyboard.press('Enter');await expect(customerPage.locator('#tracking-map-panel iframe')).toBeVisible();await expect.poll(()=>mapRequests).toBe(1);
    const frame=await customerPage.locator('#tracking-map-panel iframe').elementHandle();await customerPage.locator('#tracking-refresh').click();expect(await frame.evaluate(node=>node.isConnected)).toBe(true);expect(mapRequests).toBe(1);
    await expect(customerPage.locator('#tracking-google-map')).toHaveAttribute('href',/www.google.com\/maps\/search/);await accessibleAt320(customerPage);
    await card.locator('[data-delivery-gps]').click();await expect(courierPage.locator('#delivery-gps-status')).toContainText('retirada del servidor');await expect.poll(()=>courierPage.evaluate(()=>window.testGps.cleared)).toBe(1);
    await customerPage.locator('#tracking-refresh').click();await expect(customerPage.locator('#tracking-map-panel iframe')).toHaveCount(0);
    await card.locator('[data-delivery-state="en_destino"]').click();await expect(card.locator('a[href^="tel:"]')).toHaveAttribute('href',/^tel:\+?\d+$/);await accessibleAt320(courierPage);
    const deliveryCode=await customerPage.locator('[data-delivery-code]').textContent();await card.locator('[data-delivery-state="entregada"]').click();await courierPage.getByLabel('Código de entrega de 6 dígitos').fill(deliveryCode);await courierPage.locator('.delivery-progress-dialog [type=submit]').click();await expect(card).toContainText('Entrega cerrada');await expect(card.locator('a[href^="tel:"]')).toHaveCount(0);await expect(card).not.toContainText('Calle de prueba');
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
  await api(request,'/auth/logout',{token:data.customer.token,method:'post',status:204});
  await page.route('**/api/pedidos/*/seguimiento',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({ok:false,error:{message:'Sesión vencida'}})}));
  await page.locator('#tracking-refresh').click();await expect(page.locator('#tracking-area')).toBeHidden();await expect(page.locator('#tracking-area')).toBeEmpty();
  await page.goto('/cuenta.html?next='+encodeURIComponent('//destino-ajeno.example/seguimiento.html?pedido='+order.id));
  await page.locator('#login-email').fill(data.email);await page.locator('#login-password').fill('ClienteReparto2026!');await page.locator('#login-form [type=submit]').click();await expect(page).toHaveURL(/\/cuenta\.html$/);
});
