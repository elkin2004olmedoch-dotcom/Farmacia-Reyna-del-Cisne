import {isClassroom,classroomRole,storageKey} from '../models/runtime.js';
import {resetClassroom} from '../models/classroom.js';
import {cart} from '../models/cart.js';
import {confirmAction} from './dialog.js';

const sections=new Set(['dashboard','productos','promociones','pedidos']);
const roles=[['user','Cliente','catalogo.html'],['admin','Administración','admin.html'],['repartidor','Reparto','entregas.html']];
const classroomHome=()=>`clase.html?demo=clase&rol=${classroomRole}`;

export async function classroomController(){
  if(!isClassroom)return true;
  document.body.dataset.classroom='true';
  const page=document.body.dataset.page;
  for(const link of document.querySelectorAll('a[href="index.html"],a[href="index.html#inicio"]'))link.href=classroomHome();
  if(page==='tracking'){
    document.getElementById('tracking-map-load').textContent='Ver mapa simulado';
    document.getElementById('tracking-map-notice').textContent='Mapa ilustrativo de la presentación. No se contactará a Google Maps ni OpenStreetMap.';
    document.querySelector('[aria-labelledby="tracking-location-title"] > .muted').textContent='La posición es ficticia. Avanza el recorrido desde el rol de repartidor.';
  }
  if(page==='deliveries'){
    document.querySelector('.shop-lead').textContent='Ensaya asignación, salida, llegada y entrega en Puerto Quito con datos ficticios. La tarifa se modifica aquí para la demostración.';
    document.getElementById('delivery-gps-help').textContent='El botón GPS utiliza una posición ficticia. No solicita permisos ni accede a la ubicación del dispositivo.';
  }
  if(page==='checkout'){
    const note=document.createElement('p');note.className='wide muted';
    note.textContent='Para clase: usa datos ficticios. El pedido conservará el perfil y destino de ejemplo de la demo, aunque cambies estos campos.';
    document.querySelector('#delivery-form h2').after(note);
  }
  if(['account','admin-install'].includes(page)){
    location.replace(classroomHome());return false;
  }
  if(document.getElementById('classroom-bar'))return true;
  if(page==='admin'){
    const url=new URL(location.href),section=url.searchParams.get('tabla');
    if(section && !sections.has(section)){
      url.searchParams.set('tabla','productos');history.replaceState(null,'',url);
    }
    for(const option of document.querySelectorAll('#admin-table-choice option')){
      if(!sections.has(option.value)){option.hidden=true;option.disabled=true;}
    }
    for(const group of document.querySelectorAll('.admin-nav-group')){
      const links=[...group.querySelectorAll('[data-admin-section]')];
      if(links.length && links.every(link=>!sections.has(link.dataset.adminSection)))group.hidden=true;
    }
    // La carga de archivos se omite en clase; los productos nuevos usan un recurso local existente.
    const form=document.getElementById('product-form');
    if(form){
      const image=form.elements.imagen;
      const useDefault=()=>{if(!image.value)image.value='assets/images/producto-generico-referencia.svg';};
      useDefault();form.addEventListener('reset',()=>queueMicrotask(useDefault));
    }
  }
  const bar=document.createElement('aside');bar.id='classroom-bar';bar.className='classroom-bar';
  bar.setAttribute('aria-label','Modo de demostración para clase');
  bar.innerHTML=`<div class="classroom-bar-copy"><a href="${classroomHome()}" class="classroom-bar-title">Demo para clase · Datos ficticios</a><p>Sin cobros reales · Sin GPS real</p></div><nav class="classroom-role-nav" aria-label="Cambiar rol de demostración">${roles.map(([role,label,file])=>`<a href="${file}?demo=clase&amp;rol=${role}"${role===classroomRole?' aria-current="true"':''}>${label}</a>`).join('')}</nav><div class="classroom-bar-actions"><button type="button" id="classroom-reset">Reiniciar</button><a href="index.html?demo=salir">Salir de la demo</a></div><p id="classroom-reset-status" class="classroom-reset-status" role="alert" hidden></p>`;
  const header=document.querySelector('.site-header,.admin-header');
  if(header)header.after(bar);else document.querySelector('.site-shell').prepend(bar);
  bar.querySelector('#classroom-reset').addEventListener('click',async event=>{
    const button=event.currentTarget;
    const accepted=document.getElementById('confirm-dialog')
      ?await confirmAction('¿Reiniciar la demostración? Se restaurarán los datos ficticios y se vaciará el carrito de clase.')
      :window.confirm('¿Reiniciar los datos ficticios y el carrito de clase?');
    if(!accepted)return;
    button.disabled=true;
    try{
      await resetClassroom();cart.clear();
      for(const key of ['confirmacion','comparacion','zona-formulario'])sessionStorage.removeItem(storageKey('farmacia-mvc-'+key));
      location.assign('clase.html?demo=clase&rol=user');
    }
    catch{button.disabled=false;const status=bar.querySelector('#classroom-reset-status');status.textContent='No se pudo reiniciar la demostración. Inténtalo nuevamente.';status.hidden=false;}
  });
  return true;
}
