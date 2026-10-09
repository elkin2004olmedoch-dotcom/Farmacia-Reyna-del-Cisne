const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
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
  for(const [key,value] of Object.entries({nombre:name,precio:'6.25',stock:'5',descripcion:'Artículo de verificación',imagen:'assets/images/producto-vitaminas.jpg',alt:'Vitaminas de prueba'}))await page.locator('#product-'+key).fill(value);
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
