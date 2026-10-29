import {auth} from '../models/auth.js';
import {events} from '../models/events.js';
import {deliveries,ZONE_FORM_DRAFT} from '../models/deliveries.js';
import {administration} from '../models/admin.js';
import {requireUser} from './layout.js';
import {watchUpdates,preserveFocus} from './updates.js';
import {message,busy,formErrors} from '../views/common.js';
import {zonesView,couriersView,assignmentOrdersView,deliveriesView,trackingView,trackingLocationView,trackingMapView,recentLocation} from '../views/deliveries.js';

const byId=id=>document.getElementById(id);
const activeDelivery=item=>item && ['en_camino','en_destino'].includes(item.estado);
function formValid(form){
  const issues={};for(const field of form.querySelectorAll('[name]'))if(field.willValidate && !field.validity.valid)issues[field.name]=field.validationMessage;
  return formErrors(form,issues);
}
function clearPrivate(area){area.hidden=true;area.querySelectorAll('form').forEach(form=>form.reset());area.replaceChildren();}

export async function deliveriesController(){
  if(!requireUser('entregas.html'))return;
  const admin=auth.user.role==='admin',courier=auth.user.role==='repartidor';
  if(!admin && !courier){message('Esta ventana está disponible para administradores y repartidores.',true,true);return;}
  const area=byId('deliveries-area'),list=byId('deliveries-list'),zoneForm=byId('delivery-zone-form'),courierForm=byId('courier-form'),assignment=byId('delivery-assignment-form');
  area.hidden=false;byId('delivery-admin').hidden=!admin;
  let live=true,page=1,orderPage=1,requestId=0,ordersRequestId=0,working=false,listLoading=false,listPending=false,snapshot='',result={items:[]},zones=[],couriers=[],reassign=null,sharing=null,gpsGeneration=0;
  const gpsNotice=text=>{if(live)byId('delivery-gps-status').textContent=text;};
  function draw(){if(live)preserveFocus(list,()=>deliveriesView(result,{admin,sharingId:sharing?.item.id}));}
  function resetZone(){zoneForm.reset();zoneForm.elements.id.value='';zoneForm.elements.esperadoVersion.value='';formErrors(zoneForm,{});}
  function stopLocal(){
    gpsGeneration++;const previous=sharing;sharing=null;
    if(previous?.watchId!==undefined)navigator.geolocation?.clearWatch(previous.watchId);
    return previous;
  }
  async function stopGps({notice=true,drawList=true,keepalive=false}={}){
    const previous=stopLocal();if(drawList)draw();if(!previous)return;
    if(notice)gpsNotice('Ubicación detenida en este dispositivo. Retirando la última posición del servidor…');
    // Retira después de cualquier muestra pendiente, para que no vuelva a aparecer al detener.
    try{await previous.pending;if(auth.user)await deliveries.stopSharing(previous.item.id,{keepalive});if(notice)gpsNotice('Ubicación detenida y retirada del servidor.');}
    catch{if(notice)gpsNotice('Se detuvo el GPS local. No se pudo confirmar la retirada en el servidor; la ubicación dejará de mostrarse al vencer en dos minutos. Puedes reintentar la retirada.');if(live && auth.user)retirePending.add(previous.item.id);}
  }
  const retirePending=new Set();
  function expire(){if(!live)return;live=false;requestId++;ordersRequestId++;stopLocal();zones=[];couriers=[];result={items:[]};reassign=null;clearPrivate(area);}
  events.addEventListener('session:expired',expire);
  events.addEventListener('session:changed',()=>{if(!auth.user)expire();});
  window.addEventListener('pagehide',()=>{void stopGps({notice:false,drawList:false,keepalive:true});});
  async function refreshList(){
    if(!live || working)return;if(listLoading){listPending=true;return;}listLoading=true;const id=++requestId,requested=page;
    try{
      const loaded=await deliveries.list(requested,byId('delivery-filter').value);
      if(!live || !auth.user || id!==requestId || requested!==page)return;
      result=loaded;
      if(sharing){const current=result.items.find(item=>item.id===sharing.item.id);if(!activeDelivery(current)){await stopGps({notice:false,drawList:false});gpsNotice('El GPS se detuvo porque la entrega dejó de estar activa en esta bandeja.');}else sharing.item={...current,gpsVersion:Math.max(current.gpsVersion,sharing.item.gpsVersion)};}
      const next=JSON.stringify(loaded);if(next!==snapshot){snapshot=next;draw();}
    }finally{listLoading=false;if(listPending && live && !working){listPending=false;await refreshList();}}
  }
  async function refreshOrders(requested=orderPage){
    const id=++ordersRequestId;const loaded=await administration.table('pedidos',requested);
    if(!live || !auth.user || id!==ordersRequestId)return;
    orderPage=requested;preserveFocus(assignment,()=>assignmentOrdersView(loaded));
  }
  async function metadata(){
    const [loadedZones,loadedCouriers]=await Promise.all([deliveries.adminZones(),deliveries.couriers()]);
    if(!live || !auth.user)return;zones=loadedZones;couriers=loadedCouriers;
    preserveFocus(byId('delivery-zones-list'),()=>zonesView(zones));
    preserveFocus(byId('couriers-list'),()=>couriersView(couriers));
  }
  async function action(button,perform,success){
    if(!live || working)return;working=true;requestId++;busy(button,true);
    try{await perform();if(live && auth.user)message(success);}
    catch(error){if(error.status!==401 && live){message(error.status===409?'Los datos cambiaron. Actualiza la página y revisa los valores antes de volver a guardar.':error.message,true);}}
    finally{working=false;if(button.isConnected)busy(button,false);if(live && auth.user){try{await refreshList();}catch(error){if(error.status!==401)message(error.message,true);}}}
  }
  async function retryRetirement(){for(const id of retirePending){try{await deliveries.stopSharing(id);retirePending.delete(id);}catch{gpsNotice('La retirada de ubicación sigue pendiente. Revisa la conexión y pulsa Actualizar entregas para reintentar.');}}}
  async function startGps(item){
    await stopGps({notice:false,drawList:false});if(!live || !auth.user || !activeDelivery(item))return;
    if(!globalThis.isSecureContext || !navigator.geolocation){gpsNotice('Este dispositivo necesita una conexión HTTPS y geolocalización disponible. Puedes continuar con los estados de entrega.');return;}
    const generation=++gpsGeneration,session={item,watchId:undefined,pending:null,lastAttempt:0};sharing=session;
    gpsNotice('Solicitando permiso para compartir tu ubicación durante esta entrega. Puedes detenerla en cualquier momento.');draw();
    session.watchId=navigator.geolocation.watchPosition(position=>{
      if(!live || sharing!==session || gpsGeneration!==generation || !activeDelivery(session.item) || session.pending || Date.now()-session.lastAttempt<12000)return;
      const {latitude,longitude,accuracy}=position.coords,at=position.timestamp,age=Date.now()-at;
      if(![latitude,longitude,accuracy,at].every(Number.isFinite) || Math.abs(latitude)>90 || Math.abs(longitude)>180 || accuracy<0 || accuracy>10000 || age>120000 || age< -15000){gpsNotice('El dispositivo no proporcionó una ubicación reciente con precisión válida. Los estados de entrega siguen disponibles.');return;}
      if(!navigator.onLine){gpsNotice('Sin conexión. El GPS no se enviará hasta recuperar la red; puedes volver a intentar los estados.');return;}
      session.lastAttempt=Date.now();
      session.pending=(async()=>{
        try{const data=await deliveries.shareLocation(session.item.id,{latitud:latitude,longitud:longitude,precision:accuracy,registradaAt:new Date(at).toISOString(),esperadoGpsVersion:session.item.gpsVersion});session.item.gpsVersion=data.gpsVersion;if(sharing===session)gpsNotice('Ubicación compartida. Precisión del dispositivo: '+Math.round(accuracy)+' metros.');}
        catch(error){if(error.status===401){expire();return;}if(sharing===session){if([403,404,409].includes(error.status)){stopLocal();draw();gpsNotice('El estado o permiso de la entrega cambió. Actualiza la bandeja antes de compartir otra vez.');}else gpsNotice('No se pudo compartir la ubicación. Revisa la conexión; los estados de entrega siguen disponibles.');}}
        finally{session.pending=null;}
      })();
    },error=>{
      if(sharing!==session)return;
      const denied=error.code===1;gpsNotice(denied?'Permiso de ubicación denegado. Puedes habilitarlo en tu navegador y volver a compartir. Los estados de entrega siguen disponibles.':'No se pudo obtener una ubicación. Puedes detener y reintentar; los estados de entrega siguen disponibles.');
      if(denied)void stopGps({notice:false});
    },{enableHighAccuracy:true,maximumAge:0,timeout:20000});
  }
  area.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button || !live || working)return;
    const item=result.items.find(entry=>entry.id===(button.dataset.id || button.dataset.deliveryGps || button.dataset.deliveryReassign));
    if(button.hasAttribute('data-delivery-gps') && courier && activeDelivery(item)){
      if(sharing?.item.id===item.id)await stopGps();else await startGps(item);return;
    }
    if(button.hasAttribute('data-delivery-state') && item){await action(button,async()=>{await deliveries.changeState(item.id,button.dataset.deliveryState,item.version);if(['entregada','cancelada'].includes(button.dataset.deliveryState) && sharing?.item.id===item.id)await stopGps({notice:false,drawList:false});},'Estado de entrega actualizado.');return;}
    if(admin && button.hasAttribute('data-delivery-reassign') && item?.estado==='asignada'){
      reassign={pedidoId:item.pedidoId,esperadoVersion:item.version};const select=byId('delivery-order-select');if(![...select.options].some(option=>option.value===item.pedidoId)){const option=new Option(item.pedidoId.slice(0,8)+' · Reasignar',item.pedidoId);select.add(option);}select.value=item.pedidoId;byId('delivery-courier-select').value=item.repartidorId;byId('delivery-courier-select').focus();return;
    }
    if(admin && button.hasAttribute('data-zone-edit')){
      const zone=zones.find(entry=>entry.id===button.dataset.zoneEdit);if(!zone)return;resetZone();
      for(const key of ['id','nombre','provincia','canton','ivaCategoria','fundamentoIva'])zoneForm.elements.namedItem(key).value=zone[key] ?? '';
      zoneForm.elements.esperadoVersion.value=zone.version;zoneForm.elements.tarifa.value=zone.tarifaCentavos===null?'':(zone.tarifaCentavos/100).toFixed(2);zoneForm.elements.activa.checked=zone.activa;byId('delivery-zone-editor').open=true;byId('delivery-zone-name').focus();return;
    }
    if(admin && button.hasAttribute('data-courier-toggle')){const person=couriers.find(entry=>entry.id===button.dataset.courierToggle);if(person)await action(button,async()=>{await deliveries.setCourierActive(person.id,!person.activo);await metadata();},'Disponibilidad del repartidor actualizada.');}
  });
  byId('deliveries-refresh').addEventListener('click',event=>{void action(event.currentTarget,async()=>{await retryRetirement();},'Bandeja actualizada.');});
  for(const [id,offset]of [['deliveries-prev',-1],['deliveries-next',1]])byId(id).addEventListener('click',event=>{void action(event.currentTarget,async()=>{await stopGps({notice:false,drawList:false});page=Math.max(1,page+offset);snapshot='';},'Página de entregas actualizada.');});
  byId('delivery-filter').addEventListener('change',()=>{if(working)return;page=1;snapshot='';requestId++;void refreshList().catch(error=>{if(error.status!==401)message(error.message,true);});});
  if(admin){
    byId('delivery-zone-reset').addEventListener('click',()=>{resetZone();byId('delivery-zone-name').focus();});
    zoneForm.addEventListener('submit',event=>{
      event.preventDefault();if(working || !formValid(zoneForm))return;const values=Object.fromEntries(new FormData(zoneForm)),issues={};
      const cents=values.tarifa.trim()===''?null:Math.round(Number(values.tarifa)*100);
      if(cents!==null && (!Number.isSafeInteger(cents) || Math.abs(Number(values.tarifa)*100-cents)>0.000001))issues.tarifa='Usa una tarifa con un máximo de dos decimales.';
      if(values.ivaCategoria==='cero' && values.fundamentoIva.trim().length<8)issues.fundamentoIva='Registra al menos ocho caracteres de fundamento legal para IVA 0 %.';
      if(!formErrors(zoneForm,issues))return;
      const payload={nombre:values.nombre.trim(),provincia:values.provincia.trim(),canton:values.canton.trim(),tarifaCentavos:cents,ivaCategoria:values.ivaCategoria,fundamentoIva:values.fundamentoIva.trim() || null,activa:zoneForm.elements.activa.checked};if(values.id)payload.esperadoVersion=Number(values.esperadoVersion);
      void action(zoneForm.querySelector('[type=submit]'),async()=>{await deliveries.saveZone(payload,values.id);if(live){resetZone();await metadata();}},'Zona y tarifa guardadas. Los pedidos anteriores conservan su tarifa.');
    });
    courierForm.addEventListener('submit',event=>{event.preventDefault();if(working || !formValid(courierForm))return;const values=Object.fromEntries(new FormData(courierForm));void action(courierForm.querySelector('[type=submit]'),async()=>{await deliveries.createCourier(values);if(live){courierForm.reset();await metadata();}},'Repartidor creado.');});
    byId('delivery-order-select').addEventListener('change',()=>{reassign=null;});
    assignment.addEventListener('submit',event=>{event.preventDefault();if(working || !formValid(assignment))return;const values=Object.fromEntries(new FormData(assignment));if(reassign?.pedidoId===values.pedidoId)values.esperadoVersion=reassign.esperadoVersion;void action(assignment.querySelector('[type=submit]'),async()=>{await deliveries.assign(values);reassign=null;},'Entrega asignada.');});
    for(const [id,offset]of [['delivery-orders-prev',-1],['delivery-orders-next',1]])byId(id).addEventListener('click',event=>{void action(event.currentTarget,()=>refreshOrders(Math.max(1,orderPage+offset)),'Página de pedidos actualizada.');});
  }
  const refresh=watchUpdates(refreshList,{canRefresh:()=>live && Boolean(auth.user) && !working,intervalMs:5000});
  try{await Promise.all([refreshList(),...(admin?[metadata(),refreshOrders()]:[])]);}catch(error){if(error.status!==401 && live)message(error.message,true);}
  if(admin && live && auth.isAdmin && location.hash==='#delivery-zone-editor'){
    const stored=sessionStorage.getItem(ZONE_FORM_DRAFT);sessionStorage.removeItem(ZONE_FORM_DRAFT);resetZone();
    try{
      const draft=stored && JSON.parse(stored);
      if(draft && Number.isFinite(draft.createdAt) && Date.now()-draft.createdAt>=0 && Date.now()-draft.createdAt<60000 && draft.values && !Array.isArray(draft.values)){
        for(const key of ['nombre','provincia','canton','ivaCategoria','fundamentoIva'])if(typeof draft.values[key]==='string')zoneForm.elements.namedItem(key).value=draft.values[key];
        if(Number.isSafeInteger(draft.values.tarifaCentavos) && draft.values.tarifaCentavos>=0)zoneForm.elements.tarifa.value=(draft.values.tarifaCentavos/100).toFixed(2);
        if(typeof draft.values.activa==='boolean')zoneForm.elements.activa.checked=draft.values.activa;
      }
    }catch{/* Un borrador local inválido nunca se guarda automáticamente. */}
    byId('delivery-zone-editor').open=true;byId('delivery-zone-name').focus();message('Revisa y completa los datos reales de la zona antes de guardarla.');
  }
  return refresh;
}

export async function trackingController(){
  const pedido=new URLSearchParams(location.search).get('pedido');
  if(!pedido || !/^[a-zA-Z0-9_-]{1,100}$/.test(pedido)){message('Selecciona un pedido desde Mis pedidos para consultar su seguimiento.',true,true);return;}
  if(!requireUser('seguimiento.html?pedido='+encodeURIComponent(pedido)))return;
  if(!['user','admin'].includes(auth.user.role)){message('El seguimiento del comprador requiere una cuenta de cliente o administrador.',true,true);return;}
  const area=byId('tracking-area'),content=byId('tracking-content');area.hidden=false;
  let live=true,requestId=0,running=false,mapEnabled=false,data=null,snapshot='',locationSnapshot='';
  function renderLocation(){if(!live)return;const point=recentLocation(data),next=JSON.stringify(point);if(next!==locationSnapshot){preserveFocus(byId('tracking-location'),()=>trackingLocationView(point));locationSnapshot=next;}trackingMapView(point,mapEnabled);}
  function expire(){if(!live)return;live=false;requestId++;data=null;mapEnabled=false;clearInterval(expiryTimer);clearPrivate(area);}
  events.addEventListener('session:expired',expire);events.addEventListener('session:changed',()=>{if(!auth.user)expire();});
  async function refresh(){
    if(!live || running)return;running=true;const id=++requestId;
    try{const loaded=await deliveries.tracking(pedido);if(!live || !auth.user || id!==requestId)return;data=loaded;const next=JSON.stringify(loaded);if(next!==snapshot){preserveFocus(content,()=>trackingView(data));snapshot=next;}renderLocation();}
    catch(error){if(error.status===404 && live){data=null;content.replaceChildren();renderLocation();message('No se encontró un pedido disponible para tu cuenta.',true);}else throw error;}
    finally{running=false;}
  }
  byId('tracking-map-load').addEventListener('click',()=>{mapEnabled=true;renderLocation();});
  byId('tracking-refresh').addEventListener('click',async event=>{const button=event.currentTarget;busy(button,true);try{await refresh();}catch(error){if(error.status!==401 && live)message(error.message,true);}finally{if(button.isConnected)busy(button,false);}});
  let expiryTimer=setInterval(renderLocation,5000);
  window.addEventListener('pagehide',()=>{clearInterval(expiryTimer);mapEnabled=false;trackingMapView(null,false);});
  window.addEventListener('pageshow',event=>{if(event.persisted && live){expiryTimer=setInterval(renderLocation,5000);renderLocation();}});
  const update=watchUpdates(refresh,{canRefresh:()=>live && Boolean(auth.user),intervalMs:5000});
  try{await refresh();}catch(error){if(error.status!==401 && live)message(error.message,true);}
  return update;
}
