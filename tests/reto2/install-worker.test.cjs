const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function worker({redirectedFallback=false}={}){
  const filename=path.resolve('frontend/app-worker.js');assert.ok(fs.existsSync(filename),'Falta el worker MVC con fallback público');
  const handlers={};const entries=new Map();const reads=[];const writes=[];const deletions=[];let network=async()=>new Response('private-session-response');
  const caches={
    async open(name){return {async add(request){const key=new URL(typeof request==='string'?request:request.url,'https://farmacia.test');writes.push({name,path:key.pathname,request});entries.set(key.pathname,new Response('offline-public-fallback',{headers:{'Content-Type':'text/html'}}));},async match(request){reads.push({name,request});const response=entries.get(typeof request==='string'?request:new URL(request.url).pathname)?.clone();if(response && redirectedFallback)Object.defineProperty(response,'redirected',{value:true});return response;}};},
    async keys(){return ['farmacia-mvc-offline-old','historical-store-cache'];},async delete(name){deletions.push(name);return true;}
  };
  const self={location:{origin:'https://farmacia.test'},addEventListener:(name,listener)=>{handlers[name]=listener;},skipWaiting:async()=>{},clients:{claim:async()=>{}}};
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{self,caches,URL,Request,Response,fetch:(...args)=>network(...args)},{filename});
  async function lifecycle(name){const pending=[];handlers[name]?.({waitUntil:promise=>pending.push(promise)});await Promise.all(pending);}
  async function request(url,{method='GET',mode='navigate'}={}){
    let response;handlers.fetch({request:{url:new URL(url,'https://farmacia.test').href,method,mode},respondWith:promise=>{assert.equal(response,undefined);response=Promise.resolve(promise);}});return response;
  }
  return {handlers,writes,reads,deletions,lifecycle,request,fail:()=>{network=async()=>{throw new TypeError('offline');};}};
}

test('el worker instala solo la página genérica y limpia únicamente sus versiones anteriores',async()=>{
  const w=worker();await w.lifecycle('install');assert.equal(w.writes.length,1);assert.equal(w.writes[0].path,'/offline.html');
  assert.equal(w.writes[0].request.credentials,'omit');await w.lifecycle('activate');assert.deepEqual(w.deletions,['farmacia-mvc-offline-old']);
});

test('navegación con red conserva respuesta pero nunca la almacena',async()=>{
  const w=worker();await w.lifecycle('install');for(const url of ['/','/admin.html','/pedidos.html?pedido=synthetic','/seguimiento.html?entrega=synthetic'])assert.equal(await (await w.request(url)).text(),'private-session-response');
  assert.equal(w.writes.length,1);assert.equal(w.reads.length,0);
});

test('navegación sin red usa solo fallback público sin guardar HTML de sesión ni coordenadas',async()=>{
  const w=worker();await w.lifecycle('install');w.fail();
  for(const url of ['/admin.html','/pedidos.html','/seguimiento.html?latitud=0.12&longitud=-79.25'])assert.equal(await (await w.request(url)).text(),'offline-public-fallback');
  assert.equal(w.writes.length,1);assert.ok(w.reads.every(read=>read.request==='/offline.html'));
});

test('API, POST, recursos y otros orígenes jamás se interceptan aunque no haya red',async()=>{
  const w=worker();await w.lifecycle('install');w.fail();
  for(const [url,options] of [['/api/auth/me',{}],['/api',{mode:'navigate'}],['/api/pedidos',{method:'POST'}],['/admin.html',{method:'POST'}],['/assets/logo.png',{mode:'no-cors'}],['https://api.farmacia.test/admin.html',{}]])assert.equal(await w.request(url,options),undefined);
  assert.equal(w.writes.length,1);assert.equal(w.reads.length,0);
});

test('fallback redirigido por el alojamiento se devuelve como respuesta local sin redirección',async()=>{
  const w=worker({redirectedFallback:true});await w.lifecycle('install');w.fail();
  const response=await w.request('/catalogo');assert.equal(response.redirected,false);assert.equal(await response.text(),'offline-public-fallback');assert.equal(response.headers.get('Content-Type'),'text/html');assert.equal(w.writes.length,1);
});

test('los manifiestos diferencian tienda y administración sin cambiar el alcance ni el destino',()=>{
  const read=name=>{const file=path.resolve('frontend',name+'.webmanifest');assert.ok(fs.existsSync(file),'Falta manifiesto '+name);return JSON.parse(fs.readFileSync(file,'utf8'));};
  const store=read('store');const admin=read('admin');assert.notEqual(store.id,admin.id);assert.equal(store.start_url,'/');assert.equal(admin.start_url,'/admin.html?app=administracion');
  for(const manifest of [store,admin]){assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');assert.equal(manifest.theme_color,'#681e2a');for(const size of [192,512])assert.ok(manifest.icons.some(icon=>icon.src===`/assets/app-icons/icon-${size}.png`&&icon.sizes===`${size}x${size}`&&icon.type==='image/png'));}
});
