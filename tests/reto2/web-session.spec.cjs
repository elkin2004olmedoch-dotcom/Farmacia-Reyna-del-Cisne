const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
test('sesión web privada: login, recarga, renovación y logout sin JWT en almacenamiento',async({page,context})=>{
 await page.goto('/cuenta.html');await page.locator('#login-email').fill('admin-browser@example.ec');await page.locator('#login-password').fill('AdminBrowser2026!');
 let loginBody;await page.route('**/api/auth/login',async route=>{const response=await route.fetch();loginBody=await response.json();await route.fulfill({response});});
 await page.locator('#login-form button[type=submit]').click();await page.waitForURL('**/admin.html');expect(loginBody.data.token).toBeUndefined();
 expect(await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'))).toBeNull();expect(await page.evaluate(()=>document.cookie)).not.toContain('farmacia-access');
 const cookies=await context.cookies();expect(cookies.find(c=>c.name==='farmacia-access').httpOnly).toBe(true);expect(cookies.find(c=>c.name==='farmacia-refresh').sameSite).toBe('Strict');
 await context.clearCookies({name:'farmacia-access'});await page.goto('/cuenta.html');await expect(page.locator('#profile-form')).toBeVisible();
 expect((await context.cookies()).some(c=>c.name==='farmacia-access')).toBe(true);
 await page.reload();await expect(page.locator('#profile-form')).toBeVisible();
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).first().click();await expect(page.locator('#login-form')).toBeVisible();expect((await context.cookies()).some(c=>c.name==='farmacia-refresh')).toBe(false);
});
test('recuperación por teclado: no consume el enlace al abrir y oculta el nonce',async({page})=>{
 let resets=0;await page.route('**/api/auth/reset-password',async route=>{resets++;const body=route.request().postDataJSON();expect(body.password).toBe('NuevaClaveSegura2026!');await route.fulfill({json:{ok:true,data:{message:'Contraseña actualizada. Inicia sesión con tu nueva contraseña.'}}});});
 await page.goto('/recuperar-cuenta.html#token='+'A'.repeat(43));await expect(page.locator('#recovery-reset')).toBeVisible();expect(page.url()).not.toContain('token=');expect(resets).toBe(0);
 await page.locator('#recovery-password').fill('NuevaClaveSegura2026!');await page.locator('#recovery-confirm').fill('NuevaClaveSegura2026!');await page.locator('#recovery-confirm').press('Enter');await expect(page.locator('#recovery-status')).toContainText('Contraseña actualizada');expect(resets).toBe(1);await expect(page.locator('#recovery-reset')).toBeHidden();
 await page.goto('/recuperar-cuenta.html');await page.route('**/api/auth/forgot-password',route=>route.fulfill({status:202,json:{ok:true,data:{message:'Si existe una cuenta activa, recibirás un enlace.'}}}));await page.locator('#recovery-email').fill('persona@example.ec');await page.locator('#recovery-email').press('Enter');await expect(page.locator('#recovery-status')).toContainText('recibirás un enlace');
});
