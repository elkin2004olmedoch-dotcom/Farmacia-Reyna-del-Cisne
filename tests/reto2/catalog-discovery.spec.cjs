const {test,expect,apiToken}=require('./browser-fixture.cjs');
const AxeBuilder=require('@axe-core/playwright').default;
async function openSearch(page,testInfo){await page.goto('/');if(testInfo.project.name==='movil')await page.locator('#search-toggle').click();return page.locator('#global-search');}

test('predictivo muestra precios e imágenes y permite elegir con flechas sin perder la búsqueda',async({page},testInfo)=>{
  const input=await openSearch(page,testInfo);await expect(input).toHaveAttribute('role','combobox');
  await input.fill('ensure');const options=page.locator('#global-search-suggestions [role=option]');await expect(options.first()).toBeVisible();
  await expect(options.first().locator('img')).toHaveAttribute('width','48');await expect(options.first().locator('.predictive-price')).toContainText('$');
  await page.keyboard.press('ArrowDown');await expect(input).toHaveAttribute('aria-activedescendant',/suggestions-0$/);await expect(input).toBeFocused();
  await page.keyboard.press('Escape');await expect(input).toHaveAttribute('aria-expanded','false');await expect(input).toHaveValue('ensure');
  await input.fill('ensure advance');await expect(options.first()).toBeVisible();const destination=await options.first().getAttribute('href');
  const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;expect(violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await expect(page).toHaveURL(new RegExp(destination.replace(/[?]/g,'\\?')+'$'));await expect(page.locator('#detail-add-button')).toBeVisible();
});

test('Escape cancela sugerencias pendientes y una respuesta antigua no reaparece',async({page},testInfo)=>{
  let release;const gate=new Promise(resolve=>release=resolve);
  await page.route('**/api/productos/sugerencias?*',async route=>{await gate;await route.fulfill({json:{ok:true,data:{items:[],aproximadas:false}}}).catch(()=>{});});
  const input=await openSearch(page,testInfo);const sent=page.waitForRequest(request=>request.url().includes('/productos/sugerencias?'));
  await input.fill('vitamina');await sent;await input.press('Escape');release();
  await expect(input).toHaveAttribute('aria-expanded','false');await expect(page.locator('.predictive-panel').first()).toBeHidden();
  await expect(input).toHaveValue('vitamina');
});

test('las coincidencias aproximadas se anuncian y solo navegan al elegir un producto',async({page},testInfo)=>{
  const input=await openSearch(page,testInfo);await input.fill('ensrue');
  const panel=page.locator('#header-search .predictive-panel');await expect(panel.locator('.predictive-note')).toContainText('Coincidencias aproximadas');
  await expect(input).toHaveValue('ensrue');await expect(page.locator('#header-search [role=status]')).toContainText('Revisa nombre y presentación');
  const option=panel.getByRole('option').first(),destination=await option.getAttribute('href');await option.click();await expect(page).toHaveURL(new RegExp(destination.replace(/[?]/g,'\\?')+'$'));
});

test('catálogo pagina y conserva filtros, URL y comparación entre páginas',async({page})=>{
  const token=await apiToken(page.request,'admin-browser@example.ec','AdminBrowser2026!');const headers={Authorization:'Bearer '+token};
  for(let i=1;i<=28;i++){
    const created=await page.request.post('/api/productos',{headers,data:{nombre:'Descubrimiento '+String(i).padStart(2,'0'),precio:i,stock:8,categoria:'cuidado',descripcion:'Producto sintético en base temporal.',imagen:'assets/images/producto-vitaminas.jpg',alt:'Envase de prueba',laboratorio:'Laboratorio Álamo',presentacion:'Envase de 100 ml'}});expect(created.status()).toBe(201);
  }
  const requests=[];page.on('request',request=>{if(new URL(request.url()).pathname==='/api/productos')requests.push(new URL(request.url()));});
  await page.goto('/catalogo.html?q=descubrimiento&origen=portada#contenido');await expect(page.locator('#catalog-grid article')).toHaveCount(24);
  await page.locator('#catalog-laboratory').selectOption('Laboratorio Álamo');await page.locator('#catalog-presentation').selectOption('Envase de 100 ml');
  await expect(page.locator('#catalog-count')).toContainText('28 productos');await page.locator('#catalog-grid [data-compare]').first().check();
  const selected=await page.locator('#catalog-grid [data-compare]').first().getAttribute('data-compare');await page.locator('#catalog-next').focus();await page.keyboard.press('Enter');await expect(page.locator('#catalog-grid article')).toHaveCount(4);await expect(page.locator('#catalog-page-info')).toHaveText('Página 2 de 2');await expect(page.locator('#catalog-next')).toBeFocused();
  let url=new URL(page.url());expect(url.searchParams.get('page')).toBe('2');expect(url.searchParams.get('laboratorio')).toBe('Laboratorio Álamo');expect(url.searchParams.get('origen')).toBe('portada');expect(url.hash).toBe('#contenido');
  await page.reload();await expect(page.locator('#catalog-grid article')).toHaveCount(4);await page.locator('#catalog-prev').click();await expect(page.locator(`[data-compare="${selected}"]`)).toBeChecked();
  await page.locator('#catalog-sort').selectOption('high');await expect(page.locator('#catalog-grid h3').first()).toHaveText('Descubrimiento 28');
  expect(requests.every(url=>url.searchParams.get('pageSize')==='24')).toBeTruthy();
  await page.locator('#catalog-clear').click();url=new URL(page.url());for(const key of ['q','laboratorio','presentacion','sort','page'])expect(url.searchParams.has(key)).toBe(false);expect(url.searchParams.get('origen')).toBe('portada');
  await page.setViewportSize({width:320,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('un fallo del catálogo permite reintentar y buscar sin recargar',async({page})=>{
  let fail=true;await page.route('**/api/productos?*',route=>fail?route.fulfill({status:500,json:{error:{message:'No se pudo consultar el catálogo.'}}}):route.continue());
  await page.goto('/catalogo.html');await expect(page.locator('#catalog-error')).toContainText('No se pudo consultar');await expect(page.locator('#catalog-retry')).toBeEnabled();
  fail=false;await page.locator('#catalog-retry').click();await expect(page.locator('#catalog-grid article').first()).toBeVisible();await expect(page.locator('#catalog-error')).toBeHidden();
  await page.locator('#catalog-search').fill('sin-coincidencia-92847');await expect(page.locator('#catalog-grid')).toContainText('No encontramos productos');await expect(page.locator('#catalog-next')).toBeDisabled();
});

test('volver a una página con búsqueda pendiente recupera resultados y controles',async({page})=>{
  await page.goto('/catalogo.html');await expect(page.locator('#catalog-grid article').first()).toBeVisible();
  let release;const gate=new Promise(resolve=>release=resolve);let requests=0;
  await page.route('**/api/productos?*',async route=>{requests++;if(requests===1){await gate;await route.continue().catch(()=>{});}else await route.continue();});
  const pending=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/productos' && new URL(request.url()).searchParams.get('q')==='solar');
  await page.locator('#catalog-search').fill('solar');await pending;
  await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  await expect(page.locator('#catalog-grid')).toHaveAttribute('aria-busy','false');await expect(page.locator('#catalog-grid')).toContainText(/solar/i);expect(requests).toBeGreaterThanOrEqual(2);release();
});

test('ficha conserva compra y amplía una imagen alternativa sin desbordar ni inventar información',async({page})=>{
  const response=await page.request.get('/api/productos/vitaminas');const product=(await response.json()).data;
  await page.route('**/'+product.imagen,route=>route.fulfill({status:404,body:''}));
  await page.goto('/producto.html?id=vitaminas');const photo=page.locator('#zoom-product img');await expect(photo).toHaveAttribute('src','assets/images/producto-sin-imagen.svg');
  await page.locator('#zoom-product').click();await expect(page.locator('#image-dialog img')).toHaveAttribute('src',/producto-sin-imagen.svg$/);await page.getByRole('button',{name:'Cerrar imagen'}).click();
  await expect(page.locator('#product-detail')).toContainText('Retiro en farmacia');await expect(page.locator('#product-detail')).toContainText(/tarifa al confirmar la dirección/i);
  await page.locator('#detail-add-button').click();await expect(page.locator('#cart-drawer')).toBeVisible();await page.keyboard.press('Escape');
  for(const width of [320,768,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
  const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;expect(violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
});
