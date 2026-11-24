export async function retireInstallations(){
  try{
    const registrations=await navigator.serviceWorker?.getRegistrations?.() || [];
    const own=registrations.filter(registration=>[registration.active,registration.waiting,registration.installing].some(worker=>{
      if(!worker)return false;
      const url=new URL(worker.scriptURL);
      return url.origin===location.origin && /^\/(?:app-worker|service-worker)\.js$/.test(url.pathname);
    }));
    await Promise.all(own.map(registration=>registration.unregister()));
    if('caches' in globalThis){
      const keys=await caches.keys();
      await Promise.all(keys.filter(key=>key.startsWith('farmacia-mvc-offline-') || key.startsWith('farmacia-reina-shell-')).map(key=>caches.delete(key)));
    }
  }catch(_){}
}
