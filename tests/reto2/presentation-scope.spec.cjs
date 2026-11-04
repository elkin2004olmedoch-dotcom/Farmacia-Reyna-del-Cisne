const {test,expect,apiToken}=require('./browser-fixture.cjs');
const AxeBuilder=require('@axe-core/playwright').default;

test('la compra conserva marca y regreso sin menú de perfil ni navegación que distraiga',async({page},testInfo)=>{
  await page.addInitScript(()=>localStorage.setItem('farmacia-mvc-carrito',JSON.stringify({solar:1})));
  await page.goto('/checkout.html');await expect(page.locator('#screen-controls')).toBeEnabled();
  await expect(page.locator('.ref-brand')).toBeVisible();await expect(page.locator('.ref-brand')).toHaveAttribute('href','index.html');
  await expect(page.locator('#account-menu-toggle')).toBeHidden();await expect(page.locator('.ref-header .ref-nav')).toBeHidden();
  await expect(page.locator('#menu-button')).toBeHidden();await expect(page.locator('.ref-header-inner')).toHaveCSS('display','flex');
  const back=page.locator('.purchase-header-back');await expect(back).toBeVisible();await expect(back).toHaveAttribute('href','catalogo.html');
  await expect(page.locator('#checkout-cancellation-note')).toContainText('Mis pedidos');
  for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.setViewportSize(testInfo.project.use.viewport);expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({path:testInfo.outputPath('compra-enfocada.png'),fullPage:true});await back.focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(/catalogo\.html$/);
});

test('administración concentra gestión diaria y mantiene herramientas avanzadas accesibles por teclado y enlace directo',async({page,request},testInfo)=>{
  const token=await apiToken(request,'admin-browser@example.ec','AdminBrowser2026!');
  const session=await page.request.post('/api/auth/web/exchange',{headers:{Authorization:'Bearer '+token,Origin:'http://localhost:3300','X-Farmacia-Web':'1'},data:{}});expect(session.status()).toBe(200);
  await page.goto('/admin.html');await expect(page.locator('#admin-area')).toBeVisible();
  const mobile=testInfo.project.name==='movil';if(mobile)await page.locator('#menu-button').click();
  let nav=page.locator(mobile?'#mobile-nav':'.admin-sidebar');
  await expect(nav.locator('[data-admin-section=productos]')).toBeVisible();await expect(nav.locator('[data-admin-section=pedidos]')).toBeVisible();
  const advanced=nav.locator('.admin-advanced');await expect(advanced).toBeVisible();await expect(advanced).not.toHaveAttribute('open','');await expect(advanced.locator('[data-admin-section=fiscal]')).toBeHidden();
  const summary=advanced.locator('summary');await summary.focus();await page.keyboard.press('Enter');await expect(advanced.locator('[data-admin-section=fiscal]')).toBeVisible();
  if(mobile){await page.keyboard.press('Tab');await expect(advanced.locator('a').first()).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#mobile-nav')).toBeHidden();}
  await page.goto('/admin.html?tabla=proveedores');await expect(page.locator('#admin-section-title')).toContainText('Proveedores');if(mobile)await page.locator('#menu-button').click();nav=page.locator(mobile?'#mobile-nav':'.admin-sidebar');
  await expect(nav.locator('.admin-advanced')).toHaveAttribute('open','');await expect(nav.locator('[data-admin-section=proveedores][aria-current=page]')).toBeVisible();
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);await page.screenshot({path:testInfo.outputPath('administracion-opciones-claras.png'),fullPage:true});
});
