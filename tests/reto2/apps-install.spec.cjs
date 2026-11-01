const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const path=require('node:path');
const android='Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36';
const windows='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36';
async function offer(page,outcome='dismissed'){
 await page.evaluate(outcome=>{const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{window.promptCalls=(window.promptCalls||0)+1;};event.userChoice=Promise.resolve({outcome});window.dispatchEvent(event);},outcome);
}
test.describe('tienda instalable',()=>{
 test.use({userAgent:android});
 test('opciones accesibles, guías iPhone y retorno de foco con Escape',async({page})=>{
  await page.goto('/');const open=page.getByRole('button',{name:'Obtener app',exact:true});await expect(open).toBeVisible();
  await open.focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog',{name:'Tu cuidado, más cerca.'})).toBeVisible();
  await page.getByRole('button',{name:'iPhone y iPad'}).click();await expect(page.locator('#install-guidance')).toContainText('Añadir a pantalla de inicio');await expect(page.locator('#app-install-action')).toBeHidden();
  await expect(page.locator('a[download]')).toHaveAttribute('href','descargas/reparto-0.1.0.apk');
  const result=await new AxeBuilder({page}).include('#app-install-dialog').analyze();expect(result.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([]);
  await page.screenshot({path:path.resolve('.superpowers/sdd/2026-11-01-apps-instalables',`tienda-${test.info().project.name}.png`)});
  await page.keyboard.press('Escape');await expect(page.locator('#app-install-dialog')).not.toBeVisible();await expect(open).toBeFocused();
 });
 test('prompt cancelado no afirma instalación y appinstalled confirma por separado',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Obtener app',exact:true}).click();await offer(page);
  await expect(page.locator('#app-install-action')).toBeVisible();await page.locator('#app-install-action').click();await expect(page.locator('#install-guidance')).toContainText('cancelada');expect(await page.evaluate(()=>window.promptCalls)).toBe(1);
  await offer(page,'accepted');await page.locator('#app-install-action').click();await expect(page.locator('#install-guidance')).toContainText('Solicitud aceptada');await expect(page.locator('#install-guidance')).not.toContainText('está instalada');
  await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));await expect(page.locator('#install-guidance')).toContainText('confirmada por el dispositivo');await expect(page.locator('#app-install-action')).toBeHidden();
 });
 test('botón y dialog se adaptan de 320 a 1440 px sin desbordar',async({page})=>{
  await page.goto('/');for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:900});const box=await page.getByRole('button',{name:'Obtener app',exact:true}).boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
  await page.setViewportSize({width:375,height:800});await page.getByRole('button',{name:'Obtener app',exact:true}).click();expect(await page.locator('#app-install-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 });
});
test.describe('administración instalable',()=>{
 test.use({userAgent:windows});
 test('acceso invitado vuelve al instalador tras autenticarse y conserva API admin',async({page})=>{
  await page.goto('/instalar-admin.html');await expect(page).toHaveURL(/cuenta\.html\?next=instalar-admin\.html/);
  await page.locator('#login-email').fill('admin-browser@example.ec');await page.locator('#login-password').fill('AdminBrowser2026!');await page.locator('#login-form [type=submit]').click();
  await expect.poll(()=>new URL(page.url()).pathname).toBe('/instalar-admin.html');await expect(page.locator('#admin-area')).toBeVisible();await offer(page);await expect(page.locator('#admin-install-action')).toBeEnabled();
  await page.screenshot({path:path.resolve('.superpowers/sdd/2026-11-01-apps-instalables',`administracion-${test.info().project.name}.png`)});
  const accessibility=await new AxeBuilder({page}).analyze();expect(accessibility.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([]);
  await page.locator('#admin-install-action').focus();await page.keyboard.press('Enter');await expect(page.locator('#admin-install-status')).toContainText('cancelada');
  await page.getByRole('link',{name:'Abrir el panel administrativo'}).click();await expect(page.locator('#admin-area')).toBeVisible();await expect(page.getByRole('link',{name:'Instalar administración en Windows'})).toBeVisible();
 });
 test('cliente no habilita instalador administrativo',async({page,request})=>{
  const email=`install-${Date.now()}-${test.info().project.name}@example.ec`;
  const register=await request.post('/api/auth/register',{data:{nombre:'Cliente Instalación',email,telefono:'0991234567',cedula:'1710034065',password:'ClienteInstala2026!'}});expect(register.status()).toBe(201);const session=(await register.json()).data;
  await page.addInitScript(token=>sessionStorage.setItem('farmacia-mvc-token',token),session.token);await page.goto('/instalar-admin.html');await expect(page.locator('#page-status')).toContainText('administradores');await expect(page.locator('#admin-area')).toBeHidden();await offer(page);await expect(page.locator('#admin-install-action')).toBeDisabled();
  expect((await request.get('/api/admin/resumen',{headers:{Authorization:'Bearer '+session.token}})).status()).toBe(403);
 });
});
