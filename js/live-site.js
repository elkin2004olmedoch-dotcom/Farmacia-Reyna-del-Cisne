(function(global) {
  'use strict';
  function destination(config,current,base) {
    if(!config || typeof config.appOrigin!=='string' || !/^https:\/\/[a-z0-9][a-z0-9-]*\.onrender\.com$/.test(config.appOrigin))return null;
    const location=new URL(current),root=new URL(base);
    if(location.origin===config.appOrigin || !location.pathname.startsWith(root.pathname))return null;
    const page=location.pathname.slice(root.pathname.length) || 'index.html';
    if(!/^(index|catalogo|producto|comparar|cuenta|checkout|pedidos|ayuda|admin)\.html$/.test(page))return null;
    return new URL(page+location.search+location.hash,config.appOrigin+'/').href;
  }
  if(typeof module!=='undefined' && module.exports)module.exports={destination};
  const script=global.document?.currentScript?.src;
  if(!script || !/^https?:$/.test(global.location.protocol))return;
  const root=new URL('../',script);
  fetch(new URL('data/deployment.json',root),{cache:'no-store'})
    .then(response=>response.ok?response.json():null)
    .then(config=>{const url=destination(config,global.location.href,root.href);if(url)global.location.replace(url);})
    .catch(()=>{/* La tienda estática sigue disponible hasta configurar la aplicación publicada. */});
})(globalThis);
