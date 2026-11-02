import {isClassroom} from '../models/runtime.js';
import {escape,money} from './common.js';
import {mapsLocationUrl,mapsDirectionsUrl,embedMapUrl} from '../models/deliveries.js';

export const deliveryLabels={asignada:'Asignada',en_camino:'En camino',en_destino:'En destino',entregada:'Entregada',cancelada:'Cancelada'};
const orderLabels={pendiente:'Pendiente',confirmado:'Confirmado',preparado:'Preparado',entregado:'Entregado',cancelado:'Cancelado'};
const when=value=>{const date=new Date(value);return value && Number.isFinite(date.getTime())?new Intl.DateTimeFormat('es-EC',{dateStyle:'short',timeStyle:'short',timeZone:'America/Guayaquil'}).format(date):'Sin registrar';};
export function deliveryPagination(prefix,result){
  document.getElementById(prefix+'-info').textContent=`Página ${result.page} · ${result.total} registros`;
  document.getElementById(prefix+'-prev').disabled=result.page<=1;
  document.getElementById(prefix+'-next').disabled=result.page*result.pageSize>=result.total;
}
const reference=(label,value)=>`<p class="delivery-reference">${escape(label)}: <code>${escape(value)}</code></p>`;
export function zonesView(zones){document.getElementById('delivery-zones-list').innerHTML=zones.length?`<ul class="delivery-plain-list">${zones.map(zone=>`<li><strong>${escape(zone.nombre)}</strong> · ${escape(zone.canton)}, ${escape(zone.provincia)}<br>${zone.tarifaCentavos===null?'Tarifa pendiente':money(zone.tarifaCentavos)} · ${zone.ivaCategoria==='cero'?'IVA 0 %':'IVA general'} · ${zone.activa?'Activa':'Inactiva'} <button id="zone-edit-${escape(zone.id)}" type="button" class="text-link" data-zone-edit="${escape(zone.id)}">Editar <span class="sr-only">${escape(zone.nombre)}</span></button>${reference('Código de zona',zone.id)}</li>`).join('')}</ul>`:'<p>No hay zonas registradas.</p>';}
export function couriersView(couriers){
  document.getElementById('couriers-list').innerHTML=couriers.length?`<ul class="delivery-plain-list">${couriers.map(c=>`<li><strong>${escape(c.nombre)}</strong> · ${c.activo?'Activo':'Inactivo'} <button id="courier-toggle-${escape(c.id)}" type="button" class="text-link" data-courier-toggle="${escape(c.id)}">${c.activo?'Desactivar':'Activar'} <span class="sr-only">${escape(c.nombre)}</span></button>${reference('Código de repartidor',c.id)}</li>`).join('')}</ul>`:'<p>No hay repartidores registrados.</p>';
  const select=document.getElementById('delivery-courier-select'),selected=select.value;
  select.innerHTML='<option value="">Selecciona un repartidor</option>'+couriers.filter(c=>c.activo).map(c=>`<option value="${escape(c.id)}">${escape(c.nombre)}</option>`).join('');if([...select.options].some(o=>o.value===selected))select.value=selected;
}
export function assignmentOrdersView(result){
  const select=document.getElementById('delivery-order-select'),selected=select.value;
  const orders=result.items.filter(order=>order.entrega==='delivery' && ['confirmado','preparado'].includes(order.estado));
  select.innerHTML='<option value="">Selecciona un pedido</option>'+orders.map(order=>`<option value="${escape(order.id)}">${escape(order.id.slice(0,8))} · ${escape(orderLabels[order.estado])} · ${escape(order.nombre || order.nombreComprador || 'Pedido a domicilio')}</option>`).join('');
  if([...select.options].some(o=>o.value===selected))select.value=selected;
  document.getElementById('delivery-order-codes').innerHTML=orders.length?orders.map(order=>reference('Pedido '+(order.nombre || order.nombreComprador || ''),order.id)).join(''):'<p>No hay pedidos asignables en esta página.</p>';
  deliveryPagination('delivery-orders',result);
}
export function deliveriesView(result,{admin=false,sharingId=null}={}){
  const openCodes=new Set([...document.querySelectorAll('#deliveries-list [data-delivery-codes][open]')].map(details=>details.dataset.deliveryCodes));
  document.getElementById('deliveries-list').innerHTML=result.items.length?result.items.map(item=>{
    const id=escape(item.id),destination=item.destino,url=mapsDirectionsUrl(destination),next={asignada:'en_camino',en_camino:'en_destino',en_destino:'entregada'}[item.estado],active=['en_camino','en_destino'].includes(item.estado);
    const phone=String(destination?.telefono || '').replace(/[^+\d]/g,'');
    return `<article class="delivery-card" data-delivery="${id}" aria-labelledby="delivery-title-${id}"><div class="delivery-toolbar"><h3 id="delivery-title-${id}">Pedido ${escape(item.pedidoId.slice(0,8))}</h3><strong class="delivery-badge">${escape(deliveryLabels[item.estado] || item.estado)}</strong></div><p>Pedido: ${escape(orderLabels[item.estadoPedido] || item.estadoPedido)}</p>${admin?`<details data-delivery-codes="${id}"${openCodes.has(item.id)?' open':''}><summary id="delivery-codes-${id}">Códigos para Farmi</summary>${reference('Pedido',item.pedidoId)}${reference('Entrega',item.id)}${item.repartidorId?reference('Repartidor',item.repartidorId):''}</details>`:''}${destination?`<p><strong>${escape(destination.nombre)}</strong><br>${escape(destination.direccion)}<br>${escape(destination.ciudad)}, ${escape(destination.provincia)}</p>${url?isClassroom?'<button class="text-link" type="button" data-classroom-route>Ver ruta simulada</button>':`<a class="text-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">Navegar con Google Maps ↗</a><p class="muted">Al abrir la navegación se transmite el destino a Google Maps.</p>`:''}${item.estado==='en_destino' && /^\+?\d{7,15}$/.test(phone)?isClassroom?'<button class="button button-outline" type="button" data-classroom-call>Simular llamada al cliente</button>':`<a class="button button-outline" href="tel:${escape(phone)}">Llamar al destinatario</a>`:''}`:'<p>Entrega cerrada. Los datos del destino ya no se muestran.</p>'}<div class="delivery-actions">${next?`<button id="delivery-next-${id}" type="button" class="button button-primary" data-delivery-state="${next}" data-id="${id}" ${next==='en_camino' && item.estadoPedido!=='preparado'?'disabled':''}>${({en_camino:'Marcar salida',en_destino:'Marcar llegada',entregada:'Marcar entregada'})[next]}</button>`:''}${!admin && active?`<button id="delivery-gps-${id}" type="button" class="button button-outline" data-delivery-gps="${id}">${isClassroom?'Actualizar GPS simulado':sharingId===item.id?'Detener ubicación':'Compartir mi ubicación'}</button>`:''}${admin && next?`<button id="delivery-cancel-${id}" type="button" class="button button-outline" data-delivery-state="cancelada" data-id="${id}">Cancelar entrega</button>`:''}${admin && item.estado==='asignada'?`<button id="delivery-reassign-${id}" type="button" class="text-link" data-delivery-reassign="${id}">Reasignar</button>`:''}${admin?`<a class="text-link" href="seguimiento.html?pedido=${encodeURIComponent(item.pedidoId)}">Ver seguimiento</a>`:''}</div>${next==='en_camino' && item.estadoPedido!=='preparado'?'<p>La farmacia debe preparar el pedido antes de la salida.</p>':''}</article>`;
  }).join(''):'<p class="shop-empty">No hay entregas en esta página.</p>';
  deliveryPagination('deliveries',result);
}
export function trackingView(data){
  const delivery=data.entrega,cancelled=data.estadoPedido==='cancelado' || delivery?.estado==='cancelada';
  const stages=[['asignada','Asignada','asignadaAt'],['en_camino','En camino','salidaAt'],['en_destino','En destino','llegadaAt'],['entregada','Entregada','finalizadaAt']];
  document.getElementById('tracking-content').innerHTML=`<h2>Pedido ${escape(data.pedidoId.slice(0,8))}</h2><p>Estado del pedido: <strong>${escape(orderLabels[data.estadoPedido] || data.estadoPedido)}</strong></p>${cancelled?'<p class="is-error">Pedido cancelado. El seguimiento finalizó.</p>':delivery?`<p>Entrega: <strong>${escape(deliveryLabels[delivery.estado] || delivery.estado)}</strong></p>`:'<p>La farmacia todavía no ha asignado un repartidor a este pedido.</p>'}${delivery?`<ol class="delivery-timeline" aria-label="Etapas de entrega">${stages.map(([key,label,date])=>`<li data-delivery-step="${key}"${!cancelled && delivery.estado===key?' aria-current="step"':''}><strong>${label}</strong><span>${delivery[date]?escape(when(delivery[date])):'Pendiente'}</span></li>`).join('')}</ol>`:''}`;
}
export function recentLocation(data,now=Date.now()){
  const delivery=data?.entrega,point=delivery?.ubicacion;
  if(!point || !['en_camino','en_destino'].includes(delivery.estado) || !mapsLocationUrl(point))return null;
  const age=now-new Date(point.registradaAt).getTime();return Number.isFinite(age) && age>=-15000 && age<120000?point:null;
}
export function trackingLocationView(point){
  document.getElementById('tracking-location').innerHTML=point?`<p>Última ubicación: ${escape(when(point.registradaAt))} · Ecuador continental.<br>Precisión indicada: ${escape(Math.round(point.precision))} metros.</p>${isClassroom?'<span class="muted">GPS de ejemplo · sin ubicación real</span>':`<a id="tracking-google-map" class="text-link" href="${escape(mapsLocationUrl(point))}" target="_blank" rel="noopener noreferrer">Abrir ubicación en Google Maps ↗</a>`}`:'<p>No hay una ubicación reciente compartida. El estado del pedido sigue disponible.</p>';
  document.getElementById('tracking-map-load').disabled=!point;
}
export function trackingMapView(point,enabled){
  const panel=document.getElementById('tracking-map-panel'),url=enabled && point?embedMapUrl(point):null;
  if(isClassroom && enabled && point){panel.hidden=false;panel.innerHTML=classroomMap;return;}
  if(!url){panel.replaceChildren();panel.hidden=true;return;}
  panel.hidden=false;
  let frame=panel.querySelector('iframe');if(!frame){frame=document.createElement('iframe');frame.title='Última ubicación compartida del repartidor en OpenStreetMap';frame.referrerPolicy='no-referrer';frame.loading='lazy';panel.append(frame);const credit=document.createElement('p');credit.innerHTML='© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';panel.append(credit);}
  if(frame.getAttribute('src')!==url)frame.src=url;
}

const classroomMap='<figure class="classroom-map"><svg viewBox="0 0 640 280" role="img" aria-labelledby="classroom-map-title"><title id="classroom-map-title">Mapa esquemático simulado de una entrega en Puerto Quito</title><rect width="640" height="280" fill="#edf1e9"/><path d="M0 90H640M0 200H640M130 0V280M350 0V280M540 0V280" stroke="#fff" stroke-width="25"/><path d="M80 200H350V90H540" stroke="#b51c36" stroke-width="7" stroke-linecap="round" fill="none" stroke-dasharray="10 8"/><circle cx="80" cy="200" r="13" fill="#b51c36"/><circle cx="540" cy="90" r="13" fill="#437254"/><g fill="#342f30" font-size="17" font-family="sans-serif"><text x="35" y="243">Farmacia</text><text x="470" y="50">Destino ficticio</text><text x="170" y="140">Puerto Quito · simulación</text></g></svg><figcaption>Ruta ilustrativa para clase. No representa navegación ni una ubicación real.</figcaption></figure>';
