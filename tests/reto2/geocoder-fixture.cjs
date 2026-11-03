// Synthetic provider used only by disposable test servers; production never loads this file.
module.exports=function install(){
 const {AppError}=require('../../server/middleware/errors.cjs');
 require('../../server/models/geocoding.cjs').resolve=async target=>{if(String(target.direccion).startsWith('Sin ubicación'))throw new AppError(409,'ADDRESS_NOT_FOUND','Destino sintético no localizado.');return {latitud:.125,longitud:-79.25,fuente:'direccion',precisionDestino:'calle'};};
 // Replace only the external OSRM transport; route authorization and validation stay real.
 const routing=require('../../server/models/rutas.cjs');
 Object.assign(routing,routing.createRouting({fetch:async url=>{
  const coordinates=new URL(url).pathname.split('/').at(-1).split(';').map(point=>point.split(',').map(Number));
  return new Response(JSON.stringify({code:'Ok',routes:[{distance:1800,duration:240,geometry:{type:'LineString',coordinates}}]}),{headers:{'Content-Type':'application/json'}});
 }}));
};
