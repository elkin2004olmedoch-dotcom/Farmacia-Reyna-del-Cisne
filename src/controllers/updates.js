import {events} from '../models/events.js';
import {message} from '../views/common.js';
import {apiUrl} from '../config.js';

const subscribers=new Set();let source=null,revision=null,retryTimer=null,retryMs=3000;
function disconnect(){clearTimeout(retryTimer);retryTimer=null;source?.close();source=null;}
function connect(){
  if(source||retryTimer||document.hidden||!subscribers.size||typeof EventSource!=='function')return;
  const active=new EventSource(apiUrl('/actualizaciones'));source=active;
  active.onmessage=event=>{
    if(source!==active)return;
    let next;try{next=JSON.parse(event.data)?.revision;}catch{return;}
    if(!/^[a-f0-9]{32}$/.test(next))return;
    retryMs=3000;if(next===revision)return;
    revision=next;for(const listener of subscribers)void listener();
  };
  active.onerror=()=>{
    if(source!==active)return;
    disconnect();retryTimer=setTimeout(()=>{retryTimer=null;connect();},retryMs);retryMs=Math.min(retryMs*2,30000);
  };
}
function subscribe(update){
  subscribers.add(update);connect();
  return ()=>{subscribers.delete(update);if(!subscribers.size){disconnect();revision=null;retryMs=3000;}};
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)disconnect();else connect();});
window.addEventListener('online',()=>{disconnect();connect();});

// Consulta la misma API al regresar y mientras la página permanece visible.
// No reemplaza formularios abiertos ni acumula peticiones simultáneas.
export function watchUpdates(refresh,{canRefresh=()=>true,intervalMs=30000}={}) {
  let stopped=false,running=false,pending=false,readyTimer=null,lastError='',lastNotice='';
  async function update(){
    if(stopped || document.hidden)return;
    if(running){pending=true;return;}
    if(!canRefresh()){
      pending=true;if(!readyTimer)readyTimer=setTimeout(()=>{readyTimer=null;void update();},1000);
      return;
    }
    clearTimeout(readyTimer);readyTimer=null;running=true;pending=false;
    try{await refresh();if(lastNotice && document.getElementById('page-status').textContent===lastNotice)message('Datos actualizados.');lastError='';lastNotice='';}
    catch(error){if(error.status!==401 && error.message!==lastError){lastError=error.message;lastNotice=`${error.message} No se pudieron actualizar los datos visibles; volveremos a intentar.`;message(lastNotice,true);}}
    finally{running=false;if(pending){pending=false;void update();}}
  }
  const visible=()=>{if(!document.hidden)void update();};
  const stored=event=>{if(event.key==='farmacia-mvc-datos-actualizados')void update();};
  const released=()=>{if(pending)void update();};
  let timer,unsubscribe;
  function start(){stopped=false;timer=setInterval(update,intervalMs);unsubscribe=subscribe(update);window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);document.addEventListener('close',released,true);window.addEventListener('storage',stored);events.addEventListener('data:changed',visible);}
  function stop(){stopped=true;clearInterval(timer);clearTimeout(readyTimer);readyTimer=null;unsubscribe?.();window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);document.removeEventListener('close',released,true);window.removeEventListener('storage',stored);events.removeEventListener('data:changed',visible);}
  start();window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',event=>{if(event.persisted){start();void update();}});
  return update;
}

export function preserveFocus(target,render) {
  const active=document.activeElement;
  let selector=active?.id?'#'+CSS.escape(active.id):null;
  if(!selector && target.contains(active))for(const name of ['data-add','data-compare','data-pick','data-cart-remove','data-cart-plus','data-cart-minus','data-edit','data-delete','data-companion-record','data-order-invoice','data-invoice-emit','data-invoice-xml','data-invoice-ride','data-customer-invoice-xml','data-customer-invoice-ride','href'])if(active.hasAttribute(name)){selector=`[${name}="${CSS.escape(active.getAttribute(name))}"]`;break;}
  const inside=target.contains(active);
  render();
  if(inside && selector)target.querySelector(selector)?.focus({preventScroll:true});
}
