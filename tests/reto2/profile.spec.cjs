const {test,expect}=require('./browser-fixture.cjs');
const AxeBuilder=require('@axe-core/playwright').default;
const {randomUUID}=require('node:crypto');
// Fault injection must reach Playwright routes rather than a newly claimed PWA worker.
test.use({serviceWorkers:'block'});
async function session(request,role){
 const adminResponse=await request.post('/api/auth/login',{data:{email:'admin-browser@example.ec',password:'AdminBrowser2026!'}});expect(adminResponse.status()).toBe(200);const admin=(await adminResponse.json()).data;
 if(role==='admin')return admin;
 const values={nombre:'Perfil Prueba',email:'perfil-'+randomUUID().slice(0,8)+'@example.ec',telefono:'0991234567',password:'PerfilPrueba2026!'};
 if(role==='repartidor'){const created=await request.post('/api/admin/repartidores',{headers:{Authorization:'Bearer '+admin.token},data:values});expect(created.status()).toBe(201);const logged=await request.post('/api/auth/login',{data:{email:values.email,password:values.password}});expect(logged.status()).toBe(200);return (await logged.json()).data;}
 const created=await request.post('/api/auth/register',{data:{...values,cedula:'0102030400'}});expect(created.status()).toBe(201);return (await created.json()).data;
}
for(const role of ['user','admin','repartidor'])test(`perfil ${role}: entra, valida, cancela y guarda sólo datos propios`,async({page,request})=>{
 const saved=await session(request,role),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(token=>sessionStorage.setItem('farmacia-mvc-token',token),saved.token);
 try{
  await page.goto(role==='admin'?'/admin.html':role==='repartidor'?'/entregas.html':'/catalogo.html');
  if(role!=='repartidor'){const pet=page.locator(role==='admin'?'farmacia-admin-companion':'farmacia-mascota');await pet.locator('#launcher').click();await pet.locator('#input').fill('perfil');await pet.locator('#form button[type=submit]').click();await pet.getByRole('link',{name:'Abrir mi perfil'}).click();}
  else await page.locator('[data-staff-profile]').click();
  await expect(page).toHaveURL(/cuenta.html$/);const form=page.locator('#profile-form');await expect(form).toBeVisible();await expect(form.locator('input')).toHaveCount(2);await expect(page.locator('#profile-name')).toHaveValue(saved.usuario.nombre);await expect(form.locator('[name=email],[name=role],[type=password]')).toHaveCount(0);
  await page.locator('#profile-name').fill('Otro Nombre');await page.getByRole('button',{name:'Cancelar cambios'}).click();await expect(page.locator('#profile-name')).toHaveValue(saved.usuario.nombre);
  await page.locator('#profile-phone').fill('123');await page.getByRole('button',{name:'Guardar cambios'}).click();await expect(page.locator('#profile-phone')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#profile-phone-error')).toBeVisible();
  await page.locator('#profile-name').fill('Nombre Actualizado');await page.locator('#profile-phone').fill('0979275988');await page.getByRole('button',{name:'Guardar cambios'}).focus();await page.keyboard.press('Enter');await expect(page.locator('#profile-status')).toHaveText('Perfil actualizado.');await expect(page.locator('#profile-greeting')).toContainText('Nombre Actualizado');await expect(page.locator('#profile-phone')).toHaveValue('+593979275988');
  const me=await request.get('/api/auth/me',{headers:{Authorization:'Bearer '+saved.token}});expect(me.status()).toBe(200);const user=(await me.json()).data;expect(user.id).toBe(saved.usuario.id);expect(user.role).toBe(role);expect(user.email).toBe(saved.usuario.email);expect(user.nombre).toBe('Nombre Actualizado');
  await page.reload();await expect(page.locator('#profile-name')).toHaveValue('Nombre Actualizado');expect((await new AxeBuilder({page}).include('#account-area').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations).toEqual([]);expect(await form.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
 }finally{if(role==='admin')await request.put('/api/auth/me',{headers:{Authorization:'Bearer '+saved.token},data:{nombre:saved.usuario.nombre,telefono:saved.usuario.telefono}});}
});
test('perfil muestra fallos y limpia los datos al vencer la sesión',async({page,request})=>{
 const saved=await session(request,'user');await page.addInitScript(token=>sessionStorage.setItem('farmacia-mvc-token',token),saved.token);await page.goto('/cuenta.html');
 await page.route('**/api/auth/me',route=>route.request().method()==='PUT'?route.fulfill({status:503,json:{ok:false,error:{message:'No se pudo guardar. Inténtalo de nuevo.'}}}):route.continue());await page.locator('#profile-name').fill('Perfil Conservado');await page.getByRole('button',{name:'Guardar cambios'}).click();await expect(page.locator('#profile-status')).toContainText('No se pudo guardar');await expect(page.locator('#profile-name')).toHaveValue('Perfil Conservado');await expect(page.getByRole('button',{name:'Guardar cambios'})).toBeEnabled();
 await page.unroute('**/api/auth/me');await request.post('/api/auth/logout',{headers:{Authorization:'Bearer '+saved.token}});await page.getByRole('button',{name:'Guardar cambios'}).click();await expect(page.locator('#login-form')).toBeVisible();await expect(page.locator('#profile-form')).toHaveCount(0);expect(await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'))).toBeNull();
});
