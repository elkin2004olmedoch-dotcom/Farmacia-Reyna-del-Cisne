const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const originalFetch=global.fetch;
global.sessionStorage={getItem:()=>null,removeItem(){}};
afterEach(()=>{global.fetch=originalFetch;});
const client=()=>import('../../frontend/models/api.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('fallo de red al salir conserva la sesión visible para poder reintentar',async()=>{
 const {auth}=await import('../../frontend/models/auth.js');auth.save({usuario:{id:'synthetic-user',role:'user'}});
 global.fetch=async()=>Response.json({error:{message:'Temporal'}},{status:503});
 await assert.rejects(auth.logout());assert.equal(auth.user.id,'synthetic-user');auth.clear();
});
test('401 renueva una sola sesión y reintenta tras autenticar, sin guardar JWT ni reenviar contraseñas',async()=>{
 const {request}=await client(),seen=[];let privateCalls=0;
 global.fetch=async(url,opts)=>{seen.push({url,opts});if(url.endsWith('/auth/web/refresh'))return Response.json({data:{usuario:{id:'synthetic'}}});return ++privateCalls===1?Response.json({error:{message:'Venció'}},{status:401}):Response.json({data:{id:'pedido-sintetico'}});};
 assert.deepEqual(await request('/pedidos',{method:'POST',body:{claveSolicitud:'synthetic'}}),{id:'pedido-sintetico'});
 assert.equal(seen.length,3);assert.equal(seen[1].url,'/api/auth/web/refresh');assert.equal(seen[1].opts.headers['X-Farmacia-Web'],'1');assert.equal(seen[0].opts.headers.Authorization,undefined);assert.equal(seen[0].opts.credentials,'same-origin');
});

test('lectura pública reintenta una vez con backoff y sólo admite cookies del propio origen',async t=>{
  const {request}=await client();let calls=0,options;
  global.fetch=async(url,opts)=>{calls++;options=opts;return new Response(JSON.stringify(calls===1?{error:{message:'Temporal'}}:{data:{items:[]}}),{status:calls===1?503:200});};
  t.mock.timers.enable({apis:['setTimeout']});
  const pending=request('/productos?pageSize=4');await tick();assert.equal(calls,1);
  t.mock.timers.tick(499);await tick();assert.equal(calls,1);
  t.mock.timers.tick(1);await tick();assert.deepEqual(await pending,{items:[]});
  assert.equal(calls,2);assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');
});

test('crear pedidos, login y lecturas privadas nunca se reintentan',async()=>{
  const {request}=await client();let calls=0;
  global.fetch=async()=>{calls++;return new Response(JSON.stringify({error:{message:'Temporal'}}),{status:503});};
  for(const [route,options] of [['/pedidos',{method:'POST',body:{}}],['/auth/login',{method:'POST',body:{}}],['/auth/me',{}],['/pedidos/mis-pedidos',{}]])await assert.rejects(request(route,options),error=>error.status===503);
  assert.equal(calls,4);
});

test('servidor sin responder termina cada intento a los diez segundos y limita los reintentos',async t=>{
  const {request}=await client();let calls=0;
  global.fetch=async(url,{signal})=>{calls++;return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));};
  t.mock.timers.enable({apis:['setTimeout']});
  const result=request('/productos?pageSize=4').then(()=>null,error=>error);
  t.mock.timers.tick(10000);await tick();t.mock.timers.tick(500);await tick();
  t.mock.timers.tick(10000);await tick();
  const error=await result;assert.equal(error.status,0);assert.match(error.message,/tardando|tiempo/i);assert.equal(calls,2);
});

test('cancelación externa se conserva y no borra la sesión',async()=>{
  const {request}=await client();const controller=new AbortController();controller.abort();let calls=0;
  global.fetch=async()=>{calls++;throw new Error('Should not fetch');};
  await assert.rejects(request('/productos',{signal:controller.signal}),error=>error.name==='AbortError');assert.equal(calls,0);
});

test('el timeout incluye el cuerpo de la respuesta y no duplica una escritura',async t=>{
  const {request}=await client();let calls=0;
  global.fetch=async(url,{signal})=>{calls++;return {status:200,ok:true,json:()=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}))};};
  t.mock.timers.enable({apis:['setTimeout']});
  let finished=false;
  const result=request('/pedidos',{method:'POST',body:{}}).then(()=>null,error=>error).then(value=>{finished=true;return value;});
  await tick();t.mock.timers.tick(10000);await tick();assert.equal(finished,false,'Una escritura puede requerir más de diez segundos.');
  t.mock.timers.tick(50000);await tick();
  const error=await result;assert.match(error.message,/tardando|tiempo/i);assert.equal(calls,1);
});
test('una descarga privada permite un plazo mayor sin repetirla',async t=>{
  const {apiFetch}=await client();let calls=0,finished=false;
  global.fetch=async(url,{signal})=>{calls++;return {blob:()=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}))};};
  t.mock.timers.enable({apis:['setTimeout']});
  const result=apiFetch('/admin/facturacion/facturas/synthetic/ride',{timeoutMs:60000},response=>response.blob()).then(()=>null,error=>error).then(value=>{finished=true;return value;});
  await tick();t.mock.timers.tick(10000);await tick();assert.equal(finished,false);
  t.mock.timers.tick(50000);await tick();assert.match((await result).message,/tardando|tiempo/i);assert.equal(calls,1);
});
test('retirar ubicación permite completar el DELETE al cerrar sin cookies ni repetición',async()=>{
  const {request}=await client();let calls=0,options;
  global.fetch=async(url,value)=>{calls++;options=value;return new Response(null,{status:204});};
  await request('/entregas/entrega-sintetica/ubicacion',{method:'DELETE',keepalive:true});
  assert.equal(calls,1);assert.equal(options.keepalive,true);assert.equal(options.method,'DELETE');assert.equal(options.credentials,'same-origin');
});

test('un registro todavía pendiente consulta sólo su permiso y conserva la sesión visible',async()=>{
  const {auth}=await import('../../frontend/models/auth.js'),seen=[];
  global.fetch=async url=>{seen.push(url);return Response.json({data:{verified:false}},{status:202});};
  assert.equal(await auth.restore({registrationId:'r'.repeat(43),accept:()=>true}),null);
  assert.deepEqual(seen,['/api/auth/registro-pendiente']);
});

test('un permiso de registro ausente comprueba la cookie sin renovar ni emitir sesión vencida',async()=>{
  const {auth}=await import('../../frontend/models/auth.js'),{events}=await import('../../frontend/models/events.js'),seen=[];
  let expired=0;const count=()=>expired++;events.addEventListener('session:expired',count);
  global.fetch=async url=>{seen.push(url);return url.endsWith('/registro-pendiente')?new Response(null,{status:204}):Response.json({error:{message:'Sin sesión.'}},{status:401});};
  try{
    await assert.rejects(auth.restore({registrationId:'r'.repeat(43),accept:()=>true}),error=>error.status===401);
    assert.deepEqual(seen,['/api/auth/registro-pendiente','/api/auth/me']);assert.equal(expired,0);
  }finally{events.removeEventListener('session:expired',count);}
});

test('una comprobación de registro interrumpida permite reintentar dentro del minuto de recuperación',async t=>{
  const {auth}=await import('../../frontend/models/auth.js');let finished=false;
  global.fetch=async(url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
  t.mock.timers.enable({apis:['setTimeout']});
  const result=auth.restore({registrationId:'r'.repeat(43),accept:()=>true}).then(()=>null,error=>error).then(value=>{finished=true;return value;});
  t.mock.timers.tick(10000);await tick();assert.equal(finished,true,'el permiso debe poder reintentarse antes de que venza su recuperación de un minuto');
  assert.match((await result).message,/tardando|tiempo/i);
});
