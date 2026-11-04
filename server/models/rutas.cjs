'use strict';
const {AppError}=require('../middleware/errors.cjs');
const {ecuadorPoint}=require('../../frontend/models/ecuador.js');
const fail=(code,message,status=409)=>{throw new AppError(status,code,message);};
const point=(lat,lon)=>typeof lat==='number' && typeof lon==='number' && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat)<=90 && Math.abs(lon)<=180;
const meters=(a,b)=>{const rad=Math.PI/180,dlat=(b[1]-a[1])*rad,dlon=(b[0]-a[0])*rad,s=Math.sin(dlat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dlon/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(s)));};
function createRouting({find=(...args)=>require('./entregas.cjs').find(...args),resolve=value=>require('./geocoding.cjs').resolve(value),fetch=globalThis.fetch,now=Date.now,saveEstimate=(...args)=>require('./delivery-progress.cjs').saveEstimate(...args)}={}){
 const cache=new Map();let availableAt=0;
 const open=item=>{if(!['asignada','en_camino','en_destino'].includes(item.estado)||!item.destino)fail('DELIVERY_CLOSED','Esta entrega ya no admite navegación.');return item;};
 return {async calculate(id,user,input){
  const item=open(await find(id,user));
  const position=item.ubicacion,sample=Date.parse(position?.registradaAt),shared=['en_camino','en_destino'].includes(item.estado)&&point(position?.latitud,position?.longitud)&&Number.isFinite(sample)&&now()-sample<120000&&sample-now()<=15000;
  const origin=shared?{latitud:position.latitud,longitud:position.longitud}:input;
  for(const [key,value]of cache)if(value.expires<=now())cache.delete(key);
  const destination=item.destino;
  const national=destination.alcance==='nacional';
  if(input.latitudDestino!==undefined || input.longitudDestino!==undefined)fail('DESTINATION_ALREADY_DEFINED','La ruta utiliza la dirección del pedido.');
  const target=point(destination.latitud,destination.longitud)?{latitud:destination.latitud,longitud:destination.longitud,fuente:'cliente'}:await resolve(destination);
  open(await find(id,user));
  const end=[target.longitud,target.latitud],start=[origin.longitud,origin.latitud];
  if(!point(end[1],end[0]))fail('ADDRESS_NOT_FOUND','No se pudo encontrar el destino del pedido.');
  if(!point(start[1],start[0]) || meters(start,end)>(national?2000000:100000) || national&&(!ecuadorPoint(start[1],start[0])||!ecuadorPoint(end[1],end[0])))fail('ROUTE_OUTSIDE_AREA','No se puede calcular un recorrido dentro de la cobertura entre esos puntos.');
  const key=id+':'+(destination.alcance||'local')+':'+[...start,...end].map(value=>value.toFixed(5)).join(',');
  const persist=async(latest,result)=>{const position=latest.ubicacion;if(shared&&position&&position.latitud===origin.latitud&&position.longitud===origin.longitud&&['en_camino','en_destino'].includes(latest.estado))await saveEstimate(latest,result);};
  const saved=cache.get(key);if(saved){const latest=open(await find(id,user));if(latest.version!==item.version||latest.gpsVersion!==item.gpsVersion||latest.repartidorId!==item.repartidorId)fail('DELIVERY_CHANGED','La entrega o ubicación cambió; actualiza la ruta.');await persist(latest,saved.data);return saved.data;}
  if(now()<availableAt)fail('ROUTE_RATE_LIMIT','Espera un momento antes de calcular otra ruta.',429);
  availableAt=now()+1100;
  const url=new URL('https://routing.openstreetmap.de/routed-car/route/v1/driving/'+start.join(',')+';'+end.join(','));
  url.search=new URLSearchParams({overview:national?'simplified':'full',geometries:'geojson',steps:'false',alternatives:'false',generate_hints:'false'}).toString();
  let route;
  try{
   const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json','User-Agent':'ReinaDelCisne-Reparto/0.2 (+https://farmacia-reyna-del-cisne-pruebas.pages.dev/ayuda)'}});
   if(!response.ok)throw new Error('provider');
   let size=0;const chunks=[];
   for await(const chunk of response.body){size+=chunk.byteLength;if(size>750000){await response.body.cancel().catch(()=>{});throw new Error('size');}chunks.push(chunk);}
   const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));route=data.routes?.[0];
   if(data.code!=='Ok'||!route||!Number.isFinite(route.distance)||route.distance<0||route.distance>(national?3000000:500000)||!Number.isFinite(route.duration)||route.duration<0||route.geometry?.type!=='LineString')throw new Error('route');
   const coordinates=route.geometry.coordinates;
   if(!Array.isArray(coordinates)||coordinates.length<2||coordinates.length>20000||coordinates.some(p=>!Array.isArray(p)||p.length!==2||!point(p[1],p[0]))||meters(coordinates[0],start)>3000||meters(coordinates.at(-1),end)>3000)throw new Error('geometry');
  }catch{fail('ROUTE_UNAVAILABLE','No se pudo calcular una ruta por las calles. Comprueba la conexión y vuelve a intentarlo.',503);}
  // Never keep a transaction open during a provider request; authorize again after it.
  const latest=open(await find(id,user));
  if(latest.version!==item.version||latest.gpsVersion!==item.gpsVersion||latest.repartidorId!==item.repartidorId||latest.estado!==item.estado)fail('DELIVERY_CHANGED','La entrega o ubicación cambió; actualiza la ruta.');
  if(['latitud','longitud','direccion','ciudad','provincia','alcance'].some(key=>latest.destino[key]!==destination[key]))fail('DESTINATION_CHANGED','El destino cambió. Actualiza la entrega.');
  const result={geometry:route.geometry,destino:target,distance:route.distance,duration:route.duration,calculatedAt:new Date(now()).toISOString(),provider:'OSRM · FOSSGIS',attribution:'© OpenStreetMap contributors'};
  await persist(latest,result);
  if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{data:result,expires:now()+30000});return result;
 }};
}
module.exports={createRouting,...createRouting()};
