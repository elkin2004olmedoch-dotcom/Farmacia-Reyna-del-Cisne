const {test,expect,apiToken}=require('./browser-fixture.cjs'),AxeBuilder=require('@axe-core/playwright').default;
test.use({serviceWorkers:'block'});
async function ready(page){await page.goto('/');await page.waitForFunction(()=>globalThis.FarmaciaMascota?.getStatus().availableStates.length>0);return page.locator('farmacia-mascota');}
async function advances(page){const initial=await page.evaluate(()=>FarmaciaMascota.getStatus().frame);await page.waitForFunction(frame=>FarmaciaMascota.getStatus().frame!==frame,initial);}
async function administrator(page,request){const token=await apiToken(request,'admin-browser@example.ec','AdminBrowser2026!');expect((await page.request.post('/api/auth/web/exchange',{headers:{Authorization:'Bearer '+token,Origin:'http://localhost:3300','X-Farmacia-Web':'1'},data:{}})).status()).toBe(200);await page.goto('/admin.html');await page.waitForFunction(()=>globalThis.FarmaciaMascota?.getStatus().availableStates.length>0,{timeout:15000});return page.locator('farmacia-admin-companion');}
test('una visita nueva muestra el catálogo sin advertir falsamente que venció la sesión',async({page})=>{await ready(page);await expect(page.locator('#featured-products article')).toHaveCount(4);await expect(page.locator('#page-status')).toBeHidden();});
test('mascota animada sin controles de pausa mantiene colores, teclado y adaptación',async({page},info)=>{
 const pet=await ready(page);await expect(pet.locator('#motion,#motion-toggle,.motion-controls')).toHaveCount(0);await advances(page);expect(await page.evaluate(()=>FarmaciaMascota.getStatus().character)).toBe('goti');
 for(const width of [375,768,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 expect(await page.locator('#inicio').evaluate(node=>getComputedStyle(node).backgroundColor)).toBe('rgb(104, 30, 42)');await page.screenshot({path:info.outputPath('cliente-mascota.png')});await pet.screenshot({path:info.outputPath('cliente-avatar.png')});
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations).toEqual([]);
});
test('una pausa antigua no deja estática la mascota y movimiento reducido conserva gestos',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('farmacia-motion','paused'));await page.emulateMedia({reducedMotion:'reduce'});await ready(page);await advances(page);expect(await page.evaluate(()=>FarmaciaMascota.getStatus().paused)).toBe(false);expect(await page.evaluate(()=>localStorage.getItem('farmacia-motion'))).toBeNull();await page.reload();await page.waitForFunction(()=>globalThis.FarmaciaMascota);await advances(page);
});
test('sin Canvas la mascota cliente sigue animada con SVG y el chat permite teclado',async({page})=>{
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='2d'?null:original.call(this,kind,...args);};});const pet=await ready(page);await advances(page);await expect(pet.locator('#sprite-fallback')).toBeVisible();await expect(pet.locator('#sprite-fallback image')).toHaveAttribute('href',/sprites\/goti\.png/);await pet.locator('#launcher').click();await expect(pet.locator('#input')).toBeFocused();await page.keyboard.press('Escape');await expect(pet.locator('#panel')).toBeHidden();
});
test('administración comparte la mascota azul, animación y estilo del cliente sin pausa',async({page,request},info)=>{
 const pet=await administrator(page,request);await expect(pet.locator('#motion,#motion-toggle,.motion-controls')).toHaveCount(0);await expect(pet.locator('#avatar canvas')).toBeVisible();expect(await page.evaluate(()=>FarmaciaMascota.getStatus().character)).toBe('goti');await advances(page);await pet.screenshot({path:info.outputPath('administracion-avatar.png')});
 await pet.getByRole('button',{name:'Abrir asistente administrativo'}).click();await expect(pet.locator('#input')).toBeFocused();await expect(pet.locator('#messages')).toContainText('permisos del panel');await page.keyboard.press('Escape');await expect(pet.locator('#panel')).toBeHidden();await pet.locator('#avatar').click();expect(await page.evaluate(()=>FarmaciaMascota.getStatus().state)).toBe('jumping');await page.screenshot({path:info.outputPath('administracion-mascota.png')});
 expect((await new AxeBuilder({page}).include('farmacia-admin-companion').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations).toEqual([]);
});
test('administración usa el mismo atlas animado con SVG si Canvas falla',async({page,request})=>{
 await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null;});const pet=await administrator(page,request);await advances(page);await expect(pet.locator('#sprite-fallback')).toBeVisible();await expect(pet.locator('#sprite-fallback image')).toHaveAttribute('href',/sprites\/goti\.png/);
});
