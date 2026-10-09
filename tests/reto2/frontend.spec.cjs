const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const tinyPNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGP4fGkRVsQwtCQAJ4yZwRji18kAAAAASUVORK5CYII=','base64');
test('catálogo, persistencia, login obligatorio, registro y pedido real',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await expect(page.locator('#featured-products article')).toHaveCount(4);await expect(page.locator('.promotion-card')).toHaveCount(2);
  await expect(page.locator('.business-photo img')).toBeVisible();
  await page.locator('#global-search').fill('solar');await page.locator('.header-search button').click();await expect(page.locator('#catalog-grid article')).toHaveCount(1);
  await page.locator('[data-add=solar]').click();await expect(page.locator('[data-shop-count]')).toHaveText('1');
  await page.reload();await expect(page.locator('[data-shop-count]')).toHaveText('1');
  await page.goto('/producto.html?id=vitaminas');await expect(page.locator('#detail-add-form')).toBeVisible();await page.locator('#detail-quantity').fill('2');await page.locator('#detail-add-form [type=submit]').click();await expect(page.locator('[data-shop-count]')).toHaveText('3');
  await page.goto('/checkout.html');await expect(page.locator('.checkout-cart-item')).toHaveCount(2);
  await page.locator('[data-cart-plus=solar]').click();await expect(page.locator('#qty-solar')).toHaveValue('2');await page.locator('[data-cart-minus=solar]').click();await expect(page.locator('#qty-solar')).toHaveValue('1');
  await page.locator('[data-cart-remove=solar]').click();await expect(page.locator('#confirm-dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.checkout-cart-item')).toHaveCount(2);
  await page.locator('[data-cart-remove=solar]').click();await page.locator('#confirm-dialog [value=confirm]').click();await expect(page.locator('.checkout-cart-item')).toHaveCount(1);
  await page.locator('#checkout-next').click();await expect(page).toHaveURL(/cuenta.html\?next=checkout.html/);await expect(page.locator('#page-status')).toContainText('Inicia sesión');
  await page.locator('#show-register').click();await page.locator('#register-form [type=submit]').click();await expect(page.locator('#register-cedula')).toHaveAttribute('aria-invalid','true');
  const email=`cliente-${testInfo.project.name}-${Date.now()}@example.ec`;
  for(const [name,value] of Object.entries({nombre:'Cliente Prueba',email,telefono:'0979275988',cedula:'0102030400',password:'ClienteBrowser2026!',confirm:'ClienteBrowser2026!'}))await page.locator('#register-'+name).fill(value);
  await page.locator('#register-terms').check();await page.locator('#register-form [type=submit]').click();await expect(page).toHaveURL(/checkout.html$/);
  await page.locator('#checkout-next').click();await expect(page.locator('#delivery-form')).toBeVisible();await page.locator('#delivery-form [type=submit]').click();await expect(page.locator('#checkout-document')).toHaveAttribute('aria-invalid','true');
  await page.locator('#checkout-document').fill('0102030400');await page.locator('[name=delivery][value=delivery]').check();await page.locator('#checkout-province').selectOption('Pichincha');await page.locator('#checkout-city').fill('Quito');await page.locator('#checkout-address').fill('Av. Amazonas N10-20 junto al parque');await page.locator('#checkout-postalCode').fill('170101');await page.locator('#checkout-terms').check();
  await page.locator('#delivery-form [type=submit]').click();await expect(page.locator('#order-confirmation')).toContainText('Tu pedido quedó registrado.');await expect(page.locator('[data-shop-count]')).toHaveText('0');
  await page.goto('/pedidos.html');await expect(page.locator('.order-card')).toHaveCount(1);
  const token=await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'));
  const response=await page.request.get('/api/pedidos/mis-pedidos',{headers:{Authorization:'Bearer '+token}});expect(response.status()).toBe(200);expect((await response.json()).data.total).toBe(1);
  const saved=await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}));expect(saved).not.toContain('0102030400');expect(saved).not.toContain('ClienteBrowser2026!');
  await page.goto('/admin.html');await expect(page.locator('#admin-area')).toBeHidden();await expect(page.locator('#page-status')).toContainText('administradores');
  expect(errors).toEqual([]);
});
test('administrador crea, edita y elimina; consulta todas las tablas y publica promociones',async({page},testInfo)=>{
  await page.goto('/cuenta.html?next=checkout.html');await page.locator('#login-email').fill('admin-browser@example.ec');await page.locator('#login-password').fill('AdminBrowser2026!');await page.locator('#login-form [type=submit]').click();await expect(page).toHaveURL(/admin.html$/);await expect(page.locator('#logout')).toBeVisible();
  await expect(page.locator('.shop-cart,.header-search,[data-shop-count]')).toHaveCount(0);
  await expect(page.locator('a[href="checkout.html"],a[href="pedidos.html"],a[href="comparar.html"]')).toHaveCount(0);
  if(testInfo.project.name==='movil'){await page.locator('#menu-button').click();await page.locator('#mobile-nav [data-admin-section=promociones]').click();}else await page.locator('.admin-sidebar [data-admin-section=promociones]').click();
  await expect(page.locator('#admin-table-choice')).toHaveValue('promociones');await expect(page.locator('#admin-section-title')).toHaveText('Promociones');await expect(page.locator('[data-admin-section=promociones]').first()).toHaveAttribute('aria-current','page');
  await page.goto('/admin.html?tabla=desconocida');await expect(page.locator('#admin-table-choice')).toHaveValue('productos');
  await page.goto('/admin.html?tabla=productos');await expect(page.locator('#admin-table table')).toBeVisible();
  await page.locator('#admin-create').click();const name='Producto browser '+testInfo.project.name;
  for(const [key,value] of Object.entries({nombre:name,precio:'6.25',stock:'5',descripcion:'Artículo de verificación',alt:'Vitaminas de prueba'}))await page.locator('#product-'+key).fill(value);
  const imageUpload=page.waitForResponse(response=>response.request().method()==='POST' && new URL(response.url()).pathname==='/api/admin/imagenes');await page.locator('#product-image-file').setInputFiles({name:'producto-browser.png',mimeType:'image/png',buffer:tinyPNG});expect((await imageUpload).status()).toBe(201);await expect(page.locator('#product-image-preview')).toBeVisible();await expect.poll(()=>page.locator('#product-image-preview').evaluate(img=>img.naturalWidth)).toBe(8);await expect(page.locator('#product-form [type=submit]')).toBeEnabled();
  await page.locator('#product-form [type=submit]').click();await expect(page.locator('#editor-dialog')).not.toBeVisible();
  let row=page.locator('#admin-table tr').filter({hasText:name});await row.locator('[data-edit]').click();await page.locator('#product-precio').fill('7.50');await page.locator('#product-form [type=submit]').click();await expect(row).toContainText('$7,50');
  await page.goto('/admin.html');await expect(page.locator('.admin-metric')).toHaveCount(8);await expect(page.locator('#stock-alerts')).toContainText(name);await page.locator('.admin-quick-links a[href*="promociones"]').click();await expect(page.locator('#editor-dialog')).toBeVisible();await expect(page.locator('#editor-title')).toHaveText('Crear promoción');
  for(const [key,value] of Object.entries({titulo:'Campaña browser '+testInfo.project.name,etiqueta:'Vista de prueba',descripcion:'Campaña administrada desde la plataforma'}))await page.locator('#promotion-'+key).fill(value);
  await page.locator('#promotion-productoId').selectOption('solar');await page.locator('[name=vistaPrevia]').check();await page.locator('#promotion-form [type=submit]').click();await expect(page.locator('#editor-dialog')).not.toBeVisible();await expect(page.locator('#admin-table')).toContainText('Campaña browser');
  await page.goto('/');await expect(page.locator('.promotion-card').filter({hasText:'Campaña browser '+testInfo.project.name})).toBeVisible();
  await page.goto('/admin.html?tabla=productos');for(const table of ['usuarios','pedidos','detalles','promociones']){await page.locator('#admin-table-choice').selectOption(table);await expect(page.locator('#admin-table')).not.toContainText('passwordHash');await expect(page.locator('#admin-page-info')).toContainText('registros');}
  const campaign=page.locator('#admin-table tr').filter({hasText:'Campaña browser '+testInfo.project.name});await campaign.locator('[data-edit]').click();await page.locator('#promotion-descripcion').fill('Campaña editada desde administración');await page.locator('#promotion-form [type=submit]').click();await expect(page.locator('#editor-dialog')).not.toBeVisible();await campaign.locator('[data-delete]').click();await page.locator('#confirm-dialog [value=confirm]').click();await expect(campaign).toHaveCount(0);
  await page.locator('#admin-table-choice').selectOption('productos');row=page.locator('#admin-table tr').filter({hasText:name});await row.locator('[data-delete]').click();await page.locator('#confirm-dialog [value=confirm]').click();await expect(row).toContainText('No');
  await page.goto('/catalogo.html');await expect(page.locator('.shop-cart')).toBeHidden();await expect(page.locator('[data-add]').first()).toBeHidden();await page.locator('#catalog-search').fill('solar');await expect(page.locator('[data-add]').first()).toBeHidden();
  await page.goto('/producto.html?id=solar');await expect(page.locator('#detail-add-form')).toBeHidden();
  for(const file of ['cuenta.html','checkout.html']){await page.goto('/'+file);await expect(page).toHaveURL(/admin.html$/);await expect(page.locator('.admin-metric')).toHaveCount(8);}
  await page.goto('/pedidos.html');await expect(page).toHaveURL(/admin.html\?tabla=pedidos$/);await expect(page.locator('#admin-section-title')).toHaveText('Pedidos de clientes');await expect(page.locator('#admin-create')).toBeHidden();
  await page.locator('#logout').click();await expect(page).toHaveURL(/cuenta.html$/);await expect(page.locator('#login-form')).toBeVisible();expect(await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'))).toBeNull();
  await page.goto('/admin.html');await expect(page).toHaveURL(/cuenta.html\?next=admin.html$/);await expect(page.locator('#page-status')).toContainText('administrador');
});
test('errores de red y 500 se anuncian sin reemplazarlos por datos ficticios',async({page})=>{
  await page.route('**/api/productos?*',route=>route.abort());await page.goto('/catalogo.html');await expect(page.locator('#page-status')).toContainText('conectar');await expect(page.locator('#catalog-grid article')).toHaveCount(0);
  await page.unroute('**/api/productos?*');await page.route('**/api/productos?*',route=>route.fulfill({status:500,json:{ok:false,error:{message:'Servicio temporalmente no disponible.'}}}));await page.reload();await expect(page.locator('#page-status')).toContainText('Servicio temporalmente');
});
test('el panel ignora respuestas atrasadas y bloquea una sesión vencida',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/cuenta.html');await page.locator('#login-email').fill('admin-browser@example.ec');await page.locator('#login-password').fill('AdminBrowser2026!');await page.locator('#login-form [type=submit]').click();await expect(page.locator('.admin-metric')).toHaveCount(8);await page.goto('/admin.html?tabla=productos');await expect(page.locator('#admin-table table')).toBeVisible();
  await page.locator('#admin-table-choice').selectOption('promociones');await expect(page.locator('#admin-create')).toBeEnabled();
  let release,started;const delayed=new Promise(resolve=>release=resolve);const requestStarted=new Promise(resolve=>started=resolve);
  const matcher='**/api/admin/tablas?*';
  await page.route(matcher,async route=>{if(new URL(route.request().url()).searchParams.get('tabla')==='productos'){started();await delayed;}await route.continue();});
  await page.locator('#admin-table-choice').selectOption('productos');await requestStarted;await expect(page.locator('#admin-create')).toBeDisabled();await expect(page.locator('#admin-table [data-edit]')).toHaveCount(0);
  await page.locator('#admin-table-choice').selectOption('promociones');await expect(page.locator('#admin-create')).toBeEnabled();await expect(page.locator('#admin-section-title')).toHaveText('Promociones');
  const response=page.waitForResponse(response=>new URL(response.url()).searchParams.get('tabla')==='productos');release();await (await response).finished();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(page.locator('#admin-table-choice')).toHaveValue('promociones');await expect(page.locator('#admin-table th').first()).toHaveText('Campaña');await page.unroute(matcher);
  // Two delayed editor openings must keep the displayed campaign and save ID together.
  const campaignRows=page.locator('#admin-table tbody tr');expect(await campaignRows.count()).toBeGreaterThanOrEqual(2);
  const secondCampaign=await campaignRows.nth(1).locator('td').first().textContent();const secondCampaignId=await campaignRows.nth(1).locator('[data-edit]').getAttribute('data-edit');
  let releaseOpening,openingStarted;const pendingOpening=new Promise(resolve=>releaseOpening=resolve);const startedOpening=new Promise(resolve=>openingStarted=resolve);let openingCount=0;
  await page.route('**/api/productos?*',async route=>{if(++openingCount===1){openingStarted();await pendingOpening;}await route.continue();});
  await campaignRows.nth(0).locator('[data-edit]').click();await startedOpening;await campaignRows.nth(1).locator('[data-edit]').click();await expect(page.locator('#promotion-titulo')).toHaveValue(secondCampaign);
  const lateOpening=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/productos');releaseOpening();await (await lateOpening).finished();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(page.locator('#promotion-titulo')).toHaveValue(secondCampaign);await page.unroute('**/api/productos?*');
  let releaseSave,saveStarted;const pendingSave=new Promise(resolve=>releaseSave=resolve);const startedSave=new Promise(resolve=>saveStarted=resolve);
  await page.route('**/api/promociones/*',async route=>{if(route.request().method()==='PUT'){saveStarted();await pendingSave;}await route.continue();});
  const correctSave=page.waitForResponse(response=>response.request().method()==='PUT' && new URL(response.url()).pathname.startsWith('/api/promociones/'));await page.locator('#promotion-form [type=submit]').click();await startedSave;
  try{await expect(page.locator('#promotion-form [type=submit]')).toBeDisabled();await expect(page.locator('#promotion-form [data-editor-close]')).toBeDisabled();await expect(page.locator('#product-form [data-editor-close]')).toBeDisabled();await expect(page.locator('#promotion-image-file')).toBeDisabled();await expect(page.locator('#promotion-image-reset')).toBeDisabled();await expect(page.locator('#promotion-descuentoPorcentaje')).toBeDisabled();await page.keyboard.press('Escape');await expect(page.locator('#editor-dialog')).toBeVisible();await expect(page.locator('#promotion-titulo')).toHaveValue(secondCampaign);}finally{releaseSave();}
  const savedCampaign=await correctSave;expect(savedCampaign.status()).toBe(200);expect(new URL(savedCampaign.url()).pathname).toBe('/api/promociones/'+secondCampaignId);expect(savedCampaign.request().postDataJSON().titulo).toBe(secondCampaign);expect((await savedCampaign.json()).data.id).toBe(secondCampaignId);await expect(page.locator('#editor-dialog')).toBeHidden();await page.unroute('**/api/promociones/*');
  await page.locator('#admin-table-choice').selectOption('productos');await expect(page.locator('#admin-create')).toBeEnabled();await page.locator('#admin-table [data-edit]:enabled').first().click();await expect(page.locator('#editor-dialog')).toBeVisible();
  await page.route('**/api/productos/*',route=>route.fulfill({status:401,json:{ok:false,error:{message:'Tu sesión venció.'}}}));await page.locator('#product-form [type=submit]').click();
  await expect(page).toHaveURL(/cuenta.html\?next=admin.html$/);await expect(page.locator('#page-status')).toContainText('Tu sesión venció');await expect(page.locator('#login-form')).toBeVisible();expect(await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'))).toBeNull();expect(errors).toEqual([]);
});
test('nueve pantallas accesibles, sin desbordamiento y menú/foco por teclado',async({page},testInfo)=>{
  const email=`accesibilidad-${testInfo.project.name}-${Date.now()}@example.ec`;
  const registered=await page.request.post('/api/auth/register',{data:{nombre:'Cliente Accesibilidad',email,telefono:'0979275988',cedula:'0102030400',password:'ClienteBrowser2026!'}});expect(registered.status()).toBe(201);
  await page.goto('/cuenta.html');await page.locator('#login-email').fill(email);await page.locator('#login-password').fill('ClienteBrowser2026!');await page.locator('#login-form [type=submit]').click();await expect(page.locator('#logout')).toBeVisible();
  for(const file of ['index.html','catalogo.html','producto.html?id=solar','comparar.html','cuenta.html','checkout.html','pedidos.html','ayuda.html']){
    await page.goto('/'+file);await page.waitForTimeout(200);
    const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;expect(violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),file).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),file).toBe(false);
  }
  await page.goto('/cuenta.html');await page.locator('#logout').click();await expect(page.locator('#login-form')).toBeVisible();
  await page.locator('#login-email').fill('admin-browser@example.ec');await page.locator('#login-password').fill('AdminBrowser2026!');await page.locator('#login-form [type=submit]').click();await expect(page).toHaveURL(/admin.html$/);await expect(page.locator('.admin-metric')).toHaveCount(8);
  const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;expect(violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),'admin.html').toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'admin.html').toBe(false);
  if(testInfo.project.name==='movil'){await page.locator('#menu-button').focus();await page.keyboard.press('Enter');await expect(page.locator('#mobile-nav')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#mobile-nav')).toBeHidden();await expect(page.locator('#menu-button')).toBeFocused();}
  for(const table of ['productos','pedidos']){await page.goto('/admin.html?tabla='+table);await expect(page.locator('#admin-table')).not.toHaveAttribute('aria-busy','true');const findings=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;expect(findings.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),table).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),table).toBe(false);}
  await page.goto('/');await page.keyboard.press('Tab');await expect(page.locator('.skip-link')).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#contenido')).toBeFocused();
  if(testInfo.project.name==='movil'){await page.goto('/');for(let i=0;i<30 && !await page.locator('#menu-button').evaluate(el=>el===document.activeElement);i++)await page.keyboard.press('Tab');await expect(page.locator('#menu-button')).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#mobile-nav')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#mobile-nav')).toBeHidden();await expect(page.locator('#menu-button')).toBeFocused();}
});
test('dashboard ERP con datos reales, enlaces de gestión y recuperación de errores',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/cuenta.html');await page.locator('#login-email').fill('admin-browser@example.ec');await page.locator('#login-password').fill('AdminBrowser2026!');await page.locator('#login-form [type=submit]').click();await expect(page.locator('.admin-metric')).toHaveCount(8);await expect(page.locator('#admin-page-title')).toHaveText('Dashboard ejecutivo');
  const token=await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'));const response=await page.request.get('/api/admin/resumen',{headers:{Authorization:'Bearer '+token}});expect(response.status()).toBe(200);const summary=(await response.json()).data;
  await expect(page.locator('[data-metric=productos] .admin-metric-value')).toHaveText(String(summary.indicadores.productosActivos));await expect(page.locator('[data-metric=pendientes] .admin-metric-value')).toHaveText(String(summary.indicadores.pedidosPendientes));expect(summary.tendencia).toHaveLength(6);await expect(page.locator('.admin-chart')).toHaveAccessibleName('Importe de pedidos de los últimos seis meses, en dólares');await expect(page.locator('#admin-records')).toBeHidden();
  if(testInfo.project.name==='movil'){await page.locator('#menu-button').click();await expect(page.locator('#admin-nav-overlay')).toBeVisible();await expect(page.locator('#mobile-nav a').first()).toBeFocused();await expect(page.locator('#contenido')).toHaveAttribute('inert','');for(let i=0;i<12;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement.matches('#menu-button,#mobile-nav a'))).toBe(true);}await page.locator('#admin-nav-overlay').click({position:{x:330,y:30}});await expect(page.locator('#mobile-nav')).toBeHidden();await expect(page.locator('#menu-button')).toHaveAttribute('aria-expanded','false');await expect(page.locator('#contenido')).not.toHaveAttribute('inert','');}else await expect(page.locator('.admin-sidebar')).toBeVisible();
  await page.locator('.admin-quick-links a[href*="productos&crear=1"]').click();await expect(page.locator('#editor-dialog')).toBeVisible();await expect(page.locator('#editor-title')).toHaveText('Crear producto');await page.keyboard.press('Escape');await expect(page.locator('#editor-dialog')).toBeHidden();
  await page.route('**/api/admin/resumen',route=>route.fulfill({status:500,json:{ok:false,error:{message:'Resumen no disponible.'}}}));await page.goto('/admin.html');await expect(page.locator('#admin-retry-summary')).toBeVisible();await expect(page.locator('.admin-metric')).toHaveCount(0);await expect(page.locator('#page-status')).toContainText('Resumen no disponible');await page.unroute('**/api/admin/resumen');await page.locator('#admin-retry-summary').click();await expect(page.locator('.admin-metric')).toHaveCount(8);
  await page.route('**/api/admin/resumen',route=>route.fulfill({status:401,json:{ok:false,error:{message:'Tu sesión venció.'}}}));await page.reload();await expect(page).toHaveURL(/cuenta.html\?next=admin.html$/);await expect(page.locator('#page-status')).toContainText('Tu sesión venció');expect(await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'))).toBeNull();expect(errors).toEqual([]);
});

test('administración y cliente comparten datos persistidos y actualizan pantallas abiertas',async({page,browser,baseURL},testInfo)=>{
  const clientContext=await browser.newContext({baseURL,viewport:page.viewportSize()});
  const client=await clientContext.newPage();const home=await clientContext.newPage();
  const errors=[];for(const tab of [page,client,home])tab.on('pageerror',error=>errors.push(error.message));
  const suffix=testInfo.project.name+'-'+Date.now();const email='sincronizacion-'+suffix+'@example.ec';
  const productName='Producto sincronizado '+suffix;const campaignName='Campaña sincronizada '+suffix;
  const currency=value=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(value);
  let productId,campaignId,adminToken,adminOrders,detail,stateAccessibilityChecked=false;
  async function focus(tab){await tab.bringToFront();await tab.evaluate(()=>window.dispatchEvent(new Event('focus')));}
  async function assertAccessible(tab,label,include){
    const audit=new AxeBuilder({page:tab}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']);if(include)audit.include(include);const violations=(await audit.analyze()).violations;expect(violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>node.target)})),label).toEqual([]);
  }
  async function capture(tab,filename,label){
    await tab.evaluate(()=>{document.activeElement?.blur?.();window.scrollTo(0,0);document.querySelectorAll('.table-scroll').forEach(table=>{table.scrollLeft=0;table.scrollTop=0;});});await tab.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const path=testInfo.outputPath(filename);await tab.screenshot({path,fullPage:true});await testInfo.attach(label,{path,contentType:'image/png'});
  }
  async function findRow(text,tab=page){
    const row=tab.locator('#admin-table tbody tr').filter({hasText:text});
    await expect(tab.locator('#admin-table')).not.toHaveAttribute('aria-busy','true');
    while(await row.count()===0 && await tab.locator('#admin-next').isEnabled()){
      await tab.locator('#admin-next').click();await expect(tab.locator('#admin-table')).not.toHaveAttribute('aria-busy','true');
    }
    await expect(row).toHaveCount(1);return row;
  }
  async function setStock(stock){
    const currentResponse=await page.request.get('/api/productos/'+productId);expect(currentResponse.status()).toBe(200);const current=(await currentResponse.json()).data;
    const fields=Object.fromEntries(['nombre','precio','stock','categoria','descripcion','imagen','alt'].map(key=>[key,current[key]]));
    const updated=await page.request.put('/api/productos/'+productId,{headers:{Authorization:'Bearer '+adminToken},data:{...fields,precio:Number(current.precioOriginal ?? current.precio),stock,esperadoUpdatedAt:current.updatedAt}});expect(updated.status()).toBe(200);return (await updated.json()).data;
  }
  async function uploadImage(prefix){
    const response=page.waitForResponse(response=>response.request().method()==='POST' && new URL(response.url()).pathname==='/api/admin/imagenes');
    await page.locator('#'+prefix+'-image-file').setInputFiles({name:prefix+'-prueba.png',mimeType:'image/png',buffer:tinyPNG});const uploaded=await response;expect(uploaded.status()).toBe(201);const image=(await uploaded.json()).data.imagen;
    await expect(page.locator('#'+prefix+'-imagen')).toHaveValue(image);await expect(page.locator('#'+prefix+'-image-preview')).toBeVisible();await expect.poll(()=>page.locator('#'+prefix+'-image-preview').evaluate(img=>img.naturalWidth)).toBe(8);await expect(page.locator('#'+prefix+'-form [type=submit]')).toBeEnabled();return image;
  }
  async function changeState(id,state){
    await focus(adminOrders);const row=await findRow(id,adminOrders);await row.locator('[data-order-state="'+id+'"]').click();await expect(adminOrders.locator('#order-state-dialog')).toBeVisible();await adminOrders.locator('#order-state').selectOption(state);
    if(!stateAccessibilityChecked){await assertAccessible(adminOrders,'Gestión del estado y su historial','#order-state-dialog');stateAccessibilityChecked=true;}
    const response=adminOrders.waitForResponse(response=>response.request().method()==='PUT' && new URL(response.url()).pathname==='/api/pedidos/'+id+'/estado');await adminOrders.locator('#order-state-form [type=submit]').click();if(state==='cancelado'){await expect(adminOrders.locator('#confirm-dialog')).toBeVisible();await adminOrders.locator('#confirm-dialog [value=confirm]').click();}const updated=await response;expect(updated.status()).toBe(200);const order=(await updated.json()).data;await expect(adminOrders.locator('#order-state-dialog')).toBeHidden();await expect(row).toContainText(new RegExp(state,'i'));return order;
  }
  try{
    // Both roles use the isolated browser-server database, never the personal .env or DB.
    await page.goto('/cuenta.html');await page.locator('#login-email').fill('admin-browser@example.ec');await page.locator('#login-password').fill('AdminBrowser2026!');await page.locator('#login-form [type=submit]').click();await expect(page.locator('.admin-metric')).toHaveCount(8);
    adminToken=await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'));
    const summaryResponse=await page.request.get('/api/admin/resumen',{headers:{Authorization:'Bearer '+adminToken}});expect(summaryResponse.status()).toBe(200);const before=(await summaryResponse.json()).data.indicadores;
    await page.goto('/admin.html?tabla=usuarios');await expect(page.locator('#admin-table table')).toBeVisible();await expect(page.locator('#admin-table')).not.toContainText(email);

    await client.goto('/cuenta.html');await client.locator('#show-register').click();
    for(const [name,value] of Object.entries({nombre:'Cliente Sincronizacion',email,telefono:'0979275988',cedula:'0102030400',password:'ClienteBrowser2026!',confirm:'ClienteBrowser2026!'}))await client.locator('#register-'+name).fill(value);
    await client.locator('#register-terms').check();await client.locator('#register-form [type=submit]').click();await expect(client.locator('#logout')).toBeVisible();
    const clientToken=await client.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'));expect(clientToken).toBeTruthy();expect(clientToken).not.toBe(adminToken);
    await focus(page);await expect(page.locator('#admin-table')).toContainText(email);await expect(page.locator('#admin-table')).not.toContainText('passwordHash');

    // The storefront is already open before the administrator creates or edits anything.
    await client.clock.install();await client.goto('/catalogo.html?q='+encodeURIComponent(productName));await expect(client.locator('#catalog-grid article')).toHaveCount(0);
    await home.goto('/');await expect(home.locator('#promotions-list')).not.toContainText(campaignName);
    const catalogURL=client.url();const homeURL=home.url();
    await page.goto('/admin.html?tabla=productos&crear=1');await expect(page.locator('#editor-dialog')).toBeVisible();
    for(const [key,value] of Object.entries({nombre:productName,precio:'6.25',stock:'4',descripcion:'Existencias y precio iniciales de la prueba cruzada',alt:'Vitaminas de verificación cruzada'}))await page.locator('#product-'+key).fill(value);
    await page.locator('#product-image-file').setInputFiles({name:'no-es-imagen.txt',mimeType:'text/plain',buffer:Buffer.from('Archivo sintético de prueba')});await expect(page.locator('#editor-status')).toContainText(/PNG|JPG|JPEG|WEBP/i);await expect(page.locator('#product-imagen')).toHaveValue('');
    await page.locator('#product-image-file').setInputFiles({name:'imagen-demasiado-grande.png',mimeType:'image/png',buffer:Buffer.concat([tinyPNG,Buffer.alloc(2*1024*1024)])});await expect(page.locator('#editor-status')).toContainText(/2\s*MB/i);await expect(page.locator('#product-imagen')).toHaveValue('');
    const productImage=await uploadImage('product');await assertAccessible(page,'Editor con selector de archivo y vista previa','#editor-dialog');
    const createdResponse=page.waitForResponse(response=>response.request().method()==='POST' && new URL(response.url()).pathname==='/api/productos');
    await page.locator('#product-form [type=submit]').click();const created=await createdResponse;expect(created.status()).toBe(201);productId=(await created.json()).data.id;await expect(page.locator('#editor-dialog')).toBeHidden();
    await focus(client);await expect(client.locator('#catalog-grid article')).toHaveCount(1);await expect(client.locator('#catalog-grid')).toContainText(currency(6.25));await expect(client.locator('.product-stock')).toHaveText('4 unidades disponibles');await expect(client.locator('#catalog-search')).toHaveValue(productName);expect(client.url()).toBe(catalogURL);
    await expect(client.locator('#catalog-grid img')).toHaveAttribute('src',productImage);await expect.poll(()=>client.locator('#catalog-grid img').evaluate(img=>img.naturalWidth)).toBe(8);

    let productRow=await findRow(productName);await productRow.locator('[data-edit]').click();await page.locator('#product-precio').fill('7.50');await page.locator('#product-descripcion').fill('Precio editado y guardado desde administración');await page.locator('#product-form [type=submit]').click();await expect(page.locator('#editor-dialog')).toBeHidden();
    await focus(client);await expect(client.locator('#catalog-grid')).toContainText(currency(7.5));await expect(client.locator('#catalog-grid')).toContainText('Precio editado y guardado desde administración');expect(client.url()).toBe(catalogURL);

    await page.goto('/admin.html?tabla=promociones&crear=1');await expect(page.locator('#editor-dialog')).toBeVisible();
    for(const [key,value] of Object.entries({titulo:campaignName,etiqueta:'Campaña de prueba',descripcion:'Promoción publicada para el cliente abierto'}))await page.locator('#promotion-'+key).fill(value);
    await page.locator('#promotion-productoId').selectOption(productId);await page.locator('#promotion-form [name=vistaPrevia]').check();
    await page.locator('#promotion-alt').fill('Imagen sintética de una campaña de farmacia');const campaignImage=await uploadImage('promotion');
    const campaignResponse=page.waitForResponse(response=>response.request().method()==='POST' && new URL(response.url()).pathname==='/api/promociones');
    await page.locator('#promotion-form [type=submit]').click();const promoted=await campaignResponse;expect(promoted.status()).toBe(201);campaignId=(await promoted.json()).data.id;await expect(page.locator('#editor-dialog')).toBeHidden();
    await focus(home);let campaign=home.locator('.promotion-card').filter({hasText:campaignName});await expect(campaign).toBeVisible();await expect(campaign.locator('a')).toHaveAttribute('href','producto.html?id='+productId);expect(home.url()).toBe(homeURL);
    await expect(campaign.locator('img')).toHaveAttribute('src',campaignImage);await expect(campaign.locator('img')).toHaveAttribute('alt','Imagen sintética de una campaña de farmacia');
    const campaignRow=await findRow(campaignName);await campaignRow.locator('[data-edit]').click();await page.locator('#promotion-descripcion').fill('Promoción editada y persistida en la base de datos');await page.locator('#promotion-form [type=submit]').click();await expect(page.locator('#editor-dialog')).toBeHidden();
    await home.bringToFront();await home.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await expect(campaign).toContainText('Promoción editada y persistida en la base de datos');expect(home.url()).toBe(homeURL);

    // Keep an order table open separately while the main admin tab edits the product.
    adminOrders=await page.context().newPage();adminOrders.on('pageerror',error=>errors.push(error.message));await adminOrders.addInitScript(token=>sessionStorage.setItem('farmacia-mvc-token',token),adminToken);await adminOrders.goto('/admin.html?tabla=pedidos');await expect(adminOrders.locator('#admin-table')).not.toHaveAttribute('aria-busy','true');await expect(adminOrders.locator('#admin-table')).not.toContainText(email);
    await client.locator('[data-add="'+productId+'"]').click();await client.locator('[data-add="'+productId+'"]').click();await expect(client.locator('[data-shop-count]')).toHaveText('2');await expect(home.locator('[data-shop-count]')).toHaveText('2');expect(await page.evaluate(()=>localStorage.getItem('farmacia-mvc-carrito'))).toBeNull();
    const checkout=await clientContext.newPage();checkout.on('pageerror',error=>errors.push(error.message));
    // A second tab restores this client's JWT through /auth/me; it does not log in again.
    await checkout.addInitScript(token=>sessionStorage.setItem('farmacia-mvc-token',token),clientToken);await checkout.goto('/checkout.html');await expect(checkout.locator('.checkout-cart-item')).toHaveCount(1);await expect(checkout.locator('#checkout-summary')).toContainText(currency(15));
    await checkout.locator('#checkout-next').click();await expect(checkout.locator('#delivery-form')).toBeVisible();await checkout.locator('#checkout-name').fill('Cliente Formulario Conservado');await checkout.locator('#checkout-document').fill('0102030400');await checkout.locator('#checkout-terms').check();
    const formValues=await checkout.locator('#delivery-form').evaluate(form=>Object.fromEntries(new FormData(form)));

    // A visible catalog detects external changes through its 30-second timer without a focus event.
    await client.bringToFront();await setStock(1);await client.clock.runFor(30000);await expect(client.locator('.product-stock')).toHaveText('1 unidades disponibles');
    await focus(checkout);await expect(checkout.locator('#checkout-next')).toBeDisabled();await expect(checkout.locator('#delivery-form [type=submit]')).toBeDisabled();await expect(checkout.locator('#qty-'+productId)).toHaveValue('2');expect(await checkout.locator('#delivery-form').evaluate(form=>Object.fromEntries(new FormData(form)))).toEqual(formValues);
    await setStock(4);await focus(checkout);await expect(checkout.locator('#checkout-next')).toBeEnabled();await expect(checkout.locator('#delivery-form [type=submit]')).toBeEnabled();expect(await checkout.locator('#delivery-form').evaluate(form=>Object.fromEntries(new FormData(form)))).toEqual(formValues);

    await page.goto('/admin.html?tabla=productos');productRow=await findRow(productName);await productRow.locator('[data-edit]').click();await expect(page.locator('#product-stock')).toHaveValue('4');await expect(page.locator('#product-precio')).toHaveValue(/^7\.50?$/);await page.locator('#product-precio').fill('8.25');await focus(page);await expect(page.locator('#editor-dialog')).toBeVisible();await expect(page.locator('#product-precio')).toHaveValue('8.25');await expect(page.locator('#product-stock')).toHaveValue('4');
    const orderResponse=checkout.waitForResponse(response=>response.request().method()==='POST' && new URL(response.url()).pathname==='/api/pedidos');await checkout.locator('#delivery-form [type=submit]').click();const saved=await orderResponse;expect(saved.status()).toBe(201);const order=(await saved.json()).data;
    expect(Number(order.total)).toBe(15);expect(order.detalles).toHaveLength(1);expect(order.detalles[0].productoId).toBe(productId);expect(order.detalles[0].cantidad).toBe(2);expect(Number(order.detalles[0].precioUnitario)).toBe(7.5);expect(order.documento).not.toContain('0102030400');await expect(checkout.locator('#order-confirmation')).toContainText(productName);
    await expect(home.locator('[data-shop-count]')).toHaveText('0');await expect(client.locator('[data-shop-count]')).toHaveText('0');
    // The stale editor must neither reset unsaved fields nor overwrite a concurrent sale.
    await focus(page);await expect(page.locator('#editor-dialog')).toBeVisible();await expect(page.locator('#product-stock')).toHaveValue('4');await expect(page.locator('#product-precio')).toHaveValue('8.25');
    const staleResponse=page.waitForResponse(response=>response.request().method()==='PUT' && new URL(response.url()).pathname==='/api/productos/'+productId);await page.locator('#product-form [type=submit]').click();const rejected=await staleResponse;expect(rejected.status()).toBe(409);expect((await rejected.json()).error.code).toBe('PRODUCT_CHANGED');await expect(page.locator('#editor-status')).toContainText('El producto cambió');await expect(page.locator('#editor-dialog')).toBeVisible();await expect(page.locator('#product-stock')).toHaveValue('4');await expect(page.locator('#product-precio')).toHaveValue('8.25');
    const preserved=await client.request.get('/api/productos/'+productId);expect(preserved.status()).toBe(200);const actual=(await preserved.json()).data;expect(actual.stock).toBe(2);expect(Number(actual.precio)).toBe(7.5);
    await page.locator('#product-form [data-editor-close]').click();await expect(page.locator('#editor-dialog')).toBeHidden();await expect(productRow.locator('td').nth(2)).toHaveText('2');await productRow.locator('[data-edit]').click();await expect(page.locator('#product-stock')).toHaveValue('2');await expect(page.locator('#product-precio')).toHaveValue(/^7\.50?$/);await page.locator('#product-form [data-editor-close]').click();await expect(page.locator('#editor-dialog')).toBeHidden();
    await focus(adminOrders);const orderRow=await findRow(order.id,adminOrders);await expect(orderRow).toContainText(email);await expect(orderRow).toContainText(currency(15));
    await focus(client);await expect(client.locator('.product-stock')).toHaveText('2 unidades disponibles');expect(client.url()).toBe(catalogURL);
    await page.locator('#admin-table-choice').selectOption('detalles');const detailRow=await findRow(productName);await expect(detailRow).toContainText(order.id);await expect(detailRow.locator('td').nth(3)).toHaveText('2');await expect(detailRow.locator('td').nth(4)).toHaveText(currency(7.5));
    await page.locator('#admin-table-choice').selectOption('productos');productRow=await findRow(productName);await expect(productRow.locator('td').nth(2)).toHaveText('2');
    await page.goto('/admin.html');await expect(page.locator('[data-metric=pendientes] .admin-metric-value')).toHaveText(String(before.pedidosPendientes+1));await expect(page.locator('[data-metric=clientes] .admin-metric-value')).toHaveText(String(before.clientesActivos+1));await expect(page.locator('[data-metric=productos] .admin-metric-value')).toHaveText(String(before.productosActivos+1));await expect(page.locator('[data-metric=total] .admin-metric-value')).toHaveText(currency((before.pedidosTotales.totalCentavos+1500)/100));await expect(page.locator('.admin-recent-table')).toContainText(order.id.slice(0,8));
    await checkout.goto('/pedidos.html');await expect(checkout.locator('.order-card')).toContainText(productName);await checkout.reload();await expect(checkout.locator('.order-card')).toContainText(currency(15));
    const durableProduct=await client.request.get('/api/productos/'+productId);expect(durableProduct.status()).toBe(200);expect((await durableProduct.json()).data.stock).toBe(2);

    // The same customer sees each state change without reloading the already open history.
    const history=checkout.locator('.order-card').filter({hasText:order.id.slice(0,8)});
    let delivered;
    for(const state of ['confirmado','preparado','entregado']){delivered=await changeState(order.id,state);await focus(checkout);await expect(history.locator('.product-label')).toContainText(new RegExp(state,'i'));}
    const forbidden=await page.request.put('/api/pedidos/'+order.id+'/estado',{headers:{Authorization:'Bearer '+adminToken},data:{estado:'cancelado',esperadoUpdatedAt:delivered.updatedAt}});expect(forbidden.status()).toBe(409);
    const unchangedStock=await client.request.get('/api/productos/'+productId);expect((await unchangedStock.json()).data.stock).toBe(2);

    // Publishing a real discount affects catalog, detail, cart and the server's order price.
    await page.goto('/admin.html?tabla=promociones');const discountRow=await findRow(campaignName);await discountRow.locator('[data-edit]').click();await page.locator('#promotion-descuentoPorcentaje').fill('25');await page.locator('#promotion-form [name=vistaPrevia]').uncheck();await page.locator('#promotion-image-reset').click();await expect(page.locator('#promotion-imagen')).toHaveValue('');await page.locator('#promotion-form [type=submit]').click();await expect(page.locator('#editor-dialog')).toBeHidden();await focus(home);await expect(campaign.locator('img')).toHaveAttribute('src',productImage);
    await focus(client);await expect(client.locator('#catalog-grid .promotion-ribbon')).toContainText('25%');await expect(client.locator('#catalog-grid')).toContainText(currency(5.63));await expect(client.locator('#catalog-grid')).toContainText(currency(7.5));await expect(client.locator('#catalog-grid img')).toHaveAttribute('src',productImage);
    await assertAccessible(client,'Catálogo con precio promocional y etiqueta amarilla');
    const discountedResponse=await client.request.get('/api/productos/'+productId);expect(discountedResponse.status()).toBe(200);const discounted=(await discountedResponse.json()).data;expect(Number(discounted.precio)).toBe(5.63);expect(Number(discounted.precioOriginal)).toBe(7.5);expect(discounted.descuentoPorcentaje).toBe(25);expect(discounted.promocionId).toBe(campaignId);
    detail=await clientContext.newPage();detail.on('pageerror',error=>errors.push(error.message));await detail.goto('/producto.html?id='+productId);await expect(detail.locator('.promotion-ribbon')).toContainText('25%');await expect(detail.locator('#product-detail')).toContainText(currency(5.63));await expect(detail.locator('#product-detail')).toContainText(currency(7.5));await expect(detail.locator('.product-main-image img')).toHaveAttribute('src',productImage);
    await assertAccessible(detail,'Detalle con descuento e imagen subida');
    await capture(client,'catalogo-promocion.png','Catálogo con promoción y foto subida');
    await capture(detail,'detalle-promocion.png','Detalle con precio promocional');

    await client.locator('[data-add="'+productId+'"]').click();await checkout.goto('/checkout.html');await expect(checkout.locator('#checkout-summary')).toContainText(currency(5.63));await checkout.locator('#checkout-next').click();await checkout.locator('#checkout-document').fill('0102030400');await checkout.locator('#checkout-terms').check();
    const discountedOrderResponse=checkout.waitForResponse(response=>response.request().method()==='POST' && new URL(response.url()).pathname==='/api/pedidos');await checkout.locator('#delivery-form [type=submit]').click();const purchased=await discountedOrderResponse;expect(purchased.status()).toBe(201);const discountedOrder=(await purchased.json()).data;expect(Number(discountedOrder.total)).toBe(5.63);expect(Number(discountedOrder.detalles[0].precioUnitario)).toBe(5.63);
    const consumed=await client.request.get('/api/productos/'+productId);expect((await consumed.json()).data.stock).toBe(1);await checkout.goto('/pedidos.html');
    const cancelled=await changeState(discountedOrder.id,'cancelado');await focus(checkout);await expect(checkout.locator('.order-card').filter({hasText:discountedOrder.id.slice(0,8)}).locator('.product-label')).toContainText(/cancelado/i);
    const restored=await client.request.get('/api/productos/'+productId);expect((await restored.json()).data.stock).toBe(2);
    const repeated=await page.request.put('/api/pedidos/'+discountedOrder.id+'/estado',{headers:{Authorization:'Bearer '+adminToken},data:{estado:'cancelado',esperadoUpdatedAt:cancelled.updatedAt}});expect([200,409]).toContain(repeated.status());const onceOnly=await client.request.get('/api/productos/'+productId);expect((await onceOnly.json()).data.stock).toBe(2);await focus(client);await expect(client.locator('.product-stock')).toHaveText('2 unidades disponibles');
    await capture(adminOrders,'administracion-estados-pedidos.png','Gestión de estados de pedidos de prueba');
    await checkout.reload();await expect(checkout.locator('.order-card').filter({hasText:order.id.slice(0,8)})).toContainText(/entregado/i);await expect(checkout.locator('.order-card').filter({hasText:discountedOrder.id.slice(0,8)})).toContainText(/cancelado/i);expect(errors).toEqual([]);
  }finally{
    // Orders remain auditable in the temporary fixture; only synthetic campaigns/catalog entries are retired.
    if(adminToken){const headers={Authorization:'Bearer '+adminToken};if(campaignId)await page.request.delete('/api/promociones/'+campaignId,{headers});if(productId)await page.request.delete('/api/productos/'+productId,{headers});}
    if(adminOrders)await adminOrders.close();
    await clientContext.close();
  }
});
