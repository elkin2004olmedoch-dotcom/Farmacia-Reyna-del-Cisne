const {test,expect}=require('./browser-fixture.cjs'),AxeBuilder=require('@axe-core/playwright').default;
test.use({serviceWorkers:'block'});
async function setup(page,{destination=true,routeError=false,denied=false,versionConflicts=0,routeStatus=503,routeCode='ROUTE_UNAVAILABLE'}={}){
 const user={id:'courier-map',nombre:'Repartidor Ruta',email:'ruta@example.ec',telefono:'0991234567',role:'repartidor',activo:true};
 const item={id:'delivery-map',pedidoId:'order-map',estado:'asignada',estadoPedido:'preparado',version:1,gpsVersion:0,repartidorId:user.id,destino:{nombre:'Cliente Ruta',direccion:'Calle principal 123',ciudad:'Puerto Quito',provincia:'Pichincha',telefono:'0991234567',latitud:destination?.125:null,longitud:destination?-79.25:null}},routes=[],states=[];
 await page.clock.install();
 await page.addInitScript(({denied})=>{window.gpsFixture={callback:null,cleared:0,denied};Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(success,error){if(window.gpsFixture.denied)error({code:1});else success({coords:{latitude:.12,longitude:-79.24},timestamp:Date.now()});},watchPosition(callback){window.gpsFixture.callback=callback;return 1;},clearWatch(){window.gpsFixture.cleared++;}}});},{denied});
 await page.route('https://tile.openstreetmap.org/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')}));
 await page.route('**/api/auth/me',route=>route.fulfill({json:{ok:true,data:user}}));
 await page.route('**/api/entregas?*',route=>route.fulfill({json:{ok:true,data:{items:[structuredClone(item)],total:1,page:1,pageSize:20}}}));
 await page.route('**/api/entregas/delivery-map/estado',route=>{const body=route.request().postDataJSON();states.push(body);item.estado=body.estado;item.version++;if(item.estado==='entregada')item.destino=null;return route.fulfill({json:{ok:true,data:structuredClone(item)}});});
 await page.route('**/api/entregas/delivery-map/ubicacion',route=>{if(route.request().method()==='PUT'){const body=route.request().postDataJSON();item.ubicacion=body;item.gpsVersion++;}else item.ubicacion=null;return route.fulfill({json:{ok:true,data:structuredClone(item)}});});
 await page.route('**/api/entregas/delivery-map/ruta',route=>{
  const body=route.request().postDataJSON();routes.push(body);
  if(routes.length<=versionConflicts)return route.fulfill({status:409,json:{ok:false,error:{code:'DELIVERY_CHANGED',message:'La entrega o ubicación cambió; actualiza la ruta.'}}});
  if(routeError)return route.fulfill({status:routeStatus,json:{ok:false,error:{code:routeCode,message:'No se pudo calcular una ruta por las calles.'}}});
  return route.fulfill({json:{ok:true,data:{destino:{latitud:.125,longitud:-79.25,fuente:destination?'cliente':'direccion'},geometry:{type:'LineString',coordinates:[[body.longitud,body.latitud],[-79.26,.128],[-79.25,.125]]},distance:1800,duration:300}}});
 });
 await page.goto('/entregas.html');await expect(page.getByRole('button',{name:'Iniciar recorrido',exact:true})).toBeVisible();return {routes,states};
}
const capture=async page=>{await expect.poll(()=>page.evaluate(()=>typeof window.gpsFixture.callback)).toBe('function');await page.evaluate(()=>window.gpsFixture.callback({coords:{latitude:.12,longitude:-79.24,accuracy:8},timestamp:Date.now()}));};

test('ruta reintenta un conflicto GPS inicial y dibuja sin actualización manual',async({page})=>{
 const {routes}=await setup(page,{versionConflicts:1});await page.getByRole('button',{name:'Ver ruta en la app'}).click();
 await expect.poll(()=>routes.length,{timeout:4000}).toBe(2);await expect(page.locator('.courier-route-status')).toContainText('Ruta actualizada');await expect(page.locator('.leaflet-overlay-pane path[stroke="#b51c36"]')).toHaveCount(1);
});
test('conflictos GPS persistentes tienen un solo reintento y cerrar mapa lo cancela',async({page})=>{
 const {routes}=await setup(page,{versionConflicts:20});await page.getByRole('button',{name:'Ver ruta en la app'}).click();
 await expect.poll(()=>routes.length,{timeout:4000}).toBe(2);await expect(page.locator('.courier-route-status')).toContainText('La entrega o ubicación cambió');await page.clock.fastForward(5000);expect(routes).toHaveLength(2);
 await page.locator('#courier-route-close').click();await page.clock.fastForward(30000);expect(routes).toHaveLength(2);
});
test('cerrar durante la espera del reintento impide otra solicitud y no recupera datos privados',async({page})=>{
 const {routes}=await setup(page,{versionConflicts:1});await page.getByRole('button',{name:'Ver ruta en la app'}).click();await expect(page.locator('.courier-route-status')).toContainText('Actualizando la ruta');await page.locator('#courier-route-close').click();await page.clock.fastForward(3000);expect(routes).toHaveLength(1);await expect(page.locator('.courier-route-map')).toHaveCount(0);
});
test('una denegación de permiso no reintenta ni conserva el mapa',async({page})=>{
 const {routes}=await setup(page,{routeError:true,routeStatus:403,routeCode:'FORBIDDEN'});await page.getByRole('button',{name:'Ver ruta en la app'}).click();await expect(page.locator('#courier-route-map')).toContainText('Ya no tienes acceso');await page.clock.fastForward(35000);expect(routes).toHaveLength(1);await expect(page.locator('.courier-route-map')).toHaveCount(0);
});
test('repartidor inicia, ve ruta trazada, actualiza su posición y cierra la entrega dentro de la app',async({page},testInfo)=>{
 const {routes,states}=await setup(page);
 await page.getByRole('button',{name:'Iniciar recorrido',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(page.locator('.courier-route-map')).toBeVisible();await capture(page);
 await expect(page.locator('.courier-route-status')).toContainText('Ruta actualizada');expect(routes).toHaveLength(1);
 await expect(page.locator('.leaflet-overlay-pane path[stroke="#b51c36"]')).toHaveCount(1);
  const pathBox=await page.locator('.leaflet-overlay-pane path[stroke="#b51c36"]').boundingBox(),mapBox=await page.locator('.courier-route-map').boundingBox();
  expect(pathBox.x).toBeGreaterThanOrEqual(mapBox.x);expect(pathBox.x+pathBox.width).toBeLessThanOrEqual(mapBox.x+mapBox.width);
 await expect(page.locator('a[href*="google.com/maps"]')).toHaveCount(0);
 await page.clock.fastForward(13000);await page.evaluate(()=>window.gpsFixture.callback({coords:{latitude:.121,longitude:-79.241,accuracy:7},timestamp:Date.now()}));await page.clock.fastForward(18000);
 await expect.poll(()=>routes.length).toBeGreaterThan(1);expect(routes.at(-1).latitud).toBe(.121);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations).toEqual([]);
 await page.locator('#courier-route-panel').screenshot({path:'.superpowers/sdd/2026-11-03-reparto/mapa-'+testInfo.project.name+'.png'});
 await page.getByRole('button',{name:'Llegué al destino',exact:true}).click();await expect(page.locator('a[href^="tel:"]')).toBeVisible();
 await page.getByRole('button',{name:'Pedido entregado',exact:true}).click();await expect(page.locator('#confirm-dialog')).toBeVisible();await page.locator('#confirm-dialog [value=confirm]').click();
 await expect(page.locator('#courier-route-panel')).toBeHidden();await expect(page.locator('.courier-route-map')).toHaveCount(0);await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);expect(states.map(value=>value.estado)).toEqual(['en_camino','en_destino','entregada']);
});
test('abrir ruta obtiene mi ubicación y resuelve la dirección sin campos ni cambios de estado',async({page})=>{
 const {routes,states}=await setup(page,{destination:false});await page.getByRole('button',{name:'Ver ruta en la app'}).click();
 await expect(page.locator('.courier-route-status')).toContainText('Ruta actualizada');expect(routes[0]).toEqual({latitud:.12,longitud:-79.24});expect(states).toEqual([]);
 await expect(page.locator('.courier-route input')).toHaveCount(0);await expect(page.getByText('Latitud del destino')).toHaveCount(0);
});
test('GPS denegado permite reintentar y un error del proveedor no dibuja ruta inventada',async({page})=>{
 const {routes}=await setup(page,{destination:false,routeError:true,denied:true});await page.getByRole('button',{name:'Ver ruta en la app'}).click();
 await expect(page.locator('.courier-route-status')).toContainText('Permite la ubicación');expect(routes).toEqual([]);await page.evaluate(()=>window.gpsFixture.denied=false);
 await page.getByRole('button',{name:'Usar mi ubicación',exact:true}).click();await expect(page.locator('.courier-route-status')).toContainText('No se pudo calcular');expect(routes[0]).toEqual({latitud:.12,longitud:-79.24});
 await expect(page.locator('.leaflet-overlay-pane path[stroke="#b51c36"]')).toHaveCount(0);
});
