const {test,expect,apiToken}=require('./browser-fixture.cjs');
test('el acceso acepta un nombre de usuario y conserva la entrada por correo',async({page,request})=>{
  await page.goto('/cuenta.html');
  await expect(page.getByLabel('Usuario o correo electrónico',{exact:true})).toHaveAttribute('type','text');
  await page.route('**/api/auth/login',async route=>{const body=route.request().postDataJSON();expect(body.email).toBe('administrador');await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({ok:false,error:{message:'Credenciales inválidas.'}})});});
  await page.locator('#login-email').fill('Administrador');await page.locator('#login-password').fill('x');
  const login=page.waitForRequest(request=>request.url().endsWith('/api/auth/login'));await page.locator('#login-form [type=submit]').click();await login;
  await expect(page.locator('#page-status')).toContainText('Credenciales inválidas');await expect(page.locator('#login-email-error')).toBeHidden();
  await page.unroute('**/api/auth/login');
  await page.locator('#login-email').fill('admin-browser@example.ec');await page.locator('#login-password').fill('AdminBrowser2026!');await page.locator('#login-form [type=submit]').click();
  await expect(page.locator('#admin-area')).toBeVisible();
});

test('un usuario creado en administración inicia sesión por su nombre y recibe su sesión web',async({page,request})=>{
  const token=await apiToken(request,'admin-browser@example.ec','AdminBrowser2026!');
  const username='usuario_web_'+test.info().project.name;
  const created=await request.post('/api/admin/usuarios',{headers:{Authorization:'Bearer '+token},data:{nombre:'Cuenta de Prueba',username,email:username+'@example.ec',telefono:'0991234567',role:'user',activo:true,password:'UsuarioPrueba2026!'}});expect(created.status()).toBe(201);
  await page.goto('/cuenta.html');await page.locator('#login-email').fill(username.toUpperCase());await page.locator('#login-password').fill('UsuarioPrueba2026!');await page.locator('#login-form [type=submit]').click();
  await expect(page.locator('#profile-form')).toBeVisible();await expect(page.locator('#profile-greeting')).toContainText('Cuenta de Prueba');
  const me=await page.request.get('/api/auth/me');expect(me.status()).toBe(200);expect((await me.json()).data.username).toBe(username);
});

test('un acceso por usuario pendiente de verificación solicita un correo válido para reenviar el enlace',async({page})=>{
  await page.route('**/api/auth/login',route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({ok:false,error:{code:'EMAIL_NOT_VERIFIED',message:'Confirma el correo de tu cuenta.'}})}));
  await page.route('**/api/auth/resend-verification',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:{message:'Solicitud recibida.'}})}));
  await page.goto('/cuenta.html');await page.locator('#login-email').fill('usuario_pendiente');await page.locator('#login-password').fill('UsuarioPrueba2026!');await page.locator('#login-form [type=submit]').click();
  await expect(page.locator('#email-pending-panel')).toBeVisible();await expect(page.locator('#verification-email')).toHaveValue('');
  await expect(page.locator('#email-pending-message')).toContainText('Escribe el correo');
  await page.locator('#verification-email').fill('pendiente@example.ec');
  const resend=page.waitForRequest(request=>request.url().includes('/api/auth/resend-verification'));await page.locator('#verification-resend-form [type=submit]').click();expect((await resend).postDataJSON().email).toBe('pendiente@example.ec');
});
