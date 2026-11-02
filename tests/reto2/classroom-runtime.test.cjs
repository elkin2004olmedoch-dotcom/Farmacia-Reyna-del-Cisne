const {test}=require('node:test');
const assert=require('node:assert/strict');
const session=new Map([['farmacia-mvc-token','sesion-real-conservada']]);
const local=new Map([['farmacia-mvc-carrito','{"real":2}']]);
const storage=map=>({getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)});
global.sessionStorage=storage(session);global.localStorage=storage(local);
global.location={pathname:'/catalogo.html',search:'?demo=clase&rol=admin'};
global.fetch=()=>{throw new Error('La demo no debe usar red.');};

test('modo clase aísla credencial, claves y descargas, incluso rutas no soportadas',async()=>{
  const runtime=await import('../../frontend/models/runtime.js');
  assert.equal(runtime.isClassroom,true);
  assert.equal(runtime.classroomRole,'admin');
  assert.equal(session.get('farmacia-clase-token'),'clase-admin');
  assert.equal(session.get('farmacia-mvc-token'),'sesion-real-conservada');
  assert.equal(runtime.storageKey('farmacia-mvc-carrito'),'farmacia-clase-carrito');
  const {request,apiFetch}=await import('../../frontend/models/api.js');
  const products=await request('/productos');assert.ok(products.items.length>0);
  await assert.rejects(request('/ruta-no-simulada'),error=>error.status===404);
  const status=await apiFetch('/admin/facturacion/facturas/no-real/xml',{},response=>response.status);
  assert.equal(status,404);
  const controller=new AbortController();controller.abort();
  await assert.rejects(request('/productos',{signal:controller.signal}),error=>error.name==='AbortError');
  assert.equal(local.get('farmacia-mvc-carrito'),'{"real":2}');
});

test('salir de clase conserva la sesión real y deja de usar claves sintéticas',async()=>{
  global.location={pathname:'/index.html',search:'?demo=salir'};
  const runtime=await import('../../frontend/models/runtime.js?salida');
  assert.equal(runtime.isClassroom,false);
  assert.equal(runtime.storageKey('farmacia-mvc-token'),'farmacia-mvc-token');
  assert.equal(session.get('farmacia-mvc-token'),'sesion-real-conservada');
  assert.equal(session.has('farmacia-modalidad-clase'),false);
});
