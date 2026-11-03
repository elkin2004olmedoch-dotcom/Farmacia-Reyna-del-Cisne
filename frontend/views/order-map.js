import {escape} from './common.js';
import {mapsDirectionsUrl,embedMapUrl} from '../models/deliveries.js';
import {recentLocation} from './deliveries.js';

// This is the pharmacy's existing Maps search from the location section, not a GPS coordinate.
const pharmacyUrl='https://www.google.com/maps/search/?api=1&query=Farmacia+Reina+del+Cisne+Puerto+Quito';
const active=order=>['pendiente','confirmado','preparado'].includes(order?.estado);
const validDate=value=>typeof value==='string' && Number.isFinite(Date.parse(value));
export function orderMapData(order,tracking=null,now=Date.now()){
  if(!active(order))return {closed:true,point:null,embedUrl:null,directionsUrl:null};
  if(tracking?.pedidoId===order.id && (['entregado','cancelado'].includes(tracking.estadoPedido) || ['entregada','cancelada'].includes(tracking.entrega?.estado)))return {closed:true,point:null,embedUrl:null,directionsUrl:null};
  if(order.entrega==='pickup')return {closed:false,point:null,embedUrl:null,directionsUrl:pharmacyUrl,kind:'pickup'};
  if(order.entrega!=='delivery')return {closed:true,point:null,embedUrl:null,directionsUrl:null};
  const destination={latitud:order.latitudEntrega,longitud:order.longitudEntrega};
  const destinationPoint=validDate(order.ubicacionEntregaAceptadaAt) && embedMapUrl(destination)?destination:null;
  const recent=tracking?.pedidoId===order.id && tracking.estadoPedido===order.estado?recentLocation(tracking,now):null;
  const courier=recent && Number.isFinite(recent.precision) && recent.precision>=0 && recent.precision<=10000?recent:null;
  const point=courier || destinationPoint;
  return {closed:false,point,kind:courier?'courier':destinationPoint?'destination':null,embedUrl:point?embedMapUrl(point):null,directionsUrl:mapsDirectionsUrl({direccion:order.direccion,ciudad:order.ciudad,provincia:order.provincia})};
}
const mapIcon='<svg viewBox="0 0 64 64" width="58" height="58" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m7 19 16-6 18 6 16-6v36l-16 6-18-6-16 6V19Z"/><path d="M23 13v36m18-30v36"/><path d="M42 19c0 8-10 17-10 17S22 27 22 19a10 10 0 1 1 20 0Z" fill="var(--surface,#fffefa)"/><circle cx="32" cy="19" r="3"/></svg>';
export function orderMapPanel(order){
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(order?.id || ''))return '';
  const id=escape(order.id),data=orderMapData(order),title=order.entrega==='pickup'?'Cómo llegar a la farmacia':'Mapa de tu entrega';
  if(data.closed)return `<section class="order-map-panel order-map-closed" data-order-map-panel="${id}"><h3>${title}</h3><p>Este pedido ya está cerrado. No se muestra información de ubicación.</p></section>`;
  if(data.kind==='pickup')return `<section class="order-map-panel order-map-pickup" data-order-map-panel="${id}"><div class="order-map-heading">${mapIcon}<div><h3>${title}</h3><p>Consulta cómo llegar para retirar tu pedido.</p></div></div><a class="text-link" href="${escape(data.directionsUrl)}" target="_blank" rel="noopener noreferrer">Abrir ubicación en Google Maps ↗</a><p class="order-map-privacy">Google Maps se abre sólo cuando eliges el enlace.</p></section>`;
  return `<section class="order-map-panel" data-order-map-panel="${id}"><div class="order-map-heading"><div><h3>${title}</h3><p>Consulta el punto de entrega o la última ubicación compartida, cuando estén disponibles.</p></div><button type="button" class="text-link" data-order-map-close="${id}" hidden>Cerrar mapa</button></div><div class="order-map-preview" data-order-map-preview>${mapIcon}<button type="button" class="button button-outline" data-order-map="${id}" aria-expanded="false" aria-controls="order-map-canvas-${id}">Ver mapa</button><span>Se carga únicamente cuando lo solicitas.</span></div><div id="order-map-canvas-${id}" class="order-map-canvas" data-order-map-canvas hidden></div><p class="order-map-status" data-order-map-status role="status" aria-live="polite"></p><div class="order-map-links">${data.directionsUrl?`<a class="text-link" href="${escape(data.directionsUrl)}" target="_blank" rel="noopener noreferrer">Abrir dirección en Google Maps ↗</a>`:''}<a class="text-link" href="seguimiento.html?pedido=${encodeURIComponent(order.id)}">Consultar seguimiento →</a></div><p class="order-map-privacy">Al cargar el mapa compartes el punto con OpenStreetMap. El enlace de Google Maps comparte el destino al abrirlo.</p></section>`;
}
