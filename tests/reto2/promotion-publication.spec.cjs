const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const {randomUUID}=require('node:crypto');
const money=value=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(value);
async function fixture(page){
  const login=await page.request.post('/api/auth/login',{data:{email:'admin-browser@example.ec',password:'AdminBrowser2026!'}});expect(login.status()).toBe(200);
  const headers={Authorization:'Bearer '+(await login.json()).data.token};
  const product=await page.request.post('/api/productos',{headers,data:{nombre:'Producto promo '+randomUUID().slice(0,8),precio:9.75,stock:20,categoria:'cuidado',descripcion:'Artículo sintético de publicación de campañas',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase de prueba',descuentoPorcentaje:0,ivaCategoria:'general',tipoProducto:'cuidado',requiereReceta:false}});expect(product.status()).toBe(201);
  const item=(await product.json()).data;
  const email='publicacion-'+randomUUID()+'@example.ec',password='PromoCliente2026!';
  const account=await page.request.post('/api/auth/register',{data:{nombre:'Cliente Publicación',email,telefono:'0979275988',cedula:'0102030400',password}});expect(account.status()).toBe(201);
  const customer=(await account.json()).data;
  return {headers,item,email,password,customer,campaignId:null,async cleanup(){if(this.campaignId)await page.request.delete('/api/promociones/'+this.campaignId,{headers});await page.request.delete('/api/productos/'+item.id,{headers});}};
}
async function login(page,email,password){await page.goto('/cuenta.html');await page.locator('#login-email').fill(email);await page.locator('#login-password').fill(password);await page.locator('#login-form [type=submit]').focus();await page.keyboard.press('Enter');await expect(page.locator('#logout')).toBeVisible();}
async function findRow(page,title){
  await expect(page.locator('#admin-create')).toBeEnabled();
  for(let index=0;index<50;index++){const row=page.locator('#admin-table tbody tr').filter({hasText:title});if(await row.count())return row;const next=page.locator('#admin-next');if(await next.isDisabled())break;const current=await page.locator('#admin-page-info').textContent();await next.click();await expect(page.locator('#admin-page-info')).not.toHaveText(current);}
  throw new Error('No aparece la campaña sintética: '+title);
}
const savedResponse=(page,method)=>page.waitForResponse(response=>response.request().method()===method && new URL(response.url()).pathname.startsWith('/api/promociones'));
async function accessible(page){const issues=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;expect(issues.map(issue=>({id:issue.id,targets:issue.nodes.map(node=>node.target)}))).toEqual([]);}
const localEcuador=value=>new Date(value-5*3600000).toISOString().slice(0,16);

test('publicar explícitamente una vista previa aplica el descuento una vez en catálogo, ficha, carrito y pedido',async({page,browser},testInfo)=>{
  const data=await fixture(page),errors=[],title='Campaña 26 '+randomUUID().slice(0,8);page.on('pageerror',error=>errors.push(error.message));
  const customerContext=await browser.newContext({baseURL:'http://localhost:3300',viewport:testInfo.project.use.viewport});const customer=await customerContext.newPage(),home=await customerContext.newPage();for(const tab of [customer,home])tab.on('pageerror',error=>errors.push(error.message));
  try{
    await login(page,'admin-browser@example.ec','AdminBrowser2026!');await page.goto('/admin.html?tabla=promociones');await page.locator('#admin-create').click();
    for(const [key,value]of Object.entries({titulo:title,etiqueta:'Oferta de prueba',descripcion:'Campaña sintética para comprobar el recorrido',descuentoPorcentaje:'26'}))await page.locator('#promotion-'+key).fill(value);
    await page.locator('#promotion-productoId').selectOption(data.item.id);await page.locator('#promotion-vistaPrevia').check();
    await expect(page.locator('#promotion-publication-status')).toContainText('No aplica descuento al producto, carrito ni pedido');await expect(page.locator('#promotion-publish-discount')).toHaveText('Publicar descuento del 26 %');await expect(page.locator('#promotion-form [type=submit]')).toHaveText('Guardar vista previa sin descuento');
    const created=savedResponse(page,'POST');await page.locator('#promotion-form [type=submit]').focus();await page.keyboard.press('Enter');const createdResponse=await created;expect(createdResponse.status()).toBe(201);data.campaignId=(await createdResponse.json()).data.id;
    await expect(page.locator('#editor-dialog')).toBeHidden();await expect(page.locator('#page-status')).toContainText('No aplica descuento');await expect(await findRow(page,title)).toContainText('Vista previa · sin descuento');
    await home.goto('/');const campaign=home.locator('.promotion-card').filter({hasText:title});await expect(campaign.locator('.promotion-preview')).toHaveText('Vista previa · sin descuento aplicado');await expect(campaign.locator('.promotion-ribbon')).toHaveCount(0);
    await login(customer,data.email,data.password);await customer.goto('/producto.html?id='+data.item.id);await expect(customer.locator('#product-detail')).toContainText(money(9.75));await expect(customer.locator('.promotion-ribbon')).toHaveCount(0);await customer.locator('#detail-add-button').focus();await customer.keyboard.press('Enter');await expect(customer.locator('[data-shop-count]')).toHaveText('1');await customer.goto('/checkout.html');await expect(customer.locator('#checkout-summary')).toContainText(money(9.75));
    await (await findRow(page,title)).locator('[data-edit]').click();await expect(page.locator('#promotion-vistaPrevia')).toBeChecked();const published=savedResponse(page,'PUT');await page.locator('#promotion-publish-discount').focus();await page.keyboard.press('Enter');const publishedResponse=await published;expect(publishedResponse.status()).toBe(200);expect(publishedResponse.request().postDataJSON()).toMatchObject({activa:true,vistaPrevia:false,descuentoPorcentaje:26});await expect(page.locator('#editor-dialog')).toBeHidden();await expect(page.locator('#page-status')).toContainText('se aplica al producto, carrito y nuevos pedidos');
    await home.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(campaign.locator('.promotion-ribbon')).toContainText('26%');await expect(campaign.locator('.promotion-preview')).toHaveCount(0);
    await customer.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(customer.locator('#checkout-summary')).toContainText(money(7.22));await expect(customer.locator('#checkout-items .promotion-ribbon')).toContainText('26%');await expect(customer.locator('#checkout-items del')).toContainText(money(9.75));
    await home.goto('/catalogo.html');await home.locator('#catalog-search').fill(data.item.nombre);await expect(home.locator('#catalog-grid article')).toHaveCount(1);await expect(home.locator('#catalog-grid .promotion-ribbon')).toContainText('26%');await expect(home.locator('#catalog-grid .price-with-discount strong')).toHaveText(money(7.22));
    await home.goto('/producto.html?id='+data.item.id);await expect(home.locator('#product-detail .promotion-ribbon')).toContainText('26%');await expect(home.locator('#product-detail .price-with-discount strong')).toHaveText(money(7.22));
    await customer.locator('#checkout-next').focus();await customer.keyboard.press('Enter');await customer.locator('#checkout-document').fill('0102030400');await customer.locator('[name=delivery][value=pickup]').check();await customer.locator('#checkout-terms').check();const orderResponse=customer.waitForResponse(response=>response.request().method()==='POST' && new URL(response.url()).pathname==='/api/pedidos');await customer.locator('#delivery-form [type=submit]').focus();await customer.keyboard.press('Enter');const placed=await orderResponse;expect(placed.status()).toBe(201);const order=(await placed.json()).data;expect(Number(order.total)).toBe(7.22);expect(Number(order.detalles[0].precioUnitario)).toBe(7.22);expect(order.detalles[0].descuentoPorcentaje).toBe(26);await expect(customer.locator('#order-confirmation')).toContainText('Tu pedido quedó registrado.');
    await (await findRow(page,title)).locator('[data-edit]').click();await page.locator('#promotion-vistaPrevia').check();const previewAgain=savedResponse(page,'PUT');await page.locator('#promotion-form [type=submit]').focus();await page.keyboard.press('Enter');const previewResponse=await previewAgain;expect((await previewResponse.json()).data.vistaPrevia).toBe(true);await expect(page.locator('#editor-dialog')).toBeHidden();
    const restored=await customer.request.get('/api/productos/'+data.item.id);expect(Number((await restored.json()).data.precio)).toBe(9.75);const existing=await customer.request.get('/api/pedidos/mis-pedidos',{headers:{Authorization:'Bearer '+data.customer.token}});expect(Number((await existing.json()).data.items.find(item=>item.id===order.id).total)).toBe(7.22);expect(errors).toEqual([]);
  }finally{await customerContext.close();await data.cleanup();}
});

test('el panel distingue fechas, publicación programada y vista previa sin activar descuentos inadvertidos',async({page})=>{
  const data=await fixture(page),title='Campaña programada '+randomUUID().slice(0,8);
  await page.route('**/api/admin/tablas?**',async route=>{
    if(new URL(route.request().url()).searchParams.get('tabla')==='promociones')await new Promise(resolve=>setTimeout(resolve,250));
    await route.continue();
  });
  try{
    const tomorrow=Date.now()+86400000,later=Date.now()+2*86400000;
    const created=await page.request.post('/api/promociones',{headers:data.headers,data:{titulo:title,descripcion:'Campaña sintética programada',etiqueta:'Programada',productoId:data.item.id,activa:true,vistaPrevia:true,descuentoPorcentaje:26,orden:1,inicio:new Date(tomorrow).toISOString(),fin:new Date(later).toISOString()}});expect(created.status()).toBe(201);data.campaignId=(await created.json()).data.id;
    await login(page,'admin-browser@example.ec','AdminBrowser2026!');await page.goto('/admin.html?tabla=promociones');await (await findRow(page,title)).locator('[data-edit]').click();await expect(page.locator('#promotion-publication-status')).toContainText('sólo se mostrará al iniciar su vigencia');await expect(page.locator('#promotion-publish-discount')).toHaveText('Publicar descuento programado');
    for(const width of [320,768,1920]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);const box=await page.locator('#promotion-publication-status').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);}
    await accessible(page);
    await page.locator('#promotion-fin').fill(localEcuador(Date.now()-86400000));await expect(page.locator('#promotion-publication-status')).toContainText('vigencia terminó');await expect(page.locator('#promotion-publish-discount')).toBeDisabled();await page.locator('#promotion-form [type=submit]').click();await expect(page.locator('#promotion-fin')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#promotion-fin')).toBeFocused();
    await page.locator('#promotion-fin').fill(localEcuador(later));const published=savedResponse(page,'PUT');await page.locator('#promotion-publish-discount').focus();await page.keyboard.press('Enter');expect((await published).status()).toBe(200);await expect(page.locator('#editor-dialog')).toBeHidden();await expect(await findRow(page,title)).toContainText('Programada');
    let response=await page.request.get('/api/productos/'+data.item.id);expect(Number((await response.json()).data.precio)).toBe(9.75);expect((await (await page.request.get('/api/promociones')).json()).data.some(item=>item.id===data.campaignId)).toBe(false);
    await (await findRow(page,title)).locator('[data-edit]').click();await page.locator('#promotion-inicio').fill('');await expect(page.locator('#promotion-publication-status')).toContainText('se aplica al producto, carrito y nuevos pedidos');const current=savedResponse(page,'PUT');await page.locator('#promotion-form [type=submit]').focus();await page.keyboard.press('Enter');expect((await current).status()).toBe(200);await expect(page.locator('#editor-dialog')).toBeHidden();response=await page.request.get('/api/productos/'+data.item.id);expect(Number((await response.json()).data.precio)).toBe(7.22);
  }finally{await data.cleanup();}
});
