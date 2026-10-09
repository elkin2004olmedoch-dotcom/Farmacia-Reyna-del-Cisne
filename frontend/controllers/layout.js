import {auth} from '../models/auth.js';
import {cart} from '../models/cart.js';
import {events} from '../models/events.js';
import {sessionView} from '../views/layout.js';
import {message,busy} from '../views/common.js';
export function layoutController() {
  function update(){sessionView(auth.user,Object.values(cart.read()).reduce((sum,n)=>sum+n,0));}
  update();for(const name of ['cart:changed','session:changed'])events.addEventListener(name,update);
  events.addEventListener('session:expired',()=>{
    auth.clear();
    if(document.body.dataset.page==='admin'){
      const area=document.getElementById('admin-area');area.hidden=true;area.replaceChildren();
      document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());document.getElementById('mobile-nav').hidden=true;
      sessionStorage.setItem('farmacia-mvc-login-message','Tu sesión venció. Inicia sesión con tu cuenta de administrador para continuar.');location.replace('cuenta.html?next=admin.html');return;
    }
    message('Tu sesión venció. Inicia sesión nuevamente para continuar.',true);
  });
  const button=document.getElementById('menu-button');const menu=document.getElementById('mobile-nav');
  button.addEventListener('click',()=>{menu.hidden=!menu.hidden;button.setAttribute('aria-expanded',String(!menu.hidden));button.setAttribute('aria-label',menu.hidden?'Abrir menú':'Cerrar menú');});
  document.addEventListener('keydown',event=>{if(event.key==='Escape' && !menu.hidden){menu.hidden=true;button.setAttribute('aria-expanded','false');button.focus();}});
  for(const link of document.querySelectorAll('.shop-nav a'))if(link.getAttribute('href')===(location.pathname.split('/').pop() || 'index.html'))link.setAttribute('aria-current','page');
  document.addEventListener('click',async event=>{const logout=event.target.closest('#logout');if(!logout)return;busy(logout,true);try{await auth.logout();location.replace('cuenta.html');}catch(error){message(error.message,true);location.replace('cuenta.html');}});
}
export function requireUser(next='checkout.html',admin=false) {
  if(!auth.user){message('Inicia sesión para continuar. Te llevaremos al acceso.',true,true);sessionStorage.setItem('farmacia-mvc-login-message',admin?'Inicia sesión con tu cuenta de administrador para gestionar la farmacia.':'Inicia sesión para continuar con tu pedido.');location.assign('cuenta.html?next='+encodeURIComponent(next));return false;}
  if(admin && !auth.isAdmin){document.getElementById('admin-area').hidden=true;message('Esta sección está disponible para administradores.',true,true);return false;}
  return true;
}
