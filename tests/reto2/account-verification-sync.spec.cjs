const {test,expect}=require('./browser-fixture.cjs');
const token='C'.repeat(43),email='pendiente@example.ec';
const user={id:'cliente-sincronizado',nombre:'Cliente Sincronizado',email,telefono:'0991234567',role:'user',activo:true,emailVerifiedAt:'2026-11-02T12:00:00Z'};

test.use({serviceWorkers:'block'});

async function pendingAccount(page,next='checkout.html'){
  await page.goto('/cuenta.html?next='+encodeURIComponent(next));
  await page.locator('#show-register').click();
  const values={nombre:'Cliente Pendiente',email:email.toUpperCase(),telefono:'0979275988',cedula:'0102030400',password:'ClienteCorreo2026!',confirm:'ClienteCorreo2026!'};
  for(const [name,value]of Object.entries(values))await page.locator('#register-form [name="'+name+'"]').fill(value);
  await page.locator('#register-terms').check();await page.locator('#register-form [type=submit]').click();
  await expect(page.locator('#email-pending-panel')).toBeVisible();
  await expect(page.locator('#email-pending-panel')).toBeFocused();
}

async function mockSession(context){
  const state={user:null,me:0,meByPage:new Map(),refresh:0,verify:0};
  await context.route('**/api/auth/me',async route=>{
    state.me++;const owner=route.request().frame().page();state.meByPage.set(owner,(state.meByPage.get(owner)||0)+1);await state.gate;
    const cookie=route.request().headers().cookie||'';
    await route.fulfill(state.user&&cookie.includes('synthetic-session=verified')?{json:{ok:true,data:state.user}}:{status:401,json:{ok:false,error:{message:'Sin sesión.'}}});
  });
  await context.route('**/api/auth/web/refresh',route=>{state.refresh++;return route.fulfill({status:204});});
  await context.route('**/api/auth/register',route=>route.fulfill({status:202,json:{ok:true,data:{requiresEmailVerification:true,message:'Revisa tu correo para confirmar la cuenta.'}}}));
  await context.route('**/api/cuenta/favoritos',route=>route.fulfill({json:{ok:true,data:[]}}));
  await context.route('**/api/cuenta/direcciones',route=>route.fulfill({json:{ok:true,data:[]}}));
  await context.route('**/api/pagos/checkout-configuracion',route=>route.fulfill({json:{ok:true,data:{practica:{disponible:false},transferencia:{disponible:false}}}}));
  await context.route('**/api/auth/verify-email',route=>{state.verify++;state.user=user;return route.fulfill({headers:{'set-cookie':'synthetic-session=verified; Path=/; HttpOnly; SameSite=Strict'},json:{ok:true,data:{verified:true,usuario:user}}});});
  return state;
}

test('la pestaña pendiente continúa tras confirmar el correo en otra pestaña del mismo contexto',async({page,context},testInfo)=>{
  const state=await mockSession(context);await pendingAccount(page);
  await page.screenshot({path:testInfo.outputPath('registro-pendiente.png')});
  const confirmation=await context.newPage();await confirmation.goto('/confirmar-correo#token='+token);
  expect(state.verify).toBe(0);await confirmation.locator('#verification-submit').focus();await confirmation.keyboard.press('Enter');
  await expect(confirmation).toHaveURL(/\/catalogo\.html$/);
  await expect(page).toHaveURL(/\/checkout\.html$/,{timeout:5000});
  await expect(page.locator('#screen-controls')).toBeEnabled();
  await expect.poll(()=>page.evaluate(async()=>{const {auth}=await import('/models/auth.js');return auth.user?.id;})).toBe(user.id);
  await expect(page.locator('#checkout-items')).not.toHaveText('Cargando carrito…');
  await expect(page.locator('#purchase-login-note')).toHaveText('Al continuar podrás revisar la entrega y el pago.');
  await page.screenshot({path:testInfo.outputPath('registro-continuado.png')});
  expect(state.verify).toBe(1);
  const storage=await confirmation.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}));
  for(const secret of [email,token,user.id,'synthetic-session'])expect(storage).not.toContain(secret);
});

async function signalFrom(source,repeat=1){
  await source.evaluate(async({user,repeat})=>{const {auth}=await import('/models/auth.js');for(let i=0;i<repeat;i++)auth.save({usuario:user});},{user,repeat});
}
async function sourcePage(context){
  const source=await context.newPage();await source.goto('/cuenta.html');await expect(source.locator('#screen-controls')).toBeEnabled();await expect(source.locator('#login-panel')).toBeVisible();return source;
}
async function flush(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function assertAnonymous(page){expect(await page.evaluate(async()=>{const {auth}=await import('/models/auth.js');return auth.user;})).toBeNull();}
async function setSession(context,state,value=user){state.user=value;await context.addCookies([{name:'synthetic-session',value:'verified',url:'http://localhost:3300',httpOnly:true,sameSite:'Strict'}]);}

test('las señales sin cookie consultan me en secuencia, sin renovar ni recargar ni mostrar errores',async({page,context})=>{
  const state=await mockSession(context);await pendingAccount(page);const source=await sourcePage(context);
  await page.evaluate(()=>{window.pendingFormMarker=true;});
  const baseline={me:state.me,refresh:state.refresh};
  let release;state.gate=new Promise(resolve=>release=resolve);
  try{
    await signalFrom(source,8);await expect.poll(()=>state.me).toBe(baseline.me+1);await flush(page);expect(state.me).toBe(baseline.me+1);
  }finally{release();}
  await expect.poll(()=>state.me).toBe(baseline.me+2);await flush(page);await expect(page.locator('#email-pending-panel')).toBeVisible();await assertAnonymous(page);
  expect(state.refresh).toBe(baseline.refresh);expect(await page.evaluate(()=>window.pendingFormMarker)).toBe(true);
  await expect(page.locator('#page-status')).not.toContainText('venció');
});

test('una sesión de otra cuenta no se aplica ni revela su perfil, incluso cambiando el correo de reenvío',async({page,context})=>{
  const state=await mockSession(context);await pendingAccount(page);const source=await sourcePage(context);
  const other={...user,id:'otra-cuenta',nombre:'Otra Identidad',email:'otra@example.ec'};await setSession(context,state,other);
  await page.locator('#verification-email').fill(other.email);
  const baseline=state.me,finished=page.waitForEvent('requestfinished',{predicate:request=>new URL(request.url()).pathname==='/api/auth/me'});
  await signalFrom(source);await finished;await flush(page);
  expect(state.me).toBe(baseline+1);await assertAnonymous(page);await expect(page.locator('#email-pending-panel')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(other.nombre);await expect(page).toHaveURL(/cuenta\.html\?next=checkout\.html$/);
});

for(const wake of ['focus','visibilitychange','pageshow'])test('recuperar '+wake+' comprueba la cookie existente sin señal de storage',async({page,context})=>{
  const state=await mockSession(context);await pendingAccount(page,'pedidos.html');await setSession(context,state);
  await page.evaluate(type=>{
    Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});
    (type==='visibilitychange'?document:window).dispatchEvent(type==='pageshow'?new PageTransitionEvent(type,{persisted:true}):new Event(type));
  },wake);
  await expect(page).toHaveURL(/\/pedidos\.html$/);
});

test('volver al login descarta una respuesta tardía y elimina listeners conservando teclado y campos',async({page,context})=>{
  const state=await mockSession(context);await pendingAccount(page);const source=await sourcePage(context);await setSession(context,state);
  let release;state.gate=new Promise(resolve=>release=resolve);const reads=()=>state.meByPage.get(page)||0,baseline=reads();
  try{
    await signalFrom(source);await expect.poll(reads).toBe(baseline+1);
    await page.locator('#email-back-login').focus();await page.keyboard.press('Enter');
    await expect(page.locator('#login-email')).toBeFocused();
    await page.locator('#login-email').fill('formulario@example.ec');await page.locator('#login-password').fill('Conservar2026!');
    release();await flush(page);await assertAnonymous(page);
    await signalFrom(source,3);await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});await flush(page);
    expect(reads()).toBe(baseline+1);await expect(page.locator('#login-email')).toHaveValue('formulario@example.ec');await expect(page.locator('#login-password')).toHaveValue('Conservar2026!');
    await expect(page.locator('#login-panel')).toBeVisible();await expect(page).toHaveURL(/cuenta\.html\?next=checkout\.html$/);
  }finally{release();}
});

test('reinicializar el controlador no duplica envío, eventos ni solicitudes paralelas',async({page,context})=>{
  const state=await mockSession(context);await pendingAccount(page);const source=await sourcePage(context);
  await page.evaluate(async()=>{const {accountController}=await import('/controllers/account.js');accountController();accountController();});
  const baseline={me:state.me,refresh:state.refresh};let release;state.gate=new Promise(resolve=>release=resolve);
  try{
    await signalFrom(source,5);await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});
    await expect.poll(()=>state.me).toBe(baseline.me+1);await flush(page);expect(state.me).toBe(baseline.me+1);
  }finally{release();}
  await expect.poll(()=>state.me).toBe(baseline.me+2);await flush(page);await expect(page.locator('#email-pending-panel')).toBeVisible();expect(state.refresh).toBe(baseline.refresh);
  await page.locator('#email-back-login').click();await page.locator('#show-register').click();await expect(page.locator('#register-panel')).toBeVisible();
});

test('login y logout emiten sólo una clave opaca y el almacenamiento bloqueado conserva el acceso',async({page,context})=>{
  await mockSession(context);await page.route('**/api/auth/logout',route=>route.fulfill({status:204}));await page.goto('/cuenta.html');
  const result=await page.evaluate(async user=>{
    const {auth,sessionSignalKey}=await import('/models/auth.js');localStorage.clear();auth.save({usuario:user});
    const login={...localStorage};await auth.logout();const logout={...localStorage};
    Storage.prototype.setItem=()=>{throw new DOMException('Blocked','SecurityError');};auth.save({usuario:user});
    return {key:sessionSignalKey,login,logout,user:auth.user.id};
  },user);
  expect(Object.keys(result.login)).toEqual([result.key]);expect(Object.keys(result.logout)).toEqual([result.key]);expect(result.login[result.key]).not.toBe(result.logout[result.key]);
  for(const data of [result.login,result.logout])for(const secret of [email,user.id,token])expect(JSON.stringify(data)).not.toContain(secret);
  expect(result.user).toBe(user.id);
});

test('la confirmación que llega durante una consulta anónima se comprueba después, sin consultas paralelas',async({page,context})=>{
  const state=await mockSession(context);await pendingAccount(page);const source=await sourcePage(context);
  let release;state.gate=new Promise(resolve=>release=resolve);const baseline=state.me;
  try{
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});window.dispatchEvent(new Event('focus'));});
    await expect.poll(()=>state.me).toBe(baseline+1);await setSession(context,state);await signalFrom(source);await flush(page);
    expect(state.me).toBe(baseline+1);release();
    await expect(page).toHaveURL(/\/checkout\.html$/,{timeout:5000});
  }finally{release();}
});

for(const [role,next,destination]of [
  ['admin','checkout.html','admin.html'],['admin','instalar-admin.html','instalar-admin.html'],
  ['admin','entregas.html?pedido=fixture','entregas.html?pedido=fixture'],['repartidor','checkout.html','entregas.html'],
  ['repartidor','entregas.html?pedido=fixture','entregas.html?pedido=fixture'],['user','https://ajeno.invalid','cuenta.html'],
])test('sincronizar '+role+' conserva el destino permitido '+destination+' desde '+next,async({page,context})=>{
  const state=await mockSession(context);await pendingAccount(page,next);const source=await sourcePage(context);await setSession(context,state,{...user,role});
  const target=new URL(destination,'http://localhost:3300/');
  await page.route(url=>url.pathname===target.pathname&&url.search===target.search,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Destino de prueba</title><h1>Destino de prueba</h1>'}));
  await signalFrom(source);await expect(page).toHaveURL(target.href);
});

test('iniciar sesión en otra pestaña permite continuar sin repetir la contraseña del registro',async({page,context})=>{
  const state=await mockSession(context);await pendingAccount(page);const source=await context.newPage();
  await source.goto('/cuenta.html?next=checkout.html');await expect(source.locator('#login-panel')).toBeVisible();
  let logins=0;await context.route('**/api/auth/login',route=>{logins++;state.user=user;return route.fulfill({headers:{'set-cookie':'synthetic-session=verified; Path=/; HttpOnly; SameSite=Strict'},json:{ok:true,data:{usuario:user}}});});
  await source.locator('#login-email').fill(email);await source.locator('#login-password').fill('ClienteCorreo2026!');await source.locator('#login-form [type=submit]').click();
  await expect(page).toHaveURL(/\/checkout\.html$/);await expect(source).toHaveURL(/\/checkout\.html$/);expect(logins).toBe(1);
});

async function holdSnapshot(page,state){
  let release,count=0;const gate=new Promise(resolve=>release=resolve);
  await page.route('**/api/auth/me',async route=>{
    const snapshot=state.user,cookie=route.request().headers().cookie||'';count++;
    if(count===1)await gate;
    await route.fulfill(snapshot&&cookie.includes('synthetic-session=verified')?{json:{ok:true,data:snapshot}}:{status:401,json:{ok:false,error:{message:'Sin sesión.'}}});
  });
  return {release,get count(){return count;}};
}

test('una segunda señal invalida el snapshot de la sesión anterior antes de aplicar o navegar',async({page,context})=>{
  const state=await mockSession(context);await pendingAccount(page);const source=await sourcePage(context);await setSession(context,state);
  const held=await holdSnapshot(page,state);await page.route('**/checkout.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Destino inesperado</title>'}));
  try{
    await signalFrom(source);await expect.poll(()=>held.count).toBe(1);
    await setSession(context,state,{...user,id:'sesion-nueva',email:'otra@example.ec'});await signalFrom(source);await flush(page);held.release();
    await expect.poll(()=>held.count).toBe(2);await flush(page);await assertAnonymous(page);await expect(page.locator('#email-pending-panel')).toBeVisible();
    await expect(page).toHaveURL(/cuenta\.html\?next=checkout\.html$/);
  }finally{held.release();}
});

test('un despertar durante una consulta anónima conserva un reintento sin depender de storage',async({page,context})=>{
  const state=await mockSession(context);await pendingAccount(page);const held=await holdSnapshot(page,state);
  try{
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});window.dispatchEvent(new Event('focus'));});
    await expect.poll(()=>held.count).toBe(1);await setSession(context,state);
    await page.evaluate(()=>{document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
    expect(held.count).toBe(1);held.release();await expect(page).toHaveURL(/\/checkout\.html$/,{timeout:5000});
  }finally{held.release();}
});
