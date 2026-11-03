const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const token='A'.repeat(43);
const verifyPath='/api/auth/verify-email',resendPath='/api/auth/resend-verification';

test('confirmar una cuenta de cliente abre el catálogo con sesión, sin JWT ni nonce en la URL',async({page})=>{
  const user={id:'cliente-confirmado',nombre:'Cliente Confirmado',email:'confirmado@example.ec',telefono:'0991234567',role:'user',activo:true,emailVerifiedAt:'2026-11-02T12:00:00Z'};
  const session='synthetic-confirmed-session',requests=[];page.on('request',request=>requests.push(request.url()));
  await page.route('**/api/auth/me',route=>route.fulfill({json:{ok:true,data:user}}));
  await page.route('**'+verifyPath,route=>route.fulfill({json:{ok:true,data:{verified:true,usuario:user}}}));
  await page.goto('/confirmar-correo#token='+token);await page.locator('#verification-submit').click();
  await expect(page).toHaveURL(/\/catalogo\.html$/);
  expect(await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'))).toBeNull();
  await expect.poll(()=>page.evaluate(async()=>{const {auth}=await import('/models/auth.js');return auth.user?.id;})).toBe(user.id);
  expect(requests.every(url=>!url.includes(token)&&!url.includes(session))).toBe(true);
});

test.describe('registro con confirmación obligatoria',()=>{
  test.use({serviceWorkers:'block'});
  test('explica la indisponibilidad del envío sin crear una sesión',async({page})=>{
    let requests=0;
    await page.route('**/api/auth/register',route=>{requests++;return route.fulfill({status:503,json:{ok:false,error:{code:'EMAIL_UNAVAILABLE',message:'Servicio no disponible.'}}});});
    await page.goto('/cuenta.html');await page.locator('#show-register').click();
    for(const [name,value]of Object.entries({nombre:'Cliente Correo',email:'cliente@example.com',telefono:'0979275988',cedula:'0102030400',password:'ClienteCorreo2026!',confirm:'ClienteCorreo2026!'}))await page.locator('#register-form [name="'+name+'"]').fill(value);
    await page.locator('#register-terms').check();await page.locator('#register-form [type=submit]').click();
    await expect(page.locator('#page-status')).toContainText('Para crear tu cuenta necesitas confirmar el correo.');
    expect(requests).toBe(1);expect(await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'))).toBeNull();
    await expect(page.locator('#register-panel')).toBeVisible();await expect(page.locator('#register-form [type=submit]')).toBeEnabled();
  });
});

async function assertTokenPrivate(page,secrets=[token]){
  const content=await page.content(),storage=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));
  for(const secret of secrets){expect(page.url()).not.toContain(secret);expect(content).not.toContain(secret);expect(storage).not.toContain(secret);}
  await expect(page.locator('input[type=password]')).toHaveCount(0);
}

test('el enlace limpia el fragmento y confirma una sola vez tras una acción manual, sin iniciar sesión',async({page})=>{
  const requests=[],submitted=[];page.on('request',request=>requests.push(request.url()));
  let release;const gate=new Promise(resolve=>release=resolve);
  await page.route('**'+verifyPath,async route=>{submitted.push(route.request().postDataJSON());await gate;await route.fulfill({json:{ok:true,data:{verified:true}}});});
  await page.goto('/confirmar-correo#token='+token);
  await expect(page.locator('#verification-submit')).toBeEnabled();
  await expect(page).toHaveURL(/\/confirmar-correo$/);await assertTokenPrivate(page);expect(submitted).toEqual([]);
  try{
    await page.locator('#verification-submit').click();await expect.poll(()=>submitted.length).toBe(1);
    await expect(page.locator('#verification-submit')).toBeDisabled();
    await page.locator('#verification-submit').dispatchEvent('click');expect(submitted).toEqual([{token}]);
  }finally{release();}
  await expect(page.locator('#verification-status')).toHaveText('Correo confirmado. Ya puedes iniciar sesión');
  await expect(page.locator('#verification-status')).toBeFocused();await expect(page.locator('#verification-submit')).toBeDisabled();
  await expect(page.locator('#verification-submit')).toHaveText('Correo confirmado');
  await page.locator('#verification-submit').dispatchEvent('click');expect(submitted).toHaveLength(1);
  expect(await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'))).toBeNull();
  expect(requests.every(url=>!url.includes(token))).toBe(true);await assertTokenPrivate(page);
  await expect(page.getByRole('link',{name:'Ir a iniciar sesión'})).toHaveAttribute('href','cuenta.html');
  await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Ir a iniciar sesión'})).toBeFocused();
  const issues=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;
  expect(issues.map(issue=>({id:issue.id,targets:issue.nodes.map(node=>node.target)}))).toEqual([]);
});

test('enlaces incompletos, duplicados o con token en query no provocan confirmación ni conservan el secreto',async({page})=>{
  const submitted=[];await page.route('**'+verifyPath,route=>{submitted.push(route.request().postData());return route.fulfill({json:{ok:true,data:{verified:true}}});});
  for(const suffix of ['','#token='+token.slice(1),'#token='+token+'&token='+token,'#token='+token+'&otro=1','?token='+token,'?origen=correo#token='+token]){
    await page.goto('/confirmar-correo'+suffix);
    await expect(page.locator('#email-pending-panel')).toBeVisible();await expect(page.locator('#verification-submit')).toBeDisabled();
    await expect(page).toHaveURL(/\/confirmar-correo$/);await assertTokenPrivate(page);
    await page.locator('#verification-submit').dispatchEvent('click');
  }
  expect(submitted).toEqual([]);
});

for(const navigation of ['fragmento','historial'])test('un nuevo enlace por '+navigation+' descarta la respuesta tardía anterior sin confirmarse automáticamente',async({page})=>{
  const nextToken='B'.repeat(43),submitted=[];
  let release;const gate=new Promise(resolve=>release=resolve);
  await page.route('**'+verifyPath,async route=>{
    const body=route.request().postDataJSON();submitted.push(body);
    if(body.token===token)await gate;
    await route.fulfill({json:{ok:true,data:body.token===token?{verified:true,token:'obsolete-session',usuario:{id:'obsolete-user',role:'user'}}:{verified:true}}});
  });
  await page.goto('/confirmar-correo#token='+token);await page.locator('#verification-submit').click();
  await expect.poll(()=>submitted.length).toBe(1);await expect(page.locator('#verification-submit')).toBeDisabled();
  try{
    await page.evaluate(({nextToken,navigation})=>{
      window.verificationSameDocument=true;
      if(navigation==='fragmento')location.hash='token='+nextToken;
      else{history.pushState(null,'',location.pathname+'#token='+nextToken);history.pushState(null,'',location.pathname+'#otro');history.back();}
    },{nextToken,navigation});
    await expect(page).toHaveURL(/\/confirmar-correo$/);await expect(page.locator('#verification-submit')).toBeEnabled();
    expect(await page.evaluate(()=>window.verificationSameDocument)).toBe(true);await assertTokenPrivate(page,[token,nextToken]);
    const finished=page.waitForEvent('requestfinished',{predicate:request=>new URL(request.url()).pathname===verifyPath && request.postDataJSON()?.token===token});
    release();await finished;await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await expect(page.locator('#verification-status')).toContainText('El correo se confirma sólo cuando pulses el botón.');
    await expect(page.locator('#verification-submit')).toHaveText('Confirmar y entrar');await expect(page.locator('#verification-submit')).toBeEnabled();
    expect(submitted).toEqual([{token}]);
    await page.locator('#verification-submit').click();await expect(page.locator('#verification-status')).toHaveText('Correo confirmado. Ya puedes iniciar sesión');
    await expect(page.locator('#verification-submit')).toHaveText('Correo confirmado');expect(submitted).toEqual([{token},{token:nextToken}]);
    await assertTokenPrivate(page,[token,nextToken]);expect(await page.evaluate(()=>sessionStorage.getItem('farmacia-mvc-token'))).toBeNull();
  }finally{release();}
});

test('un error transitorio permite reintentar y un enlace vencido habilita el reenvío validado y genérico',async({page})=>{
  let attempts=0;const resends=[];
  await page.route('**'+verifyPath,route=>route.fulfill({status:++attempts===1?503:400,json:{ok:false,error:{code:attempts===1?'TEMPORARY':'EMAIL_VERIFICATION_INVALID',message:attempts===1?'Servicio temporalmente no disponible.':'<img src=x onerror=window.verificationXss=true>'+token}}}));
  const generic='Si existe una cuenta pendiente con ese correo, recibirás un nuevo enlace. Espera un minuto antes de volver a solicitarlo.';
  await page.route('**'+resendPath,route=>{resends.push(route.request().postDataJSON());return route.fulfill({status:202,json:{ok:true,data:{message:generic}}});});
  await page.goto('/confirmar-correo#token='+token);await page.locator('#verification-submit').click();
  await expect(page.locator('#verification-status')).toHaveText('Servicio temporalmente no disponible.');await expect(page.locator('#verification-submit')).toBeEnabled();
  await expect(page.locator('#verification-submit')).toHaveText('Volver a intentar');
  await assertTokenPrivate(page);await page.locator('#verification-submit').click();
  await expect(page.locator('#email-pending-panel')).toBeVisible();await expect(page.locator('#verification-submit')).toBeDisabled();
  await assertTokenPrivate(page);expect(await page.evaluate(()=>Boolean(window.verificationXss))).toBe(false);await expect(page.locator('img[src=x]')).toHaveCount(0);
  await page.evaluate(async()=>{const {connectVerificationResend}=await import('/controllers/email-verification.js');connectVerificationResend();connectVerificationResend();});
  await page.locator('#verification-email').fill('no-es-correo');await page.locator('#verification-resend-form [type=submit]').click();
  await expect(page.locator('#verification-email')).toHaveAttribute('aria-invalid','true');expect(resends).toEqual([]);
  await page.locator('#verification-email').fill('cuenta@example.com');await page.locator('#verification-resend-form [type=submit]').click();
  await expect(page.locator('#verification-resend-status')).toHaveText(generic);expect(resends).toEqual([{email:'cuenta@example.com'}]);
  await expect(page.locator('#verification-email')).toHaveAttribute('aria-invalid','false');await assertTokenPrivate(page);
});

test('el reenvío muestra errores como texto y conserva teclado y ancho móvil',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**'+resendPath,route=>route.fulfill({status:503,json:{ok:false,error:{code:'TEMPORARY',message:'<img src=x onerror=window.verificationXss=true> Intenta más tarde.'}}}));
  await page.goto('/confirmar-correo');await expect(page.locator('#email-pending-panel')).toBeVisible();
  await page.locator('#verification-email').fill('cuenta@example.com');await page.locator('#verification-resend-form [type=submit]').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#verification-resend-status')).toContainText('<img src=x');await expect(page.locator('img[src=x]')).toHaveCount(0);
  await expect(page.locator('#verification-resend-form [type=submit]')).toBeEnabled();expect(await page.evaluate(()=>Boolean(window.verificationXss))).toBe(false);
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
  await page.locator('#email-back-login').focus();await expect(page.locator('#email-back-login')).toBeFocused();await expect(page.locator('#email-back-login')).toHaveAttribute('href','cuenta.html');
  expect(errors).toEqual([]);
});

test('registro pendiente y login sin confirmar conservan el retorno, borran contraseñas y no crean sesión',async({page})=>{
  const account={nombre:'Cliente Correo',email:'cliente-correo@example.com',telefono:'0979275988',cedula:'0102030400',password:'ClienteCorreo2026!'};
  const registrations=[],resends=[],logins=[];
  const pendingMessage='Revisa tu correo para confirmar la cuenta.';
  const resendMessage='Si existe una cuenta pendiente con ese correo, recibirás un nuevo enlace.';
  await page.route('**/api/auth/register',route=>{registrations.push(route.request().postDataJSON());return route.fulfill({status:202,json:{ok:true,data:{requiresEmailVerification:true,deliveryStatus:'sent',message:pendingMessage}}});});
  await page.route('**'+resendPath,route=>{resends.push(route.request().postDataJSON());return route.fulfill({status:202,json:{ok:true,data:{message:resendMessage}}});});
  await page.route('**/api/auth/login',route=>{logins.push(route.request().postDataJSON());return route.fulfill({status:403,json:{ok:false,error:{code:'EMAIL_NOT_VERIFIED',message:'Confirma tu correo antes de iniciar sesión.'}}});});
  const assertNoSession=async()=>expect(await page.evaluate(async()=>{const {auth}=await import('/models/auth.js');return {token:sessionStorage.getItem('farmacia-mvc-token'),user:auth.user};})).toEqual({token:null,user:null});
  await page.goto('/cuenta.html?next=checkout.html');await page.locator('#show-register').click();
  for(const [name,value]of Object.entries({...account,confirm:account.password}))await page.locator('#register-form [name="'+name+'"]').fill(value);
  await page.locator('#register-terms').check();await page.locator('#register-form [type=submit]').click();
  await expect(page.locator('#email-pending-panel')).toBeVisible();
  await expect(page.getByRole('heading',{level:1,name:'Revisa tu correo',exact:true})).toBeVisible();
  await expect(page.locator('#email-pending-message')).toHaveText(pendingMessage);await expect(page.locator('#verification-email')).toHaveValue(account.email);
  await expect(page.locator('#login-panel')).toBeHidden();await expect(page.locator('#register-panel')).toBeHidden();
  for(const id of ['register-password','register-confirm','login-password'])await expect(page.locator('#'+id)).toHaveValue('');
  expect(registrations).toHaveLength(1);expect(registrations[0].email).toBe(account.email);await assertNoSession();
  await page.locator('#verification-resend-form [type=submit]').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#verification-resend-status')).toHaveText(resendMessage);expect(resends).toEqual([{email:account.email}]);await assertNoSession();
  await page.locator('#email-back-login').click();await expect(page.locator('#login-panel')).toBeVisible();
  await expect(page.locator('#email-pending-panel')).toBeHidden();await expect(page.locator('#login-email')).toBeFocused();
  await expect(page).toHaveURL(/\/cuenta\.html\?next=checkout\.html$/);
  await page.locator('#login-email').fill(account.email);await page.locator('#login-password').fill(account.password);await page.locator('#login-form [type=submit]').click();
  await expect(page.locator('#email-pending-panel')).toBeVisible();await expect(page.locator('#email-pending-message')).toHaveText('Confirma tu correo antes de iniciar sesión.');
  await expect(page.locator('#verification-email')).toHaveValue(account.email);await expect(page.locator('#login-password')).toHaveValue('');
  await expect(page.locator('#login-panel')).toBeHidden();await expect(page.locator('#register-panel')).toBeHidden();
  expect(logins).toEqual([{email:account.email,password:account.password}]);await assertNoSession();
  await expect(page).toHaveURL(/\/cuenta\.html\?next=checkout\.html$/);
});
