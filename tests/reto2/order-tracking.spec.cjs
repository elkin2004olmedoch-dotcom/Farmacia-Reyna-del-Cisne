const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const {randomUUID}=require('node:crypto');
const stageKeys=['pendiente','confirmado','preparado','entregado'];
async function componentCapture(page,component,path){
  // Oculta el encabezado fijo sólo durante la captura, sin cambiar geometría ni la política CSP.
  const saved=await page.evaluateHandle(()=>[...document.querySelectorAll('.site-header,.shop-header,.skip-link')].map(element=>{
    const value=element.style.getPropertyValue('visibility'),priority=element.style.getPropertyPriority('visibility');
    element.style.setProperty('visibility','hidden','important');return {element,value,priority};
  }));
  try{await component.screenshot({path});}
  finally{await saved.evaluate(records=>records.forEach(({element,value,priority})=>{if(value)element.style.setProperty('visibility',value,priority);else element.style.removeProperty('visibility');}));await saved.dispose();}
}
async function fixture(page,count){
  const staff=await page.request.post('/api/auth/login',{data:{email:'admin-browser@example.ec',password:'AdminBrowser2026!'}});expect(staff.status()).toBe(200);
  const headers={Authorization:'Bearer '+(await staff.json()).data.token};
  const email='seguimiento-'+randomUUID()+'@example.ec',password='ClienteSeguimiento2026!';
  const registered=await page.request.post('/api/auth/register',{data:{nombre:'Cliente Seguimiento',email,telefono:'0979275988',cedula:'0102030400',password}});expect(registered.status()).toBe(201);
  const customer=(await registered.json()).data;
  const createdProduct=await page.request.post('/api/productos',{headers,data:{nombre:'Producto de seguimiento '+randomUUID().slice(0,8),precio:11.5,stock:20,categoria:'cuidado',descripcion:'Artículo sintético para comprobar el seguimiento de pedidos',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase sintético de seguimiento',descuentoPorcentaje:0,ivaCategoria:'general',tipoProducto:'cuidado',requiereReceta:false,stockMinimo:1}});expect(createdProduct.status()).toBe(201);
  const product=(await createdProduct.json()).data,orders=[];
  for(let index=0;index<count;index++){
    const response=await page.request.post('/api/pedidos',{headers:{Authorization:'Bearer '+customer.token},data:{carrito:[{productoId:product.id,cantidad:1}],comprador:{name:'Cliente Seguimiento',email,phone:'0979275988',documentType:'cedula',document:'0102030400',delivery:'pickup',province:'',city:'',address:'',postalCode:''},claveSolicitud:randomUUID()}});expect(response.status()).toBe(201);orders.push((await response.json()).data);
  }
  return {headers,email,password,product,orders,async cleanup(){await page.request.delete('/api/productos/'+product.id,{headers});}};
}
async function change(page,data,index,estado){
  const previous=data.orders[index];const response=await page.request.put('/api/pedidos/'+previous.id+'/estado',{headers:data.headers,data:{estado,esperadoUpdatedAt:previous.updatedAt}});expect(response.status()).toBe(200);data.orders[index]=(await response.json()).data;return data.orders[index];
}
async function login(page,data){await page.goto('/cuenta.html');await page.locator('#login-email').fill(data.email);await page.locator('#login-password').fill(data.password);await page.locator('#login-form [type=submit]').focus();await page.keyboard.press('Enter');await expect(page.locator('#logout')).toBeVisible();await page.goto('/pedidos.html');await expect(page.locator('.order-card')).toHaveCount(data.orders.length);}
const cardFor=(page,order)=>page.locator('.order-card').filter({hasText:'Pedido '+order.id.slice(0,8)});
async function assertStage(card,key){
  const index=stageKeys.indexOf(key);await expect(card.locator('.order-tracking-step[aria-current="step"]')).toHaveCount(1);await expect(card.locator('.order-tracking-step[aria-current="step"]')).toHaveAttribute('data-order-step',key);await expect(card.locator('.order-tracking-step.is-complete')).toHaveCount(index);await expect(card.locator('.order-tracking-step.is-upcoming')).toHaveCount(3-index);
}
async function accessible(page){const issues=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;expect(issues.map(issue=>({id:issue.id,targets:issue.nodes.map(node=>node.target)}))).toEqual([]);}

test('los cuatro estados y cancelación muestran iconos, progreso real y diseño accesible en todos los tamaños',async({page},testInfo)=>{
  const data=await fixture(page,5),errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await change(page,data,1,'confirmado');for(const state of ['confirmado','preparado'])await change(page,data,2,state);for(const state of ['confirmado','preparado','entregado'])await change(page,data,3,state);for(const state of ['confirmado','cancelado'])await change(page,data,4,state);
    await login(page,data);
    for(const [index,key]of stageKeys.entries()){const card=cardFor(page,data.orders[index]);await assertStage(card,key);await expect(card.locator('.order-tracking-step svg')).toHaveCount(4);await expect(card.locator('.order-tracking-step [aria-hidden="true"]')).toHaveCount(4);}
    const cancelled=cardFor(page,data.orders[4]);await expect(cancelled.locator('.order-tracking-cancelled')).toContainText('Pedido cancelado');await expect(cancelled.locator('[aria-current="step"]')).toHaveCount(0);await expect(cancelled.locator('.order-tracking-step.is-complete')).toHaveCount(2);await expect(cancelled.locator('[data-order-step="entregado"]')).toHaveAttribute('data-step-state','stopped');await expect(cancelled.locator('.order-tracking')).not.toContainText('Etapa actual');
    const history=cardFor(page,data.orders[2]).locator('.order-history');const summary=history.locator('summary');await summary.focus();await page.keyboard.press('Enter');await expect(history).toHaveAttribute('open','');await expect(history.locator('ol li')).toHaveCount(3);await page.keyboard.press('Space');await expect(history).not.toHaveAttribute('open','');await expect(summary).toBeFocused();
    await accessible(page);
    for(const width of [320,375,768,1920]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Seguimiento sin desbordamiento a '+width).toBe(false);for(const order of data.orders){const card=cardFor(page,order);const box=await card.locator('.order-tracking').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);}}
    await page.setViewportSize({width:testInfo.project.name==='movil'?375:1920,height:1000});await page.evaluate(()=>document.activeElement?.blur?.());
    await componentCapture(page,cardFor(page,data.orders[2]),'docs/pruebas/reto2/capturas/seguimiento-pedidos-preparado-'+testInfo.project.name+'.png');await componentCapture(page,cancelled,'docs/pruebas/reto2/capturas/seguimiento-pedidos-cancelado-'+testInfo.project.name+'.png');expect(errors).toEqual([]);
  }finally{await data.cleanup();}
});

test('el seguimiento se actualiza cada cinco segundos sin cambiar de ventana y conserva historial abierto y foco',async({page})=>{
  const data=await fixture(page,2),errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.clock.install();await login(page,data);const url=page.url(),card=cardFor(page,data.orders[0]),history=card.locator('.order-history'),summary=history.locator('summary');await assertStage(card,'pendiente');await summary.focus();await page.keyboard.press('Enter');await expect(history).toHaveAttribute('open','');
    await page.evaluate(()=>{window.trackingFocusEvents=0;window.addEventListener('focus',()=>window.trackingFocusEvents++);});
    for(const state of ['confirmado','preparado','entregado']){await change(page,data,0,state);await page.clock.runFor(5000);await assertStage(card,state);await expect(summary).toBeFocused();await expect(history).toHaveAttribute('open','');expect(page.url()).toBe(url);}
    await expect(card.locator('[data-order-step="entregado"]')).toContainText('Finalizado');await expect(card.locator('.order-tracking-note')).toContainText('fue entregado');await expect(history.locator('ol li')).toHaveCount(4);
    const consult=card.locator('[data-order-invoice]'),invoice=card.locator('[role="status"][id^="invoice-"]');await consult.focus();await page.keyboard.press('Enter');await expect(invoice).toContainText('La farmacia todavía no ha creado una factura');await expect(consult).toBeFocused();const invoiceNode=await invoice.elementHandle();
    for(const state of ['confirmado','preparado'])await change(page,data,1,state);const before=(await (await page.request.get('/api/productos/'+data.product.id)).json()).data.stock;await change(page,data,1,'cancelado');await page.clock.runFor(5000);
    const cancelled=cardFor(page,data.orders[1]);await expect(cancelled.locator('.order-tracking-cancelled')).toBeVisible();await expect(cancelled.locator('[aria-current="step"]')).toHaveCount(0);await expect(cancelled.locator('.order-tracking-step.is-complete')).toHaveCount(3);await expect(cancelled.locator('[data-order-step="entregado"]')).toHaveAttribute('data-step-state','stopped');expect((await (await page.request.get('/api/productos/'+data.product.id)).json()).data.stock).toBe(before+1);
    await expect(invoice).toContainText('La farmacia todavía no ha creado una factura');expect(await invoiceNode.evaluate(node=>node.isConnected)).toBe(true);await expect(consult).toBeFocused();await expect(history).toHaveAttribute('open','');expect(await page.evaluate(()=>window.trackingFocusEvents)).toBe(0);await accessible(page);expect(errors).toEqual([]);
  }finally{await data.cleanup();}
});
