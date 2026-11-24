import {auth} from '../models/auth.js';
import {events} from '../models/events.js';
import {deliveries} from '../models/deliveries.js';
import {orderMapData} from '../views/order-map.js';

const connections=new WeakMap();
const isFinal=state=>['entregado','cancelado'].includes(state);
const allowed=()=>auth.user && ['user','admin'].includes(auth.user.role);
function mapOrder(order){
  return Object.fromEntries(['id','userId','estado','entrega','updatedAt','direccion','ciudad','provincia','latitudEntrega','longitudEntrega','ubicacionEntregaAceptadaAt'].map(key=>[key,order[key]]));
}
export function connectOrderMaps(area){
  if(!area)return ()=>{};
  if(connections.has(area))return connections.get(area);
  let orders=new Map(),entries=new Map(),closedOrders=new Set(),batch='',generation=0;
  const panels=()=>area.querySelectorAll('[data-order-map-panel]');
  function status(panel,text,error=false){const node=panel?.querySelector('[data-order-map-status]');if(node){node.textContent=text;node.setAttribute('role',error?'alert':'status');}}
  function clear(entry,text='',error=false){
    entry.sequence++;entry.point=null;entry.kind=null;entry.loading=false;entry.checking=false;
    const panel=entry.panel;if(!panel)return;
    for(const frame of panel.querySelectorAll('iframe')){frame.removeAttribute('src');frame.remove();}
    const canvas=panel.querySelector('[data-order-map-canvas]');if(canvas){canvas.replaceChildren();canvas.hidden=true;}
    const preview=panel.querySelector('[data-order-map-preview]');if(preview)preview.hidden=false;
    const close=panel.querySelector('[data-order-map-close]');if(close)close.hidden=true;
    const button=panel.querySelector('[data-order-map]');if(button){button.disabled=false;button.removeAttribute('aria-busy');button.setAttribute('aria-expanded','false');}
    status(panel,text,error);
  }
  function clearAll(text=''){
    generation++;for(const entry of entries.values())clear(entry,text);entries.clear();
  }
  function expire(){
    clearAll();orders.clear();batch='';closedOrders.clear();
    for(const panel of panels()){panel.replaceChildren();panel.hidden=true;}
  }
  function closedPanel(panel){
    for(const frame of panel.querySelectorAll('iframe')){frame.removeAttribute('src');frame.remove();}
    panel.replaceChildren();const note=document.createElement('p');note.textContent='Este pedido ya está cerrado. No se muestra información de ubicación.';panel.append(note);panel.classList.add('order-map-closed');
  }
  function finish(id,entry){
    closedOrders.add(id);const order=orders.get(id);
    if(order){order.latitudEntrega=null;order.longitudEntrega=null;order.ubicacionEntregaAceptadaAt=null;}
    orders.delete(id);batch='';clear(entry);closedPanel(entry.panel);entries.delete(id);
  }
  // Root calls this before replacing order cards, or after creating the confirmation panel.
  // Invalidation never inserts a panel or starts a request.
  function updateOrderMaps(values){
    if(!allowed()){expire();return;}
    const incoming=new Map();
    for(const value of Array.isArray(values)?values:[]){
      if(!value || !/^[a-zA-Z0-9_-]{1,100}$/.test(value.id || '') || auth.user.role==='user' && value.userId && value.userId!==auth.user.id)continue;
      const order=mapOrder(value);if(isFinal(order.estado))closedOrders.add(order.id);
      if(closedOrders.has(order.id)){order.estado=isFinal(order.estado)?order.estado:'entregado';order.latitudEntrega=null;order.longitudEntrega=null;order.ubicacionEntregaAceptadaAt=null;}
      incoming.set(order.id,order);
    }
    const next=JSON.stringify([...incoming]);if(next!==batch){clearAll();orders=incoming;batch=next;}
    for(const panel of panels())if(!orders.has(panel.dataset.orderMapPanel) || closedOrders.has(panel.dataset.orderMapPanel))closedPanel(panel);
  }
  area.addEventListener('click',async event=>{
    const close=event.target.closest('[data-order-map-close]');
    if(close){const entry=entries.get(close.dataset.orderMapClose);if(entry){clear(entry,'Mapa cerrado.');entry.panel?.querySelector('[data-order-map]')?.focus();}return;}
    const button=event.target.closest('[data-order-map]');if(!button || button.disabled || !allowed())return;
    const id=button.dataset.orderMap,order=orders.get(id),panel=button.closest('[data-order-map-panel]');
    if(!order || !panel || panel.dataset.orderMapPanel!==id || closedOrders.has(id) || orderMapData(order).closed)return;
    let entry=entries.get(id);if(!entry){entry={panel,sequence:0,point:null,kind:null,loading:false};entries.set(id,entry);}else if(entry.panel!==panel){clear(entry);entry.panel=panel;}
    const wasFocused=document.activeElement===button;
    clear(entry);entry.loading=true;button.disabled=true;button.setAttribute('aria-busy','true');panel.querySelector('[data-order-map-close]').hidden=false;status(panel,'Consultando la ubicación disponible de este pedido…');
    const request=++entry.sequence,current=generation,owner=auth.user.id;
    try{
      const tracking=await deliveries.tracking(id);
      if(current!==generation || request!==entry.sequence || !allowed() || auth.user.id!==owner || !area.isConnected || !panel.isConnected || orders.get(id)!==order)return;
      if(tracking.pedidoId!==id || tracking.estadoPedido!==order.estado){
        clear(entry);
        if(tracking.pedidoId===id && isFinal(tracking.estadoPedido))finish(id,entry);
        else status(panel,'El estado del pedido cambió. Actualiza Mis pedidos antes de volver a abrir el mapa.');
        return;
      }
      const data=orderMapData(order,tracking);
      if(data.closed){finish(id,entry);return;}
      if(!data.point){status(panel,'No hay un punto de ubicación disponible. Abre la dirección en Google Maps. Para incluir un punto preciso, añádelo al completar una próxima compra.');return;}
      entry.point=data.point;entry.kind=data.kind;
      const canvas=panel.querySelector('[data-order-map-canvas]'),frame=document.createElement('iframe');
      frame.title=data.kind==='courier'?'Última ubicación compartida del repartidor en OpenStreetMap':'Punto de entrega del pedido en OpenStreetMap';frame.referrerPolicy='no-referrer';frame.loading='lazy';frame.src=data.embedUrl;canvas.replaceChildren(frame);canvas.hidden=false;panel.querySelector('[data-order-map-preview]').hidden=true;button.setAttribute('aria-expanded','true');
      if(wasFocused && (document.activeElement===button || document.activeElement===document.body))panel.querySelector('[data-order-map-close]').focus({preventScroll:true});
      if(data.kind==='courier'){
        const time=new Intl.DateTimeFormat('es-EC',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'America/Guayaquil'}).format(new Date(data.point.registradaAt));status(panel,`Última ubicación compartida: ${time} · precisión aproximada ${Math.round(data.point.precision)} m. Consulta el seguimiento para actualizarla.`);
      }else status(panel,'Punto de entrega añadido con tu autorización. Este punto no representa la ubicación del repartidor.');
    }catch(error){if(current===generation && request===entry.sequence && allowed() && panel.isConnected)status(panel,error.message || 'No se pudo consultar la ubicación. Intenta de nuevo.',true);}
    finally{
      if(current===generation && request===entry.sequence && button.isConnected){entry.loading=false;button.disabled=false;button.removeAttribute('aria-busy');}
    }
  });
  async function revalidate(id,entry){
    const order=orders.get(id),panel=entry.panel,canvas=panel?.querySelector('[data-order-map-canvas]');
    if(entry.checking || entry.loading || !entry.point || !order || !allowed() || !area.isConnected || !panel?.isConnected || !canvas || canvas.hidden || !canvas.querySelector('iframe'))return;
    entry.checking=true;const request=entry.sequence,current=generation,owner=auth.user.id;
    const valid=()=>current===generation && request===entry.sequence && allowed() && auth.user.id===owner && area.isConnected && panel.isConnected && entries.get(id)===entry && orders.get(id)===order;
    try{
      const tracking=await deliveries.tracking(id);if(!valid())return;
      if(tracking.pedidoId!==id){clear(entry,'No se pudo confirmar el estado del pedido. Actualiza Mis pedidos antes de volver a abrir el mapa.',true);return;}
      if(isFinal(tracking.estadoPedido) || ['entregada','cancelada'].includes(tracking.entrega?.estado)){finish(id,entry);return;}
      if(tracking.estadoPedido!==order.estado){clear(entry,'El estado del pedido cambió. Actualiza Mis pedidos antes de volver a abrir el mapa.');return;}
      if(entry.kind==='courier' && orderMapData(order,tracking).kind!=='courier')clear(entry,'No hay una ubicación reciente compartida del repartidor. Consulta el seguimiento para actualizarla.');
    }catch{
      if(valid())clear(entry,'No se pudo comprobar el estado del pedido. Actualiza Mis pedidos antes de volver a abrir el mapa.',true);
    }finally{if(current===generation && request===entry.sequence)entry.checking=false;}
  }
  const expirePoints=()=>{
    if(!allowed()){expire();return;}
    for(const [id,entry] of entries){
      if(!entry.panel?.isConnected){clear(entry);entries.delete(id);continue;}
      if(entry.kind==='courier' && (Date.now()-Date.parse(entry.point?.registradaAt)>=120000 || Date.parse(entry.point?.registradaAt)-Date.now()>15000)){clear(entry,'La última ubicación compartida ya no es reciente. Vuelve a consultar el mapa o abre el seguimiento.');continue;}
      void revalidate(id,entry);
    }
  };
  let timer=setInterval(expirePoints,5000);
  events.addEventListener('session:expired',expire);
  events.addEventListener('session:changed',expire);
  events.addEventListener('data:changed',()=>clearAll('El pedido puede haber cambiado. Vuelve a consultar su mapa.'));
  window.addEventListener('storage',event=>{if(event.key==='farmacia-mvc-datos-actualizados')clearAll('El pedido puede haber cambiado. Vuelve a consultar su mapa.');});
  window.addEventListener('pagehide',()=>{clearInterval(timer);clearAll();});
  window.addEventListener('pageshow',event=>{if(event.persisted){clearInterval(timer);if(allowed())timer=setInterval(expirePoints,5000);else expire();}});
  connections.set(area,updateOrderMaps);return updateOrderMaps;
}
