import {events} from '../models/events.js';
import {message} from '../views/common.js';

// Consulta la misma API al regresar y mientras la página permanece visible.
// No reemplaza formularios abiertos ni acumula peticiones simultáneas.
export function watchUpdates(refresh,{canRefresh=()=>true}={}) {
  let stopped=false,running=false,pending=false,lastError='',lastNotice='';
  async function update(){
    if(stopped || document.hidden || !canRefresh())return;
    if(running){pending=true;return;}
    running=true;
    try{await refresh();if(lastNotice && document.getElementById('page-status').textContent===lastNotice)message('Datos actualizados.');lastError='';lastNotice='';}
    catch(error){if(error.status!==401 && error.message!==lastError){lastError=error.message;lastNotice=`${error.message} No se pudieron actualizar los datos visibles; volveremos a intentar.`;message(lastNotice,true);}}
    finally{running=false;if(pending){pending=false;void update();}}
  }
  const visible=()=>{if(!document.hidden)void update();};
  const stored=event=>{if(event.key==='farmacia-mvc-datos-actualizados')void update();};
  let timer;
  function start(){stopped=false;timer=setInterval(update,30000);window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);window.addEventListener('storage',stored);events.addEventListener('data:changed',visible);}
  function stop(){stopped=true;clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);window.removeEventListener('storage',stored);events.removeEventListener('data:changed',visible);}
  start();window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',event=>{if(event.persisted){start();void update();}});
  return update;
}

export function preserveFocus(target,render) {
  const active=document.activeElement;
  let selector=active?.id?'#'+CSS.escape(active.id):null;
  if(!selector && target.contains(active))for(const name of ['data-add','data-compare','data-pick','data-cart-remove','data-cart-plus','data-cart-minus','data-edit','data-delete','href'])if(active.hasAttribute(name)){selector=`[${name}="${CSS.escape(active.getAttribute(name))}"]`;break;}
  const inside=target.contains(active);
  render();
  if(inside && selector)target.querySelector(selector)?.focus({preventScroll:true});
}
