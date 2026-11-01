const CACHE_PREFIX='farmacia-mvc-offline-';
const CACHE_NAME=CACHE_PREFIX+'v2';
const OFFLINE_URL='/offline.html';

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.add(new Request(new URL(OFFLINE_URL,self.location.origin),{cache:'reload',credentials:'omit'}))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX) && key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET' || request.mode!=='navigate' || url.origin!==self.location.origin || /^\/api(?:\/|$)/i.test(url.pathname))return;
  // Session HTML stays on the network. The only stored response is this public fallback.
  event.respondWith(fetch(request).catch(async()=>{
    const cached=await(await caches.open(CACHE_NAME)).match(OFFLINE_URL);
    // Static hosts redirect .html to clean URLs; navigation cannot reuse that redirect.
    return cached?new Response(cached.body,{status:cached.status,statusText:cached.statusText,headers:cached.headers}):Response.error();
  }));
});
