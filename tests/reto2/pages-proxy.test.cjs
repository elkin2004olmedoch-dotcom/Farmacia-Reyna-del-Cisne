const {test}=require('node:test'),assert=require('node:assert/strict');
test('proxy: origen exacto, destino fijo, sólo cookies propias y Set-Cookie privado',async()=>{
 const {createProxy}=await import('../../scripts/pages-worker.mjs');let seen;
 const proxy=createProxy(async(url,options)=>{seen={url,options};return new Response('{"ok":true}',{headers:{'Set-Cookie':'__Host-farmacia-access=synthetic; Path=/; Secure; HttpOnly; SameSite=Strict','Cache-Control':'public','Content-Type':'application/json'}});});
 const response=await proxy(new Request('https://farmacia.example/api/auth/login',{method:'POST',headers:{Origin:'https://farmacia.example','X-Farmacia-Web':'1',Cookie:'__Host-farmacia-access=synthetic; unrelated=private','X-Forwarded-For':'evil'},body:'{}'}),{});
 assert.equal(seen.url,'https://farmacia-reina-del-cisne.onrender.com/api/auth/login');assert.equal(seen.options.redirect,'manual');assert.equal(seen.options.headers.get('Cookie'),'__Host-farmacia-access=synthetic');assert.equal(seen.options.headers.get('X-Forwarded-For'),null);assert.match(response.headers.get('Set-Cookie'),/HttpOnly/);assert.equal(response.headers.get('Cache-Control'),'no-store');
 seen=null;assert.equal((await proxy(new Request('https://farmacia.example/api/auth/login',{method:'POST',headers:{Origin:'https://evil.example'}}),{})).status,403);assert.equal(seen,null);
 assert.equal((await proxy(new Request('https://farmacia.example/assets/logo.svg'),{ASSETS:{fetch:()=>new Response('asset')}})).status,200);
 const redirect=createProxy(async()=>new Response(null,{status:302,headers:{Location:'https://evil.example'}}));assert.equal((await redirect(new Request('https://farmacia.example/api/salud'),{})).status,502);
});
for(const status of [429,502,503,504])test(`proxy: bloqueo HTML ${status} devuelve un error legible sin scripts ni cookies del proveedor`,async()=>{
 const {createProxy}=await import('../../scripts/pages-worker.mjs');let calls=0;
 const proxy=createProxy(async()=>{calls++;return new Response('<html><script>challenge()</script>Just a moment</html>',{status,headers:{'Content-Type':'text/html','Set-Cookie':'cf_clearance=synthetic; Secure','Content-Security-Policy':"default-src 'none'"}});});
 const response=await proxy(new Request('https://farmacia.example/api/auth/login',{method:'POST',headers:{Origin:'https://farmacia.example'},body:'{}'}),{});
 assert.equal(response.status,status);assert.equal(calls,1);assert.match(response.headers.get('Content-Type'),/application\/json/);assert.equal(response.headers.get('Set-Cookie'),null);assert.equal(response.headers.get('Content-Security-Policy'),null);assert.equal(response.headers.get('Cache-Control'),'no-store');
 const payload=await response.json();assert.equal(payload.ok,false);assert.match(payload.error.message,status===429?/temporalmente limitado/:/tardando en responder/);assert.doesNotMatch(JSON.stringify(payload),/challenge|cf_clearance|<html>/);
});
test('proxy: conserva el error JSON de límite de la aplicación sin repetir la solicitud',async()=>{
 const {createProxy}=await import('../../scripts/pages-worker.mjs');let calls=0;
 const payload={ok:false,error:{message:'Espera antes de otro intento.',code:'AUTH_RATE_LIMITED'}};
 const proxy=createProxy(async()=>{calls++;return Response.json(payload,{status:429,headers:{'Retry-After':'60'}});});
 const response=await proxy(new Request('https://farmacia.example/api/auth/login',{method:'POST',headers:{Origin:'https://farmacia.example'},body:'{}'}),{});
 assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'60');assert.deepEqual(await response.json(),payload);assert.equal(calls,1);
});
