'use strict';
const {createHash}=require('node:crypto');
const {AppError}=require('../middleware/errors.cjs');
const normalize=value=>String(value||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const problem=(code,message,status=409)=>new AppError(status,code,message);
function createGeocoder({fetch=globalThis.fetch,now=Date.now}={}){
 const cache=new Map(),pending=new Map();let last=0,queue=Promise.resolve();
 async function search(destination){
  const address=String(destination.direccion||'').trim().replace(/[\w.+-]+@[\w.-]+\.[a-z]+/gi,'').replace(/\b\d{7,15}\b/g,'');
  const city=String(destination.ciudad||'').trim(),province=String(destination.provincia||'').trim();
  if(address.length<5 || address.length>300 || !city || !province)throw problem('ADDRESS_NOT_FOUND','La dirección del pedido está incompleta.');
  const street=address.split(/\b(?:frente|junto|referencia|cerca|casa de)\b/i)[0].trim()||address;
  const terms=normalize(street).split(' ').filter(word=>word.length>2 && !/^\d+$/.test(word) && !['avenida','calle','pasaje','barrio','casa','numero','sector','canton','parroquia','del','las','los','con'].includes(word));
  const q=[street,city,province,'Ecuador'].join(', '),key=createHash('sha256').update(normalize(q)).digest('hex');
  for(const [id,row]of cache)if(row.until<=now())cache.delete(id);
  const cached=cache.get(key);if(cached){if(cached.error)throw cached.error;return cached.value;}
  if(pending.has(key))return pending.get(key);
  if(pending.size>=5)throw problem('GEOCODING_BUSY','Estamos buscando otras direcciones. Intenta de nuevo en un momento.',429);
  const work=queue.catch(()=>{}).then(async()=>{
   const delay=1100-(now()-last);if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));last=now();
   const base=new URL(process.env.GEOCODING_ORIGIN||'https://nominatim.openstreetmap.org');
   if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||base.pathname!=='/'||/^(localhost|\d+\.\d+\.\d+\.\d+)$|\.(local|localhost)$/i.test(base.hostname))throw problem('GEOCODING_UNAVAILABLE','La búsqueda de direcciones no está disponible.',503);
   const url=new URL('/search',base);url.search=new URLSearchParams({q,format:'jsonv2',addressdetails:'1',countrycodes:'ec',limit:'3','accept-language':'es'}).toString();
   let values;
   try{const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json','User-Agent':'ReinaDelCisne-Reparto/0.3 (+https://farmacia-reyna-del-cisne-pruebas.pages.dev/ayuda)'}});if(!response.ok)throw new Error();let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.byteLength;if(size>100000)throw new Error();chunks.push(chunk);}values=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!Array.isArray(values))throw new Error();}
   catch{throw problem('GEOCODING_UNAVAILABLE','No pudimos buscar la dirección. Comprueba la conexión y vuelve a intentar.',503);}
   const candidates=values.filter(row=>terms.length && terms.filter(word=>normalize(row.address?.road||row.name).includes(word)).length/terms.length>=.6 && Number(row.place_rank)>=26 && row.address?.country_code==='ec' && normalize(row.address.state||row.address.province).replace(/^provincia de /,'')===normalize(province) && Object.values(row.address).some(value=>normalize(value).includes(normalize(city))) && !['city','town','village','municipality','county','suburb','neighbourhood'].includes(row.addresstype) && Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lon)) && Math.abs(Number(row.lat))<=90 && Math.abs(Number(row.lon))<=180);
   let error;
   if(!candidates.length)error=problem('ADDRESS_NOT_FOUND','No encontramos un destino preciso para la dirección del pedido.');
   else if(candidates.slice(1).some(row=>(Math.abs(Number(row.lat)-Number(candidates[0].lat))>.001 || Math.abs(Number(row.lon)-Number(candidates[0].lon))>.001) && !(Number(row.place_rank)===26 && Number(candidates[0].place_rank)===26 && normalize(row.address.road||row.name) && normalize(row.address.road||row.name)===normalize(candidates[0].address.road||candidates[0].name))))error=problem('ADDRESS_AMBIGUOUS','La dirección coincide con varios lugares y no permite determinar un destino seguro.');
   const value=!error?{latitud:Number(candidates[0].lat),longitud:Number(candidates[0].lon),fuente:'direccion',precisionDestino:Number(candidates[0].place_rank)>=28?'direccion':'calle'}:null;
   if(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(key,{value,error,until:now()+(error?300000:86400000)});
   if(error)throw error;return value;
  });pending.set(key,work);queue=work;try{return await work;}finally{pending.delete(key);}
 }
 return {resolve:search};
}
async function prepare(buyer){
 const ec=require('../../frontend/models/ecuador.js');
 const zone=typeof buyer.zonaEntregaId==='string'?await require('./db.cjs').zonaEntrega.findUnique({where:{id:buyer.zonaEntregaId}}):null;
 if(!ec.matchesDeliveryZone(zone,buyer))throw problem('DELIVERY_OUTSIDE_COVERAGE','Selecciona una cobertura activa para tu dirección en Ecuador.');
 if(zone.tarifaCentavos===null)throw problem('DELIVERY_RATE_PENDING','La tarifa todavía no está definida. Puedes elegir retiro en farmacia.');
 if(buyer.consienteUbicacion===true&&ec.ecuadorPoint(buyer.latitudEntrega,buyer.longitudEntrega))return {latitud:buyer.latitudEntrega,longitud:buyer.longitudEntrega};
 try{const point=await module.exports.resolve({direccion:buyer.address,ciudad:buyer.city,provincia:buyer.province});return ec.ecuadorPoint(point.latitud,point.longitud)?point:null;}
 catch(error){if(['ADDRESS_NOT_FOUND','ADDRESS_AMBIGUOUS','GEOCODING_UNAVAILABLE','GEOCODING_BUSY'].includes(error.code))return null;throw error;}
}
module.exports={createGeocoder,...createGeocoder(),prepare};
