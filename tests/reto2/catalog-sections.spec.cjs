const {test,expect,apiToken,settleNetwork}=require('./browser-fixture.cjs');
const AxeBuilder=require('@axe-core/playwright').default;
const {trackNetwork}=require('../../scripts/browser-network.cjs');
const ids=['bienestar','cuidado','bebe','medicamentos','salud-digestiva','dermocosmetica','proteccion-solar','higiene-bucal','cuidado-capilar','higiene-intima','salud-sexual','primeros-auxilios','equipos-medicos','adulto-mayor','cuidado-ocular-nasal','ortopedia'];

async function administrator(page,request,{exchange=true}={}){
  const token=await apiToken(request,'admin-browser@example.ec','AdminBrowser2026!');
  const headers={Authorization:'Bearer '+token};
  if(exchange){const response=await page.request.post('/api/auth/web/exchange',{headers:{...headers,Origin:'http://localhost:3300','X-Farmacia-Web':'1'},data:{}});expect(response.status()).toBe(200);}
  return headers;
}
async function create(request,headers,changes={}){
  const response=await request.post('/api/productos',{headers,data:{nombre:'Referencia de consulta UI',categoria:'equipos-medicos',precio:17,stock:5,soloConsulta:true,descripcion:'Referencia sintética en base temporal para verificar consulta.',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase sintético de comprobación',laboratorio:'Empresa temporal',presentacion:'Caja de prueba',...changes}});
  expect(response.status()).toBe(201);return (await response.json()).data;
}

test('dieciséis secciones mantienen navegación, URL y teclado en portada y filtros',async({page},testInfo)=>{
  const expanded=process.env.PHARMACY_BROWSER_EXPANDED_CATALOG==='true';
  const expected=require('../../data/productos.json').length+(expanded?require('../../data/catalogo-ampliado.json').productos.length:0);
  const inventory=await page.request.get('/api/productos?pageSize=1');expect(inventory.status()).toBe(200);expect((await inventory.json()).data.total).toBe(expected);
  if(expanded){const response=await page.request.get('/api/productos/filtros');expect(response.status()).toBe(200);const categories=(await response.json()).data.categorias;expect(categories.map(category=>category.id)).toEqual(ids);expect(categories.every(category=>category.total>=2)).toBe(true);}
  await page.goto('/');
  const links=page.locator('.store-category-grid > a');await expect(links).toHaveCount(16);
  expect(await links.evaluateAll(nodes=>nodes.map(node=>new URL(node.href).searchParams.get('category')))).toEqual(ids);
  for(const width of [320,768,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  for(const photo of await links.locator('img').all()){await photo.scrollIntoViewIfNeeded();await expect.poll(()=>photo.evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);}
  await page.setViewportSize({width:testInfo.project.name==='movil'?320:1440,height:1000});await page.evaluate(()=>{scrollTo(0,0);document.activeElement?.blur();});await expect(page.locator('.ref-header')).toBeInViewport();await page.screenshot({path:testInfo.outputPath('secciones-portada.png'),fullPage:true});
  await links.filter({hasText:'Ortopedia'}).click();
  await expect(page.locator('#catalog-category')).toHaveValue('ortopedia');
  await expect(page.locator('#catalog-category option')).toHaveCount(17);
  await page.reload();await expect(page.locator('#catalog-category')).toHaveValue('ortopedia');
  const select=page.locator('#catalog-category');await select.focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');
  await expect(select).toHaveValue('bienestar');await expect(page).toHaveURL(/category=bienestar/);
  await page.locator('#catalog-clear').click();await expect(select).toHaveValue('todos');expect(new URL(page.url()).searchParams.has('category')).toBe(false);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});

test('consulta bloquea compra y muestra el estado comercial en todos los recorridos públicos',async({page,request})=>{
  const headers=await administrator(page,request,{exchange:false}),item=await create(request,headers);
  await page.goto('/catalogo.html?q=Referencia%20de%20consulta%20UI&category=equipos-medicos');
  const card=page.locator('#catalog-grid article').filter({hasText:item.nombre});await expect(card).toContainText('Consultar precio y disponibilidad');
  await expect(card.locator('[data-add]')).toHaveCount(0);await expect(card).not.toContainText(/17[,.]00|5 unidades|Agotado|PROMO/);
  await page.locator('#catalog-search').fill('Referencia de consulta UI');await expect(page.locator('.predictive-panel:visible')).toContainText('Consultar precio y disponibilidad');
  await card.locator('[data-compare]').check();await page.goto('/comparar.html');await expect(page.locator('#comparison')).toContainText('Consultar precio y disponibilidad');await expect(page.locator('#comparison')).not.toContainText('17,00');
  await page.goto('/producto.html?id='+item.id);await expect(page.locator('#product-detail')).toContainText('Consultar precio y disponibilidad');await expect(page.locator('#detail-add-form')).toHaveCount(0);
  await page.evaluate(id=>localStorage.setItem('farmacia-mvc-carrito',JSON.stringify({[id]:1})),item.id);
  await page.goto('/checkout.html');await expect(page.locator('#checkout-items')).toContainText('Consultar precio y disponibilidad');await expect(page.locator('#checkout-next')).toBeDisabled();await expect(page.locator('#checkout-summary')).not.toContainText('17,00');
  await expect(page.locator('#checkout-grand-total')).toHaveText('Por confirmar');await expect(page.locator('#checkout-shipping-fee')).toHaveText('Por confirmar');await expect(page.locator('#checkout-summary')).toContainText('Impuestos pendientes');
  const priced=await create(request,headers,{nombre:'Referencia comercial UI',precio:9,soloConsulta:false});
  await page.evaluate(({consultation,priced})=>localStorage.setItem('farmacia-mvc-carrito',JSON.stringify({[consultation]:1,[priced]:1})),{consultation:item.id,priced:priced.id});
  await page.reload();await expect(page.locator('#checkout-items article')).toHaveCount(2);await expect(page.locator('#checkout-grand-total')).toHaveText('Por confirmar');await expect(page.locator('#checkout-shipping-fee')).toHaveText('Por confirmar');await expect(page.locator('#checkout-summary')).not.toContainText('9,00');await expect(page.locator('#checkout-next')).toBeDisabled();
  await page.goto('/catalogo.html');await page.getByRole('button',{name:'Abrir ayuda de la farmacia',exact:true}).click();
  const host=page.locator('farmacia-mascota');await host.locator('#input').fill('buscar Referencia de consulta UI');await host.locator('#form [type=submit]').click();
  const consultation=host.locator('.companion-card').filter({hasText:item.nombre}).last();await expect(consultation).toContainText('Consultar precio y disponibilidad');await expect(consultation).not.toContainText('17,00');
});

test('administración guarda consulta con PATCH y su activación se refleja mediante avisos del catálogo',async({page,request,browser},testInfo)=>{
  const headers=await administrator(page,request),item=await create(request,headers);
  const publicContext=await browser.newContext({baseURL:'http://localhost:3300',viewport:testInfo.project.use.viewport}),publicPage=await publicContext.newPage();trackNetwork(publicPage);await publicPage.goto('/producto.html?id='+item.id);await expect(publicPage.locator('#product-detail')).toContainText('Consultar precio y disponibilidad');await settleNetwork(publicPage);
  await page.goto('/admin.html?tabla=promociones');await page.locator('#admin-create').click();await expect(page.locator('#editor-dialog')).toBeVisible();await expect(page.locator('#promotion-productoId option[value="'+item.id+'"]').first()).toHaveCount(0);await page.locator('#promotion-form [data-editor-close]').click();
  await page.goto('/admin.html?tabla=productos&registro='+item.id);await page.locator('[data-edit="'+item.id+'"]').click();
  await expect(page.locator('#product-soloConsulta')).toBeChecked();await expect(page.locator('#product-precio')).toHaveValue('17');await expect(page.locator('#product-stock')).toHaveValue('5');
  await expect(page.locator('#product-categoria option')).toHaveCount(16);await page.locator('#product-soloConsulta').uncheck();
  const saved=page.waitForResponse(response=>response.request().method()==='PATCH'&&new URL(response.url()).pathname==='/api/productos/'+item.id);
  await page.getByRole('button',{name:'Guardar solo cambios',exact:true}).click();expect((await saved).status()).toBe(200);
  await expect(publicPage.locator('#detail-add-button')).toBeEnabled({timeout:12000});await expect(publicPage.locator('#product-detail')).toContainText('17,00');
  await publicPage.screenshot({path:testInfo.outputPath('consulta-activada.png'),fullPage:true});await publicContext.close();
});

test('las nuevas secciones combinan búsqueda, orden de precio y recuperación de errores',async({page,request})=>{
  const headers=await administrator(page,request,{exchange:false});
  await create(request,headers,{nombre:'Orden secciones UI bajo',categoria:'ortopedia',precio:6,soloConsulta:false});
  await create(request,headers,{nombre:'Orden secciones UI alto',categoria:'ortopedia',precio:30,soloConsulta:false});
  await create(request,headers,{nombre:'Orden secciones UI consulta',categoria:'ortopedia',precio:0,stock:0});
  let release;const pending=new Promise(resolve=>{release=resolve;});let delayed=true;
  await page.route('**/api/productos?*',async route=>{if(delayed)await pending;await route.continue();});
  await page.goto('/catalogo.html?q=Orden%20secciones%20UI&category=ortopedia&sort=low');
  await expect(page.locator('#catalog-grid')).toHaveAttribute('aria-busy','true');await expect(page.locator('#catalog-count')).toHaveText('Buscando productos…');delayed=false;release();
  await expect(page.locator('#catalog-grid h3')).toHaveText(['Orden secciones UI bajo','Orden secciones UI alto','Orden secciones UI consulta']);
  await page.locator('#catalog-sort').selectOption('high');await expect(page.locator('#catalog-grid h3')).toHaveText(['Orden secciones UI alto','Orden secciones UI bajo','Orden secciones UI consulta']);
  await page.unroute('**/api/productos?*');let fail=true;
  await page.route('**/api/productos?*',route=>fail?route.fulfill({status:500,json:{error:{message:'No se pudo consultar la sección.'}}}):route.continue());
  await page.locator('#catalog-sort').selectOption('low');await expect(page.locator('#catalog-error')).toContainText('No se pudo consultar la sección.');
  fail=false;await page.locator('#catalog-retry').click();await expect(page.locator('#catalog-error')).toBeHidden();await expect(page.locator('#catalog-grid article')).toHaveCount(3);
  await page.reload();await expect(page.locator('#catalog-category')).toHaveValue('ortopedia');await expect(page.locator('#catalog-sort')).toHaveValue('low');await expect(page.locator('#catalog-grid article')).toHaveCount(3);
});
