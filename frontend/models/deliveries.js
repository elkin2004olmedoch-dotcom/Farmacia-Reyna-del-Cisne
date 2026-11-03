import {request} from './api.js';
export const ZONE_FORM_DRAFT='farmacia-mvc-zona-formulario';

export const deliveries={
  zones:()=>request('/zonas-entrega'),
  adminZones:()=>request('/admin/zonas-entrega'),
  saveZone:(values,id)=>request('/admin/zonas-entrega'+(id?'/'+encodeURIComponent(id):''),{method:id?'PUT':'POST',body:values}),
  couriers:()=>request('/admin/repartidores'),
  createCourier:values=>request('/admin/repartidores',{method:'POST',body:values}),
  setCourierActive:(id,activo)=>request('/admin/repartidores/'+encodeURIComponent(id),{method:'PUT',body:{activo}}),
  list:(page=1,estado='')=>request(`/entregas?page=${page}&pageSize=20${estado?'&estado='+encodeURIComponent(estado):''}`),
  assign:values=>request('/entregas/asignar',{method:'POST',body:values}),
  changeState:(id,estado,esperadoVersion)=>request('/entregas/'+encodeURIComponent(id)+'/estado',{method:'PUT',body:{estado,esperadoVersion}}),
  shareLocation:(id,values)=>request('/entregas/'+encodeURIComponent(id)+'/ubicacion',{method:'PUT',body:values}),
  stopSharing:(id,{keepalive=false}={})=>request('/entregas/'+encodeURIComponent(id)+'/ubicacion',{method:'DELETE',keepalive}),
  tracking:pedidoId=>request('/pedidos/'+encodeURIComponent(pedidoId)+'/seguimiento'),
};

export function deliveryQuote(productCents,mode,zone){
  if(!Number.isSafeInteger(productCents) || productCents<0)return {enabled:false,shipping:null,total:null};
  if(mode==='pickup')return {enabled:true,shipping:0,total:productCents};
  if(mode!=='delivery' || !zone || zone.activa===false || !Number.isSafeInteger(zone.tarifaCentavos) || zone.tarifaCentavos<0)return {enabled:false,shipping:null,total:null};
  const total=productCents+zone.tarifaCentavos;
  return Number.isSafeInteger(total)?{enabled:true,shipping:zone.tarifaCentavos,total}:{enabled:false,shipping:null,total:null};
}

function coordinates(point){return Boolean(point) && typeof point.latitud==='number' && typeof point.longitud==='number' && Number.isFinite(point.latitud) && Number.isFinite(point.longitud) && Math.abs(point.latitud)<=90 && Math.abs(point.longitud)<=180;}
export function mapsLocationUrl(point){
  if(!coordinates(point))return null;
  const url=new URL('https://www.google.com/maps/search/');url.searchParams.set('api','1');url.searchParams.set('query',`${point.latitud},${point.longitud}`);return url.href;
}
export function mapsDirectionsUrl(destination){
  if(!destination)return null;
  let value;
  if(coordinates(destination))value=`${destination.latitud},${destination.longitud}`;
  else if([destination.direccion,destination.ciudad,destination.provincia].every(part=>typeof part==='string' && part.trim() && part.length<=300 && !/[<>\x00-\x1f]/.test(part)))value=`${destination.direccion}, ${destination.ciudad}, ${destination.provincia}, Ecuador`;
  else return null;
  const url=new URL('https://www.google.com/maps/dir/');url.searchParams.set('api','1');url.searchParams.set('destination',value);url.searchParams.set('travelmode','driving');return url.href;
}
export function embedMapUrl(point){
  if(!coordinates(point))return null;
  const url=new URL('https://www.openstreetmap.org/export/embed.html');
  url.searchParams.set('bbox',[Math.max(-180,point.longitud-.01),Math.max(-90,point.latitud-.01),Math.min(180,point.longitud+.01),Math.min(90,point.latitud+.01)].join(','));
  url.searchParams.set('layer','mapnik');url.searchParams.set('marker',`${point.latitud},${point.longitud}`);return url.href;
}
