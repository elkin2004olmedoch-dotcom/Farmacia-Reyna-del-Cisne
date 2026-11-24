const {test,expect,settleNetwork}=require('./browser-fixture.cjs');
const AxeBuilder=require('@axe-core/playwright').default;

test('tienda y administración funcionan en el navegador sin opciones de instalación',async({page,request})=>{
  await page.goto('/');await settleNetwork(page);
  await expect(page.locator('[data-app-open],#app-install-dialog,link[rel="manifest"],a[href$=".apk"]')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Explora nuestras secciones.'})).toBeVisible();
  await page.goto('/cuenta.html?next=admin.html');
  await page.locator('#login-email').fill('admin-browser@example.ec');await page.locator('#login-password').fill('AdminBrowser2026!');await page.locator('#login-form [type=submit]').click();
  await expect(page.locator('#admin-area')).toBeVisible();await expect(page.locator('a[href*="instalar-admin"],link[rel="manifest"]')).toHaveCount(0);
  const axe=await new AxeBuilder({page}).analyze();expect(axe.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([]);
  expect((await request.get('/api/productos?pageSize=1')).status()).toBe(200);
});

test('una visita retira workers anteriores sin borrar cachés de otros proyectos',async({page,context})=>{
  await context.route('**/app-worker.js?legacy-install=1',route=>route.fulfill({contentType:'application/javascript',body:"self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));"}));
  await page.goto('/');await settleNetwork(page);
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/app-worker.js?legacy-install=1');await navigator.serviceWorker.ready;await caches.open('farmacia-mvc-offline-old');await caches.open('another-project');});
  await page.reload();await settleNetwork(page);
  await expect.poll(()=>page.evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  expect(await page.evaluate(()=>caches.keys())).toEqual(['another-project']);
});
