const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const originalFetch=global.fetch;
global.sessionStorage={getItem:()=>null,removeItem(){}};
afterEach(()=>{global.fetch=originalFetch;});
const client=()=>import('../../frontend/models/api.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('lectura pública reintenta una vez con backoff y omite cookies',async t=>{
  const {request}=await client();let calls=0,options;
  global.fetch=async(url,opts)=>{calls++;options=opts;return new Response(JSON.stringify(calls===1?{error:{message:'Temporal'}}:{data:{items:[]}}),{status:calls===1?503:200});};
  t.mock.timers.enable({apis:['setTimeout']});
  const pending=request('/productos?pageSize=4');await tick();assert.equal(calls,1);
  t.mock.timers.tick(499);await tick();assert.equal(calls,1);
  t.mock.timers.tick(1);await tick();assert.deepEqual(await pending,{items:[]});
  assert.equal(calls,2);assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');
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
  assert.equal(calls,1);assert.equal(options.keepalive,true);assert.equal(options.method,'DELETE');assert.equal(options.credentials,'omit');
});
