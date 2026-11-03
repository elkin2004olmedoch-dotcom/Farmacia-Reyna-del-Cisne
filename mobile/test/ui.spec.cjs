const {test, expect} = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const AxeBuilder = require('@axe-core/playwright').default;
let server, origin;
test.use({channel: 'chrome', headless: true});

test.beforeAll(async () => {
  server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(await fs.readFile(path.join(__dirname, '../src/index.html')));
      return;
    }
    if (pathname === '/app.js') { response.setHeader('Content-Type', 'text/javascript'); response.end('/* Native bootstrap replaced explicitly by test mountApp fixture. */'); return; }
    const shared={'/frontend/controllers/route-map.js':'controllers/route-map.js','/assets/route-map.css':'assets/route-map.css','/assets/leaflet/leaflet.js':'assets/vendor/leaflet/leaflet.js','/assets/leaflet/leaflet.css':'assets/vendor/leaflet/leaflet.css'}[pathname];
    if(shared){response.setHeader('Content-Type',shared.endsWith('.js')?'text/javascript':'text/css');response.end(await fs.readFile(path.join(__dirname,'../../frontend',shared)));return;}
    if (pathname === '/assets/logo-reina-del-cisne.png') {
      response.setHeader('Content-Type', 'image/png');
      response.end(await fs.readFile(path.join(__dirname, '../../frontend/assets/images/logo-reina-del-cisne.png')));
      return;
    }
    if (!['/ui.js', '/styles.css'].includes(pathname)) { response.writeHead(404).end(); return; }
    try {
      response.setHeader('Content-Type', pathname.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8');
      response.end(await fs.readFile(path.join(__dirname, '../src', pathname.slice(1))));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
});
test.afterAll(async () => { await new Promise(resolve => server.close(resolve)); });

// All substitutes live in the test and enter through mountApp's public arguments.
// No API requests, browser credential storage or native plugin calls occur here.
async function mount(page, {restored = true, role = 'repartidor', conflict = false, loginFailure = false, notificationDenied = false, logoutFailure = false, localLogoutFailure = false, stopFailure = false, pageFailure = false,pinned=false} = {}) {
  await page.route('https://tile.openstreetmap.org/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')}));
  await page.goto(origin);
  await page.evaluate(async options => {
    const {mountApp} = await import('/ui.js');
    const user = {id: 'courier-fixture', nombre: 'Repartidora de prueba', role: options.role, activo: true};
    const delivery = {id: 'delivery-fixture', pedidoId: 'pedido-fixture-123', repartidorId: user.id, estado: 'asignada', estadoPedido: 'preparado', version: 4, gpsVersion: 0, origenSeguimiento: null, ubicacion: null,
      destino: {nombre: '<img src=x onerror=alert(1)>', telefono: '0991234567', direccion: 'Calle de prueba 123', ciudad: 'Puerto Quito', provincia: 'Pichincha', latitud: options.pinned?.125:null, longitud:options.pinned?-79.25:null}};
    const fixture = {calls: [], deliveries: [delivery], authenticated: options.restored, conflict: options.conflict, pageFailure: options.pageFailure};
    const session = {
      get user() { return fixture.authenticated ? user : null; },
      get authenticated() { return fixture.authenticated; },
      async restore() { fixture.calls.push('restore'); return this.user; },
      async login(email, password) { fixture.calls.push(['login', email, Boolean(password)]); if (options.loginFailure) throw Object.assign(new Error('fixture credential'), {status: 401}); fixture.authenticated = true; return user; },
      async logout() { fixture.calls.push('logout'); fixture.authenticated = false; if (options.localLogoutFailure) throw Object.assign(new Error('fixture storage'),{code:'LOCAL_LOGOUT_FAILED'}); if (options.logoutFailure) throw new Error('fixture offline'); },
      async request(route, options = {}) {
        fixture.calls.push({route, ...options});
        if(route.endsWith('/ruta'))return {destino:{latitud:.125,longitud:-79.25,fuente:'direccion'},geometry:{type:'LineString',coordinates:[[-79.24,.12],[-79.245,.123],[-79.25,.125]]},distance:1800,duration:300};
        if (route.endsWith('/estado')) {
          if (fixture.conflict) { fixture.conflict = false; delivery.version = 6; delivery.estado = 'en_destino'; throw Object.assign(new Error('version'), {status: 409}); }
          if (options.data.esperadoVersion !== delivery.version) throw new Error('Wrong state version');
          delivery.estado = options.data.estado; delivery.version++;
          return structuredClone(delivery);
        }
        if (route.startsWith('/entregas?')) {
          const page = Number(new URL(route, 'https://fixture.invalid').searchParams.get('page'));
          if (fixture.pageFailure && page === 2) { fixture.pageFailure = false; throw new Error('fixture offline'); }
          return {items: structuredClone(fixture.deliveries), total: 21, page, pageSize: 20};
        }
        if (route === '/entregas/delivery-fixture') return structuredClone(delivery);
        throw new Error('Unexpected local request');
      }
    };
    const tracker = {
      state: {activeId: null, phase: 'idle', lastCapturedAt: null, lastSentAt: null, precision: null},
      async start(item) { fixture.calls.push('start'); this.state = {activeId: item.id, phase: 'sharing', lastCapturedAt: Date.now(), lastSentAt: Date.now() - 5000, precision: 8,position:{latitud:.12,longitud:-79.24,registradaAt:new Date().toISOString()}}; fixture.ui.updateTracking(this.state); },
      async stop() { fixture.calls.push('stop'); this.state = {...this.state, activeId: null, phase: 'idle'}; fixture.ui?.updateTracking(this.state); if (options.stopFailure) throw new Error('fixture release offline'); },
      async reconcile() { fixture.calls.push('reconcile'); if (['entregada', 'cancelada'].includes(delivery.estado)) await this.stop(); return structuredClone(delivery); }
    };
    const runtime = {async locate(){fixture.calls.push('locate');return {latitud:.12,longitud:-79.24,registradaAt:new Date().toISOString()};},async ensureNotifications() { fixture.calls.push('notifications'); if (options.notificationDenied) throw Object.assign(new Error('fixture notification'), {code: 'NOTIFICATIONS_DENIED'}); }, async openSettings() { fixture.calls.push('settings'); }};
    fixture.ui = await mountApp({root: document.getElementById('app'), session, tracker, runtime});
    window.uiFixture = fixture;
  }, {restored, role, conflict, loginFailure, notificationDenied, logoutFailure, localLogoutFailure, stopFailure, pageFailure,pinned});
}

test('la app instalada inicia GPS y muestra una ruta dentro del contenedor local',async({page},testInfo)=>{
  await mount(page,{pinned:true});await page.getByRole('button',{name:'Iniciar recorrido',exact:true}).click();
  await expect(page.locator('.courier-route-map')).toBeVisible();await expect(page.locator('.courier-route-status')).toContainText('Ruta actualizada');
  await expect(page.locator('.leaflet-overlay-pane path[stroke="#b51c36"]')).toHaveCount(1);await expect(page.locator('a[href*="google.com/maps"]')).toHaveCount(0);
  await page.screenshot({path:testInfo.outputPath('ruta-app.png'),fullPage:true});
  await page.getByRole('button',{name:'Cerrar sesión'}).click();await expect(page.locator('.courier-route-map')).toHaveCount(0);
});

test('abrir el mapa obtiene la ubicación automáticamente sin pedir coordenadas',async({page})=>{
  await mount(page);await page.getByRole('button',{name:'Ver ruta en la app'}).click();
  await expect(page.locator('.courier-route-status')).toContainText('Ruta actualizada');await expect(page.locator('.courier-route input')).toHaveCount(0);
  expect(await page.evaluate(()=>window.uiFixture.calls.includes('locate'))).toBe(true);
  expect(await page.evaluate(()=>window.uiFixture.calls.some(call=>call?.route?.endsWith('/estado')))).toBe(false);
});

test('courier can use keyboard, advance versioned states, share GPS and stop before logout', async ({page}) => {
  await page.setViewportSize({width: 360, height: 800});
  await mount(page, {restored: false});
  await page.getByLabel('Correo electrónico').fill('reparto@example.invalid');
  await page.getByLabel('Contraseña', {exact: true}).fill('test password');
  await page.getByLabel('Contraseña', {exact: true}).press('Enter');
  await expect(page.getByRole('heading', {name: 'Tus entregas'})).toBeVisible();
  await expect(page.getByText('<img src=x onerror=alert(1)>', {exact: true})).toBeVisible();
  await expect(page.locator('article img')).toHaveCount(0);
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  await page.getByRole('button', {name: 'Iniciar recorrido', exact: true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', {name: 'Llegué al destino', exact: true})).toBeVisible();
  await expect(page.getByText(/8 m/)).toBeVisible();
  expect(await page.evaluate(() => window.uiFixture.calls.indexOf('notifications') < window.uiFixture.calls.indexOf('start'))).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(() => window.uiFixture.calls.filter(call => call === 'stop').length)).toBe(0);
  await page.getByRole('button', {name: 'Llegué al destino', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Pedido entregado', exact: true})).toBeFocused();
  await expect(page.getByRole('link', {name: 'Llamar al destinatario'})).toHaveAttribute('href', 'tel:0991234567');
  await expect(page.getByRole('button',{name:'Ver ruta en la app'})).toBeVisible();
  await page.getByRole('button', {name: 'Cerrar sesión'}).click();
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  expect(await page.evaluate(() => window.uiFixture.calls.slice(-2))).toEqual(['stop', 'logout']);
  expect(await page.evaluate(() => window.uiFixture.calls.filter(call => call?.route?.endsWith('/estado')).map(call => call.data))).toEqual([{estado: 'en_camino', esperadoVersion: 4}, {estado: 'en_destino', esperadoVersion: 5}]);
});

test('conflict reconciles without repeating a state change; terminal destinations disappear', async ({page}) => {
  await mount(page, {conflict: true});
  await page.getByRole('button', {name: 'Iniciar recorrido', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Pedido entregado', exact: true})).toBeVisible();
  await expect(page.getByRole('status').filter({hasText: /cambió/})).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button', {name: 'Pedido entregado', exact: true}).click();
  await expect(page.getByText('Calle de prueba 123', {exact: true})).toHaveCount(0);
  await expect(page.locator('a[href^="tel:"], a[href*="google.com"]')).toHaveCount(0);
  await page.getByRole('button', {name: 'Siguiente página'}).click();
  await expect(page.getByText(/Página 2/)).toBeVisible();
  expect(await page.evaluate(() => window.uiFixture.calls.filter(call => call?.route?.startsWith('/entregas?')).at(-1).route)).toContain('page=2&pageSize=20');
});

test('foreground and network recovery reconcile; 360 and 390px retain accessible touch controls', async ({page}, testInfo) => {
  await mount(page);
  for (const width of [360, 390]) {
    await page.setViewportSize({width, height: 844});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('button, input, select, a.button').evaluateAll(elements => elements.filter(element => !element.hidden && element.getClientRects().length>0).every(element => element.getBoundingClientRect().height >= 44))).toBe(true);
    await page.screenshot({path: testInfo.outputPath('courier-' + width + '.png'), fullPage: true});
  }
  const before = await page.evaluate(() => window.uiFixture.calls.filter(call => call === 'reconcile').length);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => page.evaluate(() => window.uiFixture.calls.filter(call => call === 'reconcile').length)).toBeGreaterThan(before);
  await page.evaluate(() => { window.uiFixture.deliveries[0].estado = 'cancelada'; window.dispatchEvent(new Event('focus')); });
  await expect(page.getByText('Calle de prueba 123', {exact: true})).toHaveCount(0);
});

test('login and delivery views have no serious or critical accessibility violations', async ({page}) => {
  for (const restored of [false, true]) {
    await mount(page, {restored});
    const results = await new AxeBuilder({page}).analyze();
    expect(results.violations.filter(issue => ['serious', 'critical'].includes(issue.impact))).toEqual([]);
  }
});

test('a restored account with another role never sees a destination', async ({page}) => {
  await mount(page, {role: 'admin'});
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  await expect(page.getByText('Calle de prueba 123', {exact: true})).toHaveCount(0);
  expect(await page.evaluate(() => window.uiFixture.calls)).toContain('logout');
});

test('login errors clear the password and keep credentials out of the visible error', async ({page}) => {
  await mount(page, {restored: false, loginFailure: true});
  await page.getByLabel('Correo electrónico').fill('reparto@example.invalid');
  await page.getByLabel('Contraseña', {exact: true}).fill('synthetic-secret');
  await page.getByRole('button', {name: 'Iniciar sesión'}).click();
  await expect(page.getByLabel('Contraseña', {exact: true})).toHaveValue('');
  await expect(page.getByRole('status').filter({hasText: /Revisa tus datos/})).toBeVisible();
  await expect(page.getByText('synthetic-secret', {exact: true})).toHaveCount(0);
});

test('notification permission denial offers settings and never starts GPS', async ({page}) => {
  await mount(page, {notificationDenied: true});
  await page.getByRole('button', {name: 'Iniciar recorrido', exact: true}).click();
  await expect(page.getByRole('status').filter({hasText: /notificaciones/})).toBeVisible();
  await page.getByRole('button', {name: 'Abrir permisos del teléfono'}).click();
  expect(await page.evaluate(() => window.uiFixture.calls.includes('start'))).toBe(false);
  expect(await page.evaluate(() => window.uiFixture.calls)).toContain('settings');
});

test('logout removes private destinations even when remote revocation or tracker release fails', async ({page}) => {
  for (const failure of [{logoutFailure: true}, {stopFailure: true}]) {
    await mount(page, failure);
    await page.getByRole('button', {name: 'Cerrar sesión'}).click();
    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
    await expect(page.getByText('Calle de prueba 123', {exact: true})).toHaveCount(0);
    expect(await page.evaluate(() => window.uiFixture.calls.slice(-2))).toEqual(['stop', 'logout']);
  }
});

test('a failed next page can be retried without skipping a page', async ({page}) => {
  await mount(page, {pageFailure: true});
  await page.getByRole('button', {name: 'Siguiente página'}).click();
  await expect(page.getByRole('status').filter({hasText: /conexión/})).toBeVisible();
  await page.getByRole('button', {name: 'Siguiente página'}).click();
  await expect(page.getByText(/Página 2/)).toBeVisible();
});

test('failed local logout does not falsely report that this phone has closed its session', async ({page}) => {
  await mount(page,{localLogoutFailure:true});
  await page.getByRole('button',{name:'Cerrar sesión'}).click();
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  await expect(page.getByRole('status').filter({hasText:'No se pudo confirmar el cierre en este teléfono'})).toBeVisible();
  await expect(page.getByText('Calle de prueba 123',{exact:true})).toHaveCount(0);
  await expect(page.getByText('La sesión se cerró en este teléfono.',{exact:false})).toHaveCount(0);
});
