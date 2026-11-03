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
