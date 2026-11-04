import {auth} from '../models/auth.js';
import {cart} from '../models/cart.js';
import {events} from '../models/events.js';
import {sessionView} from '../views/layout.js';
import {message,busy} from '../views/common.js';
import {cartDrawerController} from './cart-drawer.js';
import {pharmacy} from '../models/pharmacy.js';
import {predictiveSearch} from './predictive-search.js';
export function layoutController() {
  predictiveSearch(document.getElementById('global-search'));
  document.addEventListener('error',event=>{const image=event.target;if(image instanceof HTMLImageElement && image.hasAttribute('data-product-image') && !image.src.endsWith('/producto-sin-imagen.svg'))image.src='assets/images/producto-sin-imagen.svg';},true);
  const updateCustomerTools=cartDrawerController();
  const locationDetails=document.getElementById('ubicacion'),locationMap=locationDetails?.querySelector?.('iframe[data-pharmacy-map]');
  if(locationMap){
    const show=()=>{if(!locationDetails.open)locationMap.removeAttribute('src');else if(locationMap.getAttribute('src')!==pharmacy.embedUrl)locationMap.src=pharmacy.embedUrl;};
    const openFromLink=()=>{if(location.hash==='#ubicacion'){locationDetails.open=true;show();}};
    locationDetails.addEventListener('toggle',show);globalThis.addEventListener('hashchange',openFromLink);openFromLink();
    document.addEventListener('click',event=>{if(event.target.closest('a[href="#ubicacion"],a[href="index.html#ubicacion"]')){locationDetails.open=true;show();}});
  }
  function update(){sessionView(auth.user,Object.values(cart.read()).reduce((sum,n)=>sum+n,0));updateCustomerTools?.();}
  update();for(const name of ['cart:changed','session:changed'])events.addEventListener(name,update);
  events.addEventListener('session:expired',()=>{
    // A first anonymous visit has no previous session to expire.
    if(document.body.dataset.page==='home'&&document.body.hasAttribute('data-session-pending')&&!auth.user){auth.clear();return;}
    auth.clear();
    if(document.body.dataset.page==='account'){document.getElementById('account-area').replaceChildren();sessionStorage.setItem('farmacia-mvc-login-message','Tu sesión venció. Inicia sesión nuevamente para editar tu perfil.');location.replace('cuenta.html');return;}
    if(document.body.dataset.page==='admin'){
      const area=document.getElementById('admin-area');area.hidden=true;area.replaceChildren();
      document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());closeMenu();
      sessionStorage.setItem('farmacia-mvc-login-message','Tu sesión venció. Inicia sesión con tu cuenta de administrador para continuar.');location.replace('cuenta.html?next=admin.html');return;
    }
    if(document.body.dataset.page==='orders'){document.getElementById('orders-list').replaceChildren();for(const id of ['orders-prev','orders-next'])document.getElementById(id).disabled=true;document.getElementById('orders-page-info').textContent='';}
    if(document.body.dataset.page==='checkout'){const form=document.getElementById('delivery-form');form.reset();form.hidden=true;}
    message('Tu sesión venció. Inicia sesión nuevamente para continuar.',true);
  });
  const button=document.getElementById('menu-button');const menu=document.getElementById('mobile-nav');
  const overlay=document.getElementById('admin-nav-overlay');
  const main=document.getElementById('contenido');
  const searchToggle=document.getElementById('search-toggle');
  function closeSearch(){delete document.body.dataset.searchOpen;searchToggle?.setAttribute('aria-expanded','false');}
  searchToggle?.addEventListener('click',()=>{const show=document.body.dataset.searchOpen!=='true';if(show){document.body.dataset.searchOpen='true';document.getElementById('global-search')?.focus();}else closeSearch();searchToggle.setAttribute('aria-expanded',String(show));});
  function closeMenu(focus=false){menu.hidden=true;if(overlay){overlay.hidden=true;main.inert=false;}document.body.classList.remove('admin-menu-open');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Abrir menú');if(focus)button.focus();}
  button.addEventListener('click',()=>{if(!menu.hidden){closeMenu(true);return;}menu.hidden=false;if(overlay){overlay.hidden=false;main.inert=true;document.body.classList.add('admin-menu-open');menu.querySelector('a')?.focus();}button.setAttribute('aria-expanded','true');button.setAttribute('aria-label','Cerrar menú');});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape' && document.body.dataset.searchOpen==='true' && !document.querySelector('dialog[open]')){closeSearch();searchToggle?.focus();}
    if(event.key==='Escape' && !menu.hidden)closeMenu(true);
    if(event.key==='Tab' && overlay && !menu.hidden){const links=[button,...menu.querySelectorAll('a[href],summary')].filter(control=>control.getClientRects().length);const position=links.indexOf(document.activeElement);event.preventDefault();links[(position+(event.shiftKey?-1:1)+links.length)%links.length].focus();}
  });
  overlay?.addEventListener('click',()=>closeMenu(true));menu.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
  if(overlay)matchMedia('(min-width:901px)').addEventListener('change',event=>{if(event.matches)closeMenu();});
  const currentPage=(location.pathname.replace(/\/+$/,'').split('/').pop() || 'index').replace(/\.html$/,'');
  for(const link of document.querySelectorAll('.shop-nav a'))if(link.getAttribute('href').replace(/\.html$/,'')===currentPage)link.setAttribute('aria-current','page');
  document.addEventListener('click',async event=>{const logout=event.target.closest('#logout');if(!logout)return;busy(logout,true);try{await auth.logout();location.replace('cuenta.html');}catch(error){message(error.message,true);location.replace('cuenta.html');}});
  return update;
}
export function requireUser(next='checkout.html',admin=false) {
  if(!auth.user){message('Inicia sesión para continuar. Te llevaremos al acceso.',true,true);sessionStorage.setItem('farmacia-mvc-login-message',admin?'Inicia sesión con tu cuenta de administrador para gestionar la farmacia.':'Inicia sesión para continuar con tu pedido.');location.assign('cuenta.html?next='+encodeURIComponent(next));return false;}
  if(admin && !auth.isAdmin){document.getElementById('admin-area').hidden=true;message('Esta sección está disponible para administradores.',true,true);return false;}
  return true;
}
