const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const {randomUUID}=require('node:crypto');

test('envío del comprobante informa desactivación, aceptación y fallo sin perder el pedido',async({page,request})=>{
 const data=await fixture(request);await openOrders(page,data.user);await page.locator('[data-order-receipt="'+data.order.id+'"]').click();
 const button=page.locator('[data-receipt-email]'),status=page.locator('[data-receipt-email-status]');
 await button.focus();await page.keyboard.press('Enter');await expect(status).toContainText('todavía no está habilitado');await expect(button).toBeEnabled();
 await page.route('**/api/pedidos/'+data.order.id+'/correo',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:{status:'accepted'}})}));await button.click();await expect(status).toContainText('proveedor aceptó');
 await page.unroute('**/api/pedidos/'+data.order.id+'/correo');await page.route('**/api/pedidos/'+data.order.id+'/correo',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:{message:'Servicio temporalmente no disponible.'}})}));await button.click();await expect(status).toContainText('Servicio temporalmente');await expect(button).toBeEnabled();await expect(page.locator('.order-receipt-sheet')).toContainText(data.product.nombre);
});

async function fixture(request){
  const login=await request.post('/api/auth/login',{data:{email:'admin-browser@example.ec',password:'AdminBrowser2026!'}});expect(login.status()).toBe(200);
  const headers={Authorization:'Bearer '+(await login.json()).data.token},tag=randomUUID().slice(0,8);
  const registered=await request.post('/api/auth/register',{data:{nombre:'Cliente Comprobante',email:'comprobante-'+tag+'@example.ec',telefono:'0979275988',cedula:'0102030400',password:'ComprobantePrueba2026!'}});expect(registered.status()).toBe(201);const user=(await registered.json()).data;
  const created=await request.post('/api/productos',{headers,data:{nombre:'Cuidado personal '+tag,precio:11.5,stock:5,categoria:'cuidado',descripcion:'Artículo sintético para comprobar mapa y documento en la base temporal.',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase sintético de cuidado personal',tipoProducto:'cuidado',ivaCategoria:'general',requiereReceta:false}});expect(created.status()).toBe(201);const product=(await created.json()).data;
  const zoneData={nombre:'Puerto Quito '+tag,provincia:'Pichincha',canton:'Puerto Quito',tarifaCentavos:250,ivaCategoria:'general',fundamentoIva:null,activa:true};
  const zoned=await request.post('/api/admin/zonas-entrega',{headers,data:zoneData});expect(zoned.status()).toBe(201);const zone=(await zoned.json()).data;
  const ordered=await request.post('/api/pedidos',{headers:{Authorization:'Bearer '+user.token},data:{claveSolicitud:randomUUID(),carrito:[{productoId:product.id,cantidad:1}],comprador:{name:'Cliente Comprobante',email:user.usuario.email,phone:'0979275988',documentType:'cedula',document:'0102030400',delivery:'delivery',province:'Pichincha',city:'Puerto Quito',address:'Calle Sintética 123 frente al parque',postalCode:'',zonaEntregaId:zone.id,esperadoTarifaVersion:zone.version,latitudEntrega:0.125,longitudEntrega:-79.25,consienteUbicacion:true}}});expect(ordered.status()).toBe(201);const order=(await ordered.json()).data;
  return {user,product,order,headers,async cleanup(){await request.delete('/api/productos/'+product.id,{headers});await request.put('/api/admin/zonas-entrega/'+zone.id,{headers,data:{...zoneData,activa:false,esperadoVersion:zone.version}});}};
}
async function openOrders(page,user){
  await page.addInitScript(token=>{sessionStorage.setItem('farmacia-mvc-token',token);window.documentGpsCalls=0;Object.defineProperty(navigator.geolocation,'getCurrentPosition',{value:()=>{window.documentGpsCalls++;throw new Error('No debe solicitar GPS automáticamente.');}});},user.token);
  await page.goto('/pedidos.html');await expect(page.locator('.order-card')).toHaveCount(1);
}

test('mapa voluntario, comprobante y PDF conservan el pedido y la privacidad',async({page,request},testInfo)=>{
  const data=await fixture(request),errors=[],writes=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(!['GET','HEAD','OPTIONS'].includes(request.method()) && /\/api\/(?:pedidos|pagos)/.test(new URL(request.url()).pathname))writes.push(request.method());});
  let mapReads=0;page.on('request',request=>{if(new URL(request.url()).hostname==='www.openstreetmap.org')mapReads++;});
  await page.route('https://www.openstreetmap.org/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><title>Mapa de prueba externa</title><p>Mapa externo sustituido sólo en la prueba.</p></html>'}));
  try{
    await openOrders(page,data.user);await expect(page.locator('iframe')).toHaveCount(0);expect(mapReads).toBe(0);expect(await page.evaluate(()=>window.documentGpsCalls)).toBe(0);
    const mapButton=page.locator('[data-order-map="'+data.order.id+'"]');await expect(mapButton).toBeVisible();await mapButton.focus();await page.keyboard.press('Enter');
    await expect(page.locator('iframe')).toHaveCount(1);const url=new URL(await page.locator('iframe').getAttribute('src'));expect(url.origin).toBe('https://www.openstreetmap.org');expect(url.searchParams.get('marker')).toBe('0.125,-79.25');expect(mapReads).toBe(1);
    await page.screenshot({path:testInfo.outputPath('pedido-con-mapa.png'),fullPage:true,animations:'disabled'});
    const receipt=page.locator('[data-order-receipt="'+data.order.id+'"]');await receipt.focus();await page.keyboard.press('Enter');const dialog=page.locator('.order-receipt-dialog');await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(data.product.nombre);await expect(dialog).toContainText('14,00');await expect(dialog).toContainText('2,50');await expect(dialog).toContainText('sin validez tributaria');await expect(dialog).not.toContainText('0102030400');await expect(dialog).not.toContainText('Pagado');
    expect((await new AxeBuilder({page}).include('.order-receipt-dialog').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations).toEqual([]);
    expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
    await page.screenshot({path:testInfo.outputPath('comprobante-pantalla.png'),animations:'disabled'});
    await page.evaluate(()=>{window.printCalls=0;window.print=()=>{window.printCalls++;window.dispatchEvent(new Event('beforeprint'));};});await dialog.locator('[data-receipt-print]').click();expect(await page.evaluate(()=>window.printCalls)).toBe(1);await expect(page.locator('.order-receipt-print-root')).toHaveCount(1);
    await page.emulateMedia({media:'print'});await expect(page.locator('.site-header')).toBeHidden();await expect(page.locator('.order-receipt-print-root')).toBeVisible();
    if(testInfo.project.name==='escritorio')await page.pdf({path:testInfo.outputPath('comprobante-pedido.pdf'),format:'A4',preferCSSPageSize:true,printBackground:true});
    await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await page.emulateMedia({media:'screen'});await expect(page.locator('.order-receipt-print-root')).toHaveCount(0);
    await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(receipt).toBeFocused();
    // A long DTO exercises pagination independently of persistence and never creates business records.
    if(testInfo.project.name==='escritorio'){
      const longPage=await page.context().newPage();await longPage.goto('/ayuda.html');await longPage.waitForLoadState('networkidle');await longPage.addStyleTag({url:'/assets/receipts.css'});
      await longPage.evaluate(async order=>{const {orderReceiptView}=await import('/views/receipts.js');const details=Array.from({length:48},(_,index)=>({productoId:'SKU-'+String(index+1).padStart(3,'0'),nombreProducto:'Cuidado personal - presentación con un nombre extenso para comprobar la paginación '+(index+1),cantidad:1,precioUnitario:'1.00',totalLinea:'1.00'}));document.body.innerHTML='<div class="order-receipt-print-root">'+orderReceiptView({...order,id:'QA-PAGINACION',subtotalProductos:48,baseImponible:44.13,ivaMonto:6.37,total:50.5,detalles:details})+'</div>';document.body.className='order-receipt-print';},data.order);
      await longPage.emulateMedia({media:'print'});await expect(longPage.locator('.receipt-lines tbody tr')).toHaveCount(48);await longPage.pdf({path:testInfo.outputPath('comprobante-multipagina.pdf'),format:'A4',preferCSSPageSize:true,printBackground:true});await longPage.close();
    }
    await receipt.click();await expect(page.locator('.order-receipt-dialog')).toBeVisible();
    const cancelled=await request.put('/api/pedidos/'+data.order.id+'/estado',{headers:data.headers,data:{estado:'cancelado',esperadoUpdatedAt:data.order.updatedAt}});expect(cancelled.status()).toBe(200);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('.order-card')).toContainText('Pedido cancelado');await expect(page.locator('.order-receipt-dialog')).toHaveCount(0);await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('[data-order-map]')).toHaveCount(0);expect(writes).toEqual([]);expect(errors).toEqual([]);
  }finally{await data.cleanup();}
});

test('una respuesta tardía de seguimiento no vuelve a mostrar el mapa tras cancelar',async({page,request})=>{
  const data=await fixture(request);let release,received;const gate=new Promise(resolve=>release=resolve),fetched=new Promise(resolve=>received=resolve);
  await page.route('**/api/pedidos/*/seguimiento',async route=>{const response=await route.fetch();received();await gate;await route.fulfill({response});});
  try{
    await openOrders(page,data.user);await page.locator('[data-order-map="'+data.order.id+'"]').click();await fetched;
    const cancelled=await request.put('/api/pedidos/'+data.order.id+'/estado',{headers:data.headers,data:{estado:'cancelado',esperadoUpdatedAt:data.order.updatedAt}});expect(cancelled.status()).toBe(200);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('.order-card')).toContainText('Pedido cancelado');release();await page.waitForLoadState('networkidle');await expect(page.locator('iframe')).toHaveCount(0);await expect(page.locator('[data-order-map]')).toHaveCount(0);
  }finally{release();await data.cleanup();}
});

test('el mapa de confirmación se retira al cancelar desde otra sesión',async({page,request})=>{
  const data=await fixture(request);
  await page.route('https://www.openstreetmap.org/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><title>Mapa externo sustituido</title></html>'}));
  try{
    const exchanged=await page.request.post('/api/auth/web/exchange',{headers:{Authorization:'Bearer '+data.user.token,Origin:'http://localhost:3300','X-Farmacia-Web':'1'},data:{}});expect(exchanged.status()).toBe(200);
    await page.goto('/checkout.html');await expect(page.locator('#screen-controls')).toBeEnabled();
    await expect.poll(()=>page.evaluate(async()=>{const {auth}=await import('/models/auth.js');return auth.user?.id;})).toBe(data.user.usuario.id);
    // Reuse the confirmation component with a real API order; the checkout watcher is now stopped.
    await page.evaluate(async order=>{const {confirmationView}=await import('/views/orders.js');const {connectOrderMaps}=await import('/controllers/order-map.js');confirmationView(order);connectOrderMaps(document.getElementById('order-confirmation'))([order]);},data.order);
    await expect(page.locator('#checkout-content')).toBeHidden();await page.locator('[data-order-map="'+data.order.id+'"]').click();await expect(page.locator('iframe')).toHaveCount(1);
    const cancelled=await request.put('/api/pedidos/'+data.order.id+'/estado',{headers:data.headers,data:{estado:'cancelado',esperadoUpdatedAt:data.order.updatedAt}});expect(cancelled.status()).toBe(200);
    await expect(page.locator('iframe')).toHaveCount(0,{timeout:15000});await expect(page.locator('[data-order-map="'+data.order.id+'"]')).toHaveCount(0);
    await expect(page.locator('[data-order-map-panel="'+data.order.id+'"]')).not.toContainText(/0\.125|-79\.25/);
  }finally{await data.cleanup();}
});
